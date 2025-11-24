import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, TransactionType, Insight, TipoImportacao, TransacaoNormalizada } from '../types';
import { detectarTipoImportacao, normalizarTransacaoGenerica, isPagamentoFaturaDescription, isLikelyInternalTransfer, parseSpreadsheet } from '../utils/importUtils';
import { logApiCall } from './storageService';
import { parseLocalDate } from '../utils/dateUtils';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });  

// 1. Smart Entry: Parse natural language into a Transaction object
export const parseTransactionFromText = async (text: string): Promise<Partial<Transaction> & { installments?: number }> => {
  const startTime = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze this text: "${text}". 
      Current Date: ${new Date().toISOString()}.
      
      Tasks:
      1. Extract transaction details.
      2. **SANITIZE THE DESCRIPTION**: Convert names like "Gastei no lol", "Pgto * Uber * Sao Paulo" to clean names like "Riot Games", "Uber". Generalize if specific store is unknown but category is clear (e.g. "Gastei no bar" -> "Bar/Restaurante").
      3. Map category to: ${Object.values(Category).join(', ')}.
      4. If user mentions "parcelado", "x vezes", extract installments count (default 1).
      5. Identify 'paymentDate' if explicitly mentioned (e.g. "vence dia 10", "pagar mes que vem"). Otherwise leave null.
      
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Clean, capitalized merchant or item name" },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            date: { type: Type.STRING, description: "ISO 8601 date string (Date of purchase)" },
            paymentDate: { type: Type.STRING, description: "ISO 8601 date string (Date of payment/due date)" },
            type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
            isRecurring: { type: Type.BOOLEAN },
            installments: { type: Type.INTEGER }
          },
          required: ["description", "amount", "type", "category"]
        }
      }
    });

    if (response.text) {
      logApiCall({ endpoint: 'parseTransactionFromText', status: 'success', duration: Date.now() - startTime });
      const data = JSON.parse(response.text);
      return {
        ...data,
        id: crypto.randomUUID(),
        isAiGenerated: true
      };
    }
    throw new Error("No response text");
  } catch (error) {
    logApiCall({ endpoint: 'parseTransactionFromText', status: 'error', duration: Date.now() - startTime, error: String(error) });
    console.error("Gemini parse error:", error);
    throw error;
  }
};

// 2. Import Tool: Parse File Content (Base64 or Text) - Supports both Invoices and Bank Statements
export const parseImportFile = async (
  fileData: string,
  mimeType: string,
  fileName: string,
  existingTransactions: Transaction[] = [],
  ownerName?: string // Optional: User's name to detect internal transfers
): Promise<{ normalized: TransacaoNormalizada[]; dueDate?: string; issuer?: string; tipoImportacao: TipoImportacao; documentType?: 'invoice' | 'bank_statement' }> => {
  const startTime = Date.now();
  try {
    const tipoImportacao = detectarTipoImportacao({ name: fileName, type: mimeType });

    // Planilhas tratadas localmente
    if (tipoImportacao === 'planilha') {
      return {
        normalized: parseSpreadsheet(fileData, mimeType, fileName),
        tipoImportacao
      };
    }

    const recurringSubscriptions = existingTransactions
      .filter(t => t.isRecurring)
      .map(t => t.description.toLowerCase().trim());

    // Helper function to check if a subscription is a duplicate
    const isDuplicateSubscription = (newDesc: string): boolean => {
      const cleanNew = newDesc.toLowerCase().trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[^\w\s]/g, ''); // Remove special chars
      
      return recurringSubscriptions.some(existing => {
        const cleanExisting = existing
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s]/g, '');
        
        // Check for exact match
        if (cleanNew === cleanExisting) return true;
        
        // Check if one contains the other (with length threshold)
        const shorter = cleanNew.length < cleanExisting.length ? cleanNew : cleanExisting;
        const longer = cleanNew.length < cleanExisting.length ? cleanExisting : cleanNew;
        
        // If shorter is at least 60% of longer and longer contains shorter, it's a match
        if (shorter.length >= longer.length * 0.6 && longer.includes(shorter)) {
          return true;
        }
        
        // Common subscription name variations
        const commonPairs = [
          ['chatgpt', 'google chatgp'],
          ['chatgpt', 'openai'],
          ['prime', 'amazon prime'],
          ['prime video', 'amazon prime'],
          ['netflix', 'netflix.com'],
          ['spotify', 'spotify premium'],
          ['youtube', 'youtube premium'],
          ['disney', 'disney plus'],
          ['apple', 'apple one'],
          ['icloud', 'apple icloud']
        ];
        
        for (const [term1, term2] of commonPairs) {
          if ((cleanNew.includes(term1) && cleanExisting.includes(term2)) ||
              (cleanNew.includes(term2) && cleanExisting.includes(term1))) {
            return true;
          }
        }
        
        return false;
      });
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
             inlineData: {
               data: fileData,
               mimeType: mimeType
             }
          },
          {
            text: `Extract all financial transactions from this document/image.
            Current Year: ${new Date().getFullYear()}.
            Current Month: ${new Date().getMonth() + 1}.

            CRITICAL RULES:

            0. **DOCUMENT TYPE DETECTION**:
               - Identify if this is a CREDIT CARD INVOICE or a BANK STATEMENT (extrato bancário)
               - Return 'documentType' as either 'invoice' or 'bank_statement'
               - Bank statements typically show: deposits (créditos), withdrawals (débitos), transfers, balance
               - Invoices typically show: purchases, due date, total amount to pay

            1. **IDENTIFY ISSUER/BANK**: Detect the bank or card issuer from the document.
               - Look for logos, headers, or text like "Nubank", "Itaú", "C6 Bank", "Inter", "PicPay", etc.
               - Return the clean name (e.g., "Nubank", "Itaú", "C6", "Inter", "Bradesco")
               - If not found, return null

            2. **INVOICE DUE DATE** (For credit card invoices only):
               - Search the document for the "Data de Vencimento" or "Vencimento" (Due Date) of the Invoice/Bill.
               - If found, set 'paymentDate' of ALL extracted items to this Due Date.
               - If NOT found (e.g. bank statement), 'paymentDate' should be the same as 'date'.
               - Also return this due date separately in 'invoiceDueDate' field.

            3. **SECTION VS PAYMENT LINE DISTINCTION**:
               IMPORTANT: "Pagamentos e Financiamentos" is a SECTION NAME, NOT a payment line!

               ✅ DO EXTRACT from "Pagamentos e Financiamentos" section:
               - All items listed under this section (installments, loans, subscriptions)
               - These are valid purchases/transactions

               ❌ DO NOT EXTRACT these payment summary lines:
               - "Pagamento em [date]" (e.g., "Pagamento em 05 OUT")
               - "Pagamento de fatura"
               - "Total da fatura" / "Invoice total"
               - "Valor total" / "Total amount"
               - "Saldo anterior" / "Previous balance"
               - "Saldo atual" / "Current balance"
               These are summary/payment confirmation lines, NOT purchases.

            4. **BANK STATEMENT FILTERING** (If documentType is 'bank_statement'):
               
               ⚠️ CRITICAL: Apply intelligent filtering to avoid duplicate/irrelevant transactions:
               
               a) **INTERNAL TRANSFERS** - Mark with shouldIgnore=true and ignoreReason='internal_transfer':
                  - Transfers between accounts of the same owner
                  - Look for patterns: "Transferência para [same name]", "PIX para [same name]"
                  - "Aplicação", "Resgate", "Poupança"
                  - Any transaction where origin and destination are the same person
                  
               b) **INVOICE PAYMENTS** - Mark with shouldIgnore=true and ignoreReason='invoice_payment':
                  - Lines that represent credit card bill payments
                  - Patterns: "Pagamento Fatura", "PGTO CARTÃO", "DÉBITO AUTOMÁTICO FATURA"
                  - "Fatura Cartão", "Pagamento Nubank/Bradesco/etc"
                  - These should NOT be counted as expenses (already tracked via invoice import)
                  
               c) **BALANCE LINES** - Mark with shouldIgnore=true and ignoreReason='balance_info':
                  - "Saldo Anterior", "Saldo Atual", "Saldo Disponível"
                  - Any line that shows balance information, not actual transactions
               
               For BANK STATEMENTS, extract ALL lines but mark the ones to ignore.
               For INVOICES, only extract valid purchases (no payment/balance lines).

            5. **EXTRACT ALL INDIVIDUAL ITEMS**: Including:
               - Items from "Pagamentos e Financiamentos" section (installments, loans)
               - Regular purchases (Netflix, Uber, Restaurant, Shopping, etc.)
               - Any actual purchase, subscription, or service charge
               - For bank statements: deposits (INCOME) and withdrawals (EXPENSE)

            6. **SANITIZE DESCRIPTIONS**: Shorten and clean merchant names (e.g., "MERCADOLIVRE*VENDEDOR" -> "Mercado Livre").

            7. Detect if it is Income or Expense based on context (negative signs usually expense, or "Crédito" = Income, "Débito" = Expense).

            8. Map categories intelligently.

            9. **DETECT RECURRING SUBSCRIPTIONS**: Identify if a transaction is likely a recurring subscription (Netflix, Spotify, etc.) and set 'isRecurring' to true.

            10. **DETECT INSTALLMENTS**: Look for patterns like "4/6", "parcela 4 de 6", "4x de 6", etc.
               - If found, extract: currentInstallment (e.g., 4), totalInstallments (e.g., 6)
               - The amount should be the installment amount (not total)

            Return a JSON object with:
            - documentType: 'invoice' or 'bank_statement'
            - issuer: the bank/card issuer name (clean, capitalized)
            - invoiceDueDate: the invoice due date if found (ISO 8601 YYYY-MM-DD), or null
            - transactions: array of transactions with filtering info`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING, enum: ["invoice", "bank_statement"], description: "Type of financial document" },
            issuer: { type: Type.STRING, description: "Bank or card issuer name" },
            invoiceDueDate: { type: Type.STRING, description: "Invoice due date if found" },
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  date: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD (Date of purchase)" },
                  paymentDate: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD (Invoice Due Date or Payment Date)" },
                  category: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  isRecurring: { type: Type.BOOLEAN, description: "Is this a recurring subscription?" },
                  currentInstallment: { type: Type.INTEGER, description: "Current installment number (e.g., 4)" },
                  totalInstallments: { type: Type.INTEGER, description: "Total installments (e.g., 6)" },
                  shouldIgnore: { type: Type.BOOLEAN, description: "Should this transaction be ignored?" },
                  ignoreReason: { type: Type.STRING, enum: ["internal_transfer", "invoice_payment", "balance_info", null], description: "Reason to ignore this transaction" }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      logApiCall({ endpoint: 'parseImportFile', status: 'success', duration: Date.now() - startTime });
      const raw = JSON.parse(response.text);
      const dueDate = raw.invoiceDueDate;
      const issuer = raw.issuer;
      const documentType = raw.documentType || 'invoice'; // Default to invoice for backwards compatibility

      // Filter out recurring subscriptions that already exist
      // Also apply intelligent filtering for bank statements
      const filteredTransactions = (raw.transactions || [])
        .filter((t: any) => {
          // Skip if marked to ignore by AI
          if (t.shouldIgnore) {
            console.log(`⚠️ Skipping transaction (${t.ignoreReason}): "${t.description}"`);
            return false;
          }

          // Additional client-side filtering for safety
          if (documentType === 'bank_statement') {
            // Check for invoice payment patterns
            if (isPagamentoFaturaDescription(t.description)) {
              console.log(`⚠️ Skipping invoice payment: "${t.description}"`);
              return false;
            }

            // Check for internal transfer patterns
            if (isLikelyInternalTransfer(t.description, ownerName)) {
              console.log(`⚠️ Skipping internal transfer: "${t.description}"`);
              return false;
            }
          }

          // Check for duplicate subscriptions
          if (t.isRecurring) {
            if (isDuplicateSubscription(t.description)) {
              console.log(`⚠️ Skipping duplicate recurring subscription: "${t.description}" (already exists in system)`);
              return false;
            }
          }
          
          return true;
        })
        .flatMap((t: any) => {
          // Handle installments - create multiple transactions
          if (t.currentInstallment && t.totalInstallments && t.totalInstallments > 1) {
            const transactions: Transaction[] = [];
            // Use parseLocalDate if it's a YYYY-MM-DD string to avoid timezone issues
            const purchaseDate = t.date.includes('T') ? new Date(t.date) : parseLocalDate(t.date);
            const paymentDate = (t.paymentDate || t.date).includes('T') ? new Date(t.paymentDate || t.date) : parseLocalDate(t.paymentDate || t.date);

            // Calculate how many months before and after
            const monthsBefore = t.currentInstallment - 1;
            const monthsAfter = t.totalInstallments - t.currentInstallment;

            // Create past installments
            for (let i = monthsBefore; i > 0; i--) {
              const pastPaymentDate = new Date(paymentDate);
              pastPaymentDate.setMonth(pastPaymentDate.getMonth() - i);

              transactions.push({
                id: crypto.randomUUID(),
                description: `${t.description} (${t.currentInstallment - i}/${t.totalInstallments})`,
                amount: t.amount,
                date: purchaseDate.toISOString(),
                paymentDate: pastPaymentDate.toISOString(),
                category: t.category,
                type: t.type,
                isRecurring: false,
                issuer: issuer,
                isAiGenerated: true
              });
            }

            // Create current installment
            transactions.push({
              id: crypto.randomUUID(),
              description: `${t.description} (${t.currentInstallment}/${t.totalInstallments})`,
              amount: t.amount,
              date: purchaseDate.toISOString(),
              paymentDate: paymentDate.toISOString(),
              category: t.category,
              type: t.type,
              isRecurring: false,
              issuer: issuer,
              isAiGenerated: true
            });

            // Create future installments
            for (let i = 1; i <= monthsAfter; i++) {
              const futurePaymentDate = new Date(paymentDate);
              futurePaymentDate.setMonth(futurePaymentDate.getMonth() + i);

              transactions.push({
                id: crypto.randomUUID(),
                description: `${t.description} (${t.currentInstallment + i}/${t.totalInstallments})`,
                amount: t.amount,
                date: purchaseDate.toISOString(),
                paymentDate: futurePaymentDate.toISOString(),
                category: t.category,
                type: t.type,
                isRecurring: false,
                issuer: issuer,
                isAiGenerated: true
              });
            }

            return transactions;
          } else {
            // Single transaction (no installments)
            return [{
              id: crypto.randomUUID(),
              description: t.description,
              amount: t.amount,
              date: t.date,
              paymentDate: t.paymentDate || t.date,
              category: t.category,
              type: t.type,
              isRecurring: t.isRecurring || false,
              issuer: issuer,
              isAiGenerated: true
            }];
          }
        });

      return {
        normalized: filteredTransactions,
        dueDate: dueDate,
        issuer: issuer,
        tipoImportacao,
        documentType: documentType
      };
    }
    return { normalized: [], tipoImportacao };
  } catch (error) {
    logApiCall({ endpoint: 'parseImportFile', status: 'error', duration: Date.now() - startTime, error: String(error) });
    console.error("Gemini import error:", error);
    throw error;
  }
};

// 3. Insights: Analyze history and generate unlimited tips
export const generateInsights = async (transactions: Transaction[]): Promise<Insight[]> => {
  if (transactions.length === 0) return [];
  const startTime = Date.now();

  // Sort by date desc and take recent ones for relevance
  const recentTransactions = transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);
  const jsonHistory = JSON.stringify(recentTransactions);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze these financial transactions: ${jsonHistory}.
      Identify patterns, wasteful subscriptions, or high spending.
      
      Requirements:
      - Generate as many insights as necessary (do not limit to 3).
      - Be specific about values (Use BRL currency format).
      - Types: 'warning' (bad), 'tip' (neutral/advice), 'success' (good).
      - Language: Portuguese.
      - If the insight is about a specific transaction (e.g. "Netflix is expensive"), include its ID in 'relatedTransactionId'.
      - If you suggest a lower value (e.g. "Negotiate internet to R$ 100"), include 'suggestedAmount'.
      
      Return JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["warning", "tip", "success"] },
              savingsPotential: { type: Type.NUMBER, description: "Estimated savings amount if applicable, else 0" },
              relatedTransactionId: { type: Type.STRING, description: "The ID of the transaction this insight refers to, if any" },
              suggestedAmount: { type: Type.NUMBER, description: "A suggested new amount for this transaction, if applicable" }
            }
          }
        }
      }
    });

    if (response.text) {
      logApiCall({ endpoint: 'generateInsights', status: 'success', duration: Date.now() - startTime });
      const rawInsights = JSON.parse(response.text);
      return rawInsights.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
    }
    return [];
  } catch (error) {
    logApiCall({ endpoint: 'generateInsights', status: 'error', duration: Date.now() - startTime, error: String(error) });
    console.error("Gemini insights error:", error);
    return [];
  }
};

// 4. Chat with Financial Advisor
export const chatWithAdvisor = async (history: {role: string, parts: {text: string}[]}[], transactions: Transaction[]): Promise<string> => {
  const startTime = Date.now();
  const lastUserMsg = history[history.length - 1].parts[0].text.toLowerCase();

  // Define keywords and categories to look for
  const categoryKeywords: { [key: string]: string[] } = {
    [Category.FOOD]: ['comida', 'alimentação', 'restaurante', 'ifood', 'delivery', 'mercado', 'supermercado'],
    [Category.TRANSPORT]: ['transporte', 'uber', 'taxi', '99', 'gasolina', 'combustível', 'carro', 'ônibus'],
    [Category.HOUSING]: ['moradia', 'aluguel', 'casa', 'apartamento', 'condomínio'],
    [Category.UTILITIES]: ['conta', 'luz', 'água', 'energia', 'internet', 'telefone'],
    [Category.ENTERTAINMENT]: ['lazer', 'diversão', 'cinema', 'show', 'streaming', 'netflix', 'spotify'],
    [Category.HEALTH]: ['saúde', 'médico', 'farmácia', 'remédio', 'academia', 'gym'],
    [Category.SHOPPING]: ['compra', 'shopping', 'loja', 'mercadolivre', 'amazon'],
    [Category.SUBSCRIPTIONS]: ['assinatura', 'mensalidade', 'netflix', 'spotify', 'amazon prime'],
    [Category.EDUCATION]: ['educação', 'curso', 'escola', 'faculdade', 'universidade'],
    [Category.SAVINGS]: ['investimento', 'poupança', 'economia', 'reserva']
  };

  // Time-based keywords
  const timeKeywords = {
    recent: ['último', 'últimos', 'recente', 'hoje', 'ontem', 'semana', 'mês'],
    all: ['total', 'tudo', 'todos', 'todas', 'histórico', 'sempre', 'completo']
  };

  // Filter transactions based on keywords
  let relevantTransactions: Transaction[] = [];
  let useFullHistory = false;

  // Check if user wants full history
  if (timeKeywords.all.some(keyword => lastUserMsg.includes(keyword))) {
    useFullHistory = true;
    relevantTransactions = transactions;
  }

  // Check for category-specific queries
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lastUserMsg.includes(keyword))) {
      const categoryTransactions = transactions.filter(t => t.category === category);
      relevantTransactions = [...relevantTransactions, ...categoryTransactions];
    }
  }

  // Check for specific descriptions in user message
  const possibleDescriptions = transactions.map(t => t.description.toLowerCase());
  possibleDescriptions.forEach((desc, idx) => {
    if (lastUserMsg.includes(desc)) {
      relevantTransactions.push(transactions[idx]);
    }
  });

  // Remove duplicates
  relevantTransactions = Array.from(new Set(relevantTransactions.map(t => t.id)))
    .map(id => relevantTransactions.find(t => t.id === id)!)
    .filter(t => t !== undefined);

  // If no specific keywords found, use recent transactions (but more than before)
  if (relevantTransactions.length === 0) {
    relevantTransactions = transactions.slice(0, 100); // Increased from 50 to 100
  }

  // Sort by date (most recent first)
  relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Create a detailed summary
  const summary = relevantTransactions
    .slice(0, useFullHistory ? relevantTransactions.length : 200) // Limit to 200 for token efficiency
    .map(t => `${t.date}: ${t.description} - R$ ${t.amount} (${t.category})`)
    .join('\n');

  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are FinAI, a sophisticated financial advisor.
        User's transactions (${relevantTransactions.length} transactions analyzed):
        ${summary}

        Answer questions about their spending, habits, and give advice.
        Be concise, professional but friendly.
        Values are in BRL (R$).
        Language: Portuguese.
        When analyzing data, be specific and use actual numbers from the transactions.`
      },
      history: history
    });

    const response = await chat.sendMessage({ message: lastUserMsg });

    logApiCall({ endpoint: 'chatWithAdvisor', status: 'success', duration: Date.now() - startTime });
    return response.text || "Desculpe, nao entendi.";
  } catch (error) {
    logApiCall({ endpoint: 'chatWithAdvisor', status: 'error', duration: Date.now() - startTime, error: String(error) });
    console.error("Chat error:", error);
    return "Desculpe, estou com dificuldade de conexao no momento.";
  }
};

// 5. Onboarding: Calculate Goals
export const calculateBudgetGoal = async (income: number, fixedExpenses: {description: string, amount: number}[]): Promise<{ recommendedGoal: number, reasoning: string }> => {
  const startTime = Date.now();
  try {
    const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User Income: ${income}. Fixed Expenses: ${JSON.stringify(fixedExpenses)} (Total: ${fixedTotal}).
      Suggest a realistic monthly savings goal (metas). 
      Rule: 50/30/20 rule or similar, tailored to their remaining budget.
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                recommendedGoal: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
            }
        }
      }
    });
    
    if (response.text) {
        logApiCall({ endpoint: 'calculateBudgetGoal', status: 'success', duration: Date.now() - startTime });
        return JSON.parse(response.text);
    }
    return { recommendedGoal: income * 0.2, reasoning: "Estimativa baseada em 20% da renda." };
  } catch (e) {
    logApiCall({ endpoint: 'calculateBudgetGoal', status: 'error', duration: Date.now() - startTime, error: String(e) });
    return { recommendedGoal: income * 0.2, reasoning: "Padrao de 20% aplicado." };
  }
};