import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, TransactionType, Insight, TipoImportacao, TransacaoNormalizada, WishlistItem, ChatCTA } from '../types';
import { detectarTipoImportacao, normalizarTransacaoGenerica, isPagamentoFaturaDescription, isLikelyInternalTransfer, parseSpreadsheet } from '../utils/importUtils';
import { logApiCall } from './storageService';
import { parseLocalDate } from '../utils/dateUtils';

// Get API Key from localStorage
const getApiKey = (): string | null => {
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY;
  if (envKey) return envKey;
  return localStorage.getItem('finai_gemini_api_key');
};

// Initialize Gemini Client (lazy initialization)
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }

  return ai;
};

// Reset AI instance when API key changes
export const resetAIInstance = () => {
  ai = null;
};  

// 1. Smart Entry: Parse natural language into a Transaction object
export const parseTransactionFromText = async (text: string): Promise<Partial<Transaction> & { installments?: number }> => {
  const startTime = Date.now();
  try {
    const ai = getAI();
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
    const ai = getAI();
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

            11. **DETECT REIMBURSABLE EXPENSES**:
                - If the description hints someone used the user's card and will pay back (e.g., "paguei para amiga me reembolsar", "fulana usou meu cartao", "reembolso no vencimento"), mark isReimbursable=true.
                - Capture the person's name in 'reimbursedBy' when present.
                - Keep as EXPENSE, set paymentDate as usual (invoice due date if available).

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
                  ignoreReason: { type: Type.STRING, enum: ["internal_transfer", "invoice_payment", "balance_info", null], description: "Reason to ignore this transaction" },
                  isReimbursable: { type: Type.BOOLEAN, description: "True if someone else will reimburse the user" },
                  reimbursedBy: { type: Type.STRING, description: "Name of the person who will reimburse, if available" }
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
                isAiGenerated: true,
                isReimbursable: !!t.isReimbursable,
                reimbursedBy: t.reimbursedBy
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
              isAiGenerated: true,
              isReimbursable: !!t.isReimbursable,
              reimbursedBy: t.reimbursedBy
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
                isAiGenerated: true,
                isReimbursable: !!t.isReimbursable,
                reimbursedBy: t.reimbursedBy
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
              isAiGenerated: true,
              isReimbursable: !!t.isReimbursable,
              reimbursedBy: t.reimbursedBy
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
    const ai = getAI();
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

interface AdvisorContext {
  wishlistItems?: WishlistItem[];
  upcomingPayments?: {
    title: string;
    amount: number;
    dueDate: string;
    category?: string;
    type: TransactionType;
    status?: 'pending' | 'paid' | 'overdue';
    source?: 'transaction' | 'invoice';
  }[];
  invoiceSummaries?: {
    title: string;
    issuer?: string;
    dueDate?: string;
    amount: number;
    itemCount?: number;
    currentMonthTotal?: number;
  }[];
  invoiceFocus?: {
    title: string;
    issuer?: string;
    dueDate?: string;
    amount: number;
    items: {
      description: string;
      amount: number;
      category?: string;
      date?: string;
      paymentDate?: string;
      type?: TransactionType;
      isRecurring?: boolean;
      linkedToInvoice?: boolean;
      issuer?: string;
    }[];
  };
}

// 4. Chat with Financial Advisor
export const chatWithAdvisor = async (
  history: {role: string, parts: {text: string}[]}[],
  transactions: Transaction[],
  context: AdvisorContext = {}
): Promise<{ text: string; cta?: ChatCTA }> => {
  const startTime = Date.now();
  const lastUserMsg = history[history.length - 1].parts[0].text.toLowerCase();
  const wishlistItems = context.wishlistItems || [];
  const invoiceSummaries = context.invoiceSummaries || [];
  const invoiceFocus = context.invoiceFocus;

  // Default agenda/payments window (next 60 days)
  const fallbackUpcoming = (() => {
    const now = new Date();
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 2);

    return transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .filter(t => {
        const due = new Date(t.paymentDate || t.date);
        return due >= now && due <= horizon;
      })
      .sort((a, b) => new Date(a.paymentDate || a.date).getTime() - new Date(b.paymentDate || b.date).getTime())
      .slice(0, 12)
      .map(t => ({
        title: t.description,
        amount: t.amount,
        dueDate: t.paymentDate || t.date,
        category: t.category,
        type: t.type,
        source: (t.issuer || (t.isCreditPurchase && t.creditCardIssuer)) ? 'invoice' : 'transaction'
      }));
  })();

  const paymentsContext = (context.upcomingPayments && context.upcomingPayments.length > 0)
    ? context.upcomingPayments
    : fallbackUpcoming;

  // Quick snapshot (last 3 months, usando paymentDate se existir)
  const monthlyBuckets: Record<string, { income: number; expense: number }> = {};
  transactions.forEach(t => {
    const effectiveDate = new Date(t.paymentDate || t.date);
    const ym = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyBuckets[ym]) {
      monthlyBuckets[ym] = { income: 0, expense: 0 };
    }
    if (t.type === TransactionType.INCOME) {
      monthlyBuckets[ym].income += t.amount;
    } else {
      monthlyBuckets[ym].expense += t.amount;
    }
  });

  const sortedMonths = Object.keys(monthlyBuckets).sort((a, b) => new Date(b + '-01').getTime() - new Date(a + '-01').getTime());
  const recentMonths = sortedMonths.slice(0, 3);
  const recentStats = recentMonths.map(m => {
    const data = monthlyBuckets[m];
    return { month: m, income: data.income, expense: data.expense, balance: data.income - data.expense };
  });

  const avgIncome = recentStats.length ? recentStats.reduce((s, m) => s + m.income, 0) / recentStats.length : 0;
  const avgExpense = recentStats.length ? recentStats.reduce((s, m) => s + m.expense, 0) / recentStats.length : 0;
  const avgBalance = avgIncome - avgExpense;

  const snapshotText = recentStats.length
    ? `Média 3m: receita R$ ${avgIncome.toFixed(2)}, despesa R$ ${avgExpense.toFixed(2)}, saldo R$ ${avgBalance.toFixed(2)}. Meses: ${recentStats.map(m => `${m.month} (R$ ${m.income.toFixed(0)} vs R$ ${m.expense.toFixed(0)} = R$ ${m.balance.toFixed(0)})`).join(' | ')}`
    : 'Sem histórico suficiente para média.';

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
    .map(t => `${t.date}: ${t.description} - R$ ${t.amount} (${t.category}) [${t.type === TransactionType.INCOME ? 'RECEITA' : 'DESPESA'}]`)
    .join('\n');

  // Enrich context with wishlist, agenda and invoices - HOLISTIC ANALYSIS
  const wishlistMatches = wishlistItems.filter(item => lastUserMsg.includes(item.name.toLowerCase()));
  const wishlistForPrompt = (wishlistMatches.length ? wishlistMatches : wishlistItems).slice(0, 10);

  // Calculate total commitment from wishlist
  const totalWishlistCommitment = wishlistItems.reduce((sum, item) => {
    if (item.paymentOption === 'installments' && item.installmentAmount) {
      return sum + item.installmentAmount;
    }
    return sum;
  }, 0);

  const wishlistSummary = wishlistForPrompt
    .map(item => {
      const progress = item.targetAmount > 0 ? Math.round((item.savedAmount / item.targetAmount) * 100) : 0;
      const remaining = item.targetAmount - item.savedAmount;
      const viability = item.isViable ? 'viavel' : item.viabilityDate ? `planejando (viavel em ${item.viabilityDate})` : 'planejando';
      const installments = item.paymentOption === 'installments' && item.installmentCount && item.installmentAmount
        ? ` | ${item.installmentCount}x de R$ ${item.installmentAmount.toFixed(2)}`
        : '';
      const priority = item.priority ? ` | prioridade ${item.priority}` : '';
      return `${item.name} -> alvo R$ ${item.targetAmount.toFixed(2)}, guardado R$ ${item.savedAmount.toFixed(2)} (${progress}%), falta R$ ${remaining.toFixed(2)}, status ${viability}${installments}${priority}`;
    })
    .join('\n');

  // Wishlist conflict analysis
  const wishlistConflicts = totalWishlistCommitment > avgIncome * 0.3
    ? `⚠️ ALERTA: Compromisso total com parcelas da wishlist (R$ ${totalWishlistCommitment.toFixed(2)}) excede 30% da renda média!`
    : '';

  const paymentSummary = paymentsContext
    .slice(0, 15)
    .map(p => `${p.dueDate}: ${p.title} - R$ ${p.amount.toFixed(2)} (${p.category || 'Sem categoria'}) [${p.source || 'transaction'}]`)
    .join('\n');

  const invoiceSummaryText = invoiceSummaries
    .slice(0, 6)
    .map(inv => `${inv.title || 'Fatura'} (${inv.issuer || 'Cartao'}), venc ${inv.dueDate || 'sem data'}, total R$ ${inv.amount.toFixed(2)}, mes atual R$ ${(inv.currentMonthTotal ?? inv.amount).toFixed(2)}, itens ${inv.itemCount ?? 'n/d'}`)
    .join('\n');

  const invoiceFocusText = invoiceFocus
    ? `Fatura em foco: ${invoiceFocus.title} (${invoiceFocus.issuer || 'Cartao'}), venc ${invoiceFocus.dueDate || 'sem data'}, total R$ ${invoiceFocus.amount.toFixed(2)}. Itens:\n${invoiceFocus.items.slice(0, 40).map(item => `${item.paymentDate || item.date || 's/data'}: ${item.description} - R$ ${(item.amount || 0).toFixed(2)} (${item.category || 'Sem categoria'})`).join('\n')}`
    : '';

  // Detect question type for smarter responses
  const isSimpleDataQuery = (() => {
    const dataQueryKeywords = [
      'quanto', 'qual', 'quantas', 'quantos', 'soma', 'total', 'gastei',
      'recebi', 'saldo', 'quanto foi', 'mostre', 'liste', 'quais foram',
      'receita', 'receitas', 'recebimento', 'recebimentos', 'despesa', 'despesas'
    ];
    const adviceKeywords = [
      'consigo comprar', 'posso comprar', 'devo comprar', 'vale a pena',
      'recomenda', 'sugere', 'acha', 'opina', 'conselho', 'dica', 'ajuda'
    ];

    const hasDataKeyword = dataQueryKeywords.some(kw => lastUserMsg.includes(kw));
    const hasAdviceKeyword = adviceKeywords.some(kw => lastUserMsg.includes(kw));

    // It's a simple query if it has data keywords but NO advice keywords
    return hasDataKeyword && !hasAdviceKeyword;
  })();

  try {
    const ai = getAI();

    // Smart system instruction based on query type
    const systemInstruction = isSimpleDataQuery
      ? `Voce e FinAI, assistente financeiro para consultas de dados.

        CONTEXTO FINANCEIRO (ultimos meses): ${snapshotText}

        TRANSAÇÕES RELEVANTES (${relevantTransactions.length} analisadas):
        ${summary}

        CONTEXTO EXTRA DO APP:

        📋 LISTA DE DESEJOS (${wishlistItems.length} itens):
        ${wishlistSummary || 'nenhum desejo cadastrado.'}

        📅 AGENDA/PAGAMENTOS proximos (${paymentsContext.length}):
        ${paymentSummary || 'sem vencimentos relevantes.'}

        💳 FATURAS importadas (${invoiceSummaries.length}):
        ${invoiceSummaryText || 'nenhuma fatura salva.'}
        ${invoiceFocusText ? `\n${invoiceFocusText}` : ''}

        REGRAS PARA CONSULTAS DE DADOS:
        1. Responda APENAS o que foi perguntado
        2. Seja direto e objetivo (máximo 2-3 frases)
        3. NÃO dê conselhos ou recomendações não solicitadas
        4. NÃO mencione "impacto no fluxo de caixa" ou análises financeiras
        5. Se não encontrar dados específicos, diga claramente e sugira verificar filtros/período
        6. IMPORTANTE: Cada transação é marcada como [RECEITA] ou [DESPESA]
           - Para perguntas sobre "receitas", "recebimentos", "recebi": filtre APENAS [RECEITA]
           - Para perguntas sobre "despesas", "gastos", "gastei": filtre APENAS [DESPESA]
           - Sempre especifique se são receitas ou despesas na resposta

        Formato de resposta:
        - Resposta direta à pergunta em 1-2 frases
        - Se aplicável, liste os valores encontrados com seus tipos (receita/despesa)
        - Apenas dados, sem análise ou conselhos

        Valores sempre em BRL (R$).`
      : `Voce e FinAI, assistente financeiro central com visao holistica. Voce enxerga transacoes, lista de desejos inteligentes e agenda de pagamentos.

        CONTEXTO FINANCEIRO (ultimos meses): ${snapshotText}

        TRANSAÇÕES RELEVANTES (${relevantTransactions.length} analisadas):
        ${summary}

        CONTEXTO EXTRA DO APP:

        📋 LISTA DE DESEJOS (${wishlistItems.length} itens):
        ${wishlistSummary || 'nenhum desejo cadastrado.'}
        ${wishlistConflicts}

        Compromisso mensal total com parcelas: R$ ${totalWishlistCommitment.toFixed(2)} (${((totalWishlistCommitment / avgIncome) * 100).toFixed(1)}% da renda média)

        📅 AGENDA/PAGAMENTOS proximos (${paymentsContext.length}):
        ${paymentSummary || 'sem vencimentos relevantes.'}

        💳 FATURAS importadas (${invoiceSummaries.length}):
        ${invoiceSummaryText || 'nenhuma fatura salva.'}
        ${invoiceFocusText ? `\n${invoiceFocusText}` : ''}

        REGRAS DE ANÁLISE HOLÍSTICA:

        1. WISHLIST - Análise integrada:
           - Verifique se múltiplos itens competem pelos mesmos recursos
           - Alerte se compromisso total com parcelas > 30% da renda
           - Sugira priorização baseada em urgência e viabilidade
           - Identifique conflitos (ex: 3 itens parcelados ao mesmo tempo)

        2. PERGUNTAS sobre metas/desejos:
           - Informe valor alvo, quanto já foi guardado, forma de pagamento
           - Se houver múltiplos itens, compare e priorize
           - Calcule impacto combinado no orçamento

        3. PERGUNTAS sobre faturas/pagamentos:
           - Priorize fatura em foco quando houver
           - Detalhe valores e vencimentos
           - Correlacione com wishlist se relevante

        4. RECOMENDAÇÕES de compra:
           - SEMPRE inclua CTA para adicionar à wishlist
           - Avalie impacto considerando compromissos existentes
           - Seja honesto sobre priorização vs. outros itens

        5. FORMATO DE RESPOSTA (max 120 palavras):
           a) Veredito direto em 1 frase
           b) 2-3 bullets sobre impacto no fluxo de caixa e % da renda
           c) 2 bullets de recomendações práticas
           d) Se aplicável, análise de conflitos com outros objetivos

        Valores sempre em BRL (R$). Seja direto, honesto e prático.

        CTA opcional (no final): 'CTA: {"type":"wishlist_add","name":"ITEM","rationale":"motivo","suggestedPrice":1234.56}'`;

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemInstruction
      },
      history: history
    });

      const response = await chat.sendMessage({ message: lastUserMsg });

      const rawText = response.text || "Desculpe, nao entendi.";
      let cta: ChatCTA | undefined;

      const cleanedLines: string[] = [];
      rawText.split('\n').forEach(line => {
        const match = line.trim().match(/^CTA:\s*(\{.*\})/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed?.type === 'wishlist_add' && parsed?.name) {
              cta = {
                type: 'wishlist_add',
                name: parsed.name,
                rationale: parsed.rationale,
                suggestedPrice: parsed.suggestedPrice
              };
            }
          } catch (e) {
            console.warn('Failed to parse CTA', e);
          }
        } else {
          cleanedLines.push(line);
        }
      });

      const finalText = cleanedLines.join('\n').trim();

      logApiCall({ endpoint: 'chatWithAdvisor', status: 'success', duration: Date.now() - startTime });
      return { text: finalText, cta };
    } catch (error) {
      logApiCall({ endpoint: 'chatWithAdvisor', status: 'error', duration: Date.now() - startTime, error: String(error) });
      console.error("Chat error:", error);
      return { text: "Desculpe, estou com dificuldade de conexao no momento." };
    }
  };

// 5. Onboarding: Calculate Goals
export const calculateBudgetGoal = async (income: number, fixedExpenses: {description: string, amount: number}[]): Promise<{ recommendedGoal: number, reasoning: string }> => {
  const startTime = Date.now();
  try {
    const fixedTotal = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const ai = getAI();
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

// 6. Wishlist: Research product/service price
export const researchWishlistItem = async (itemName: string): Promise<{
  estimatedPrice: number;
  priceRange: { min: number; max: number };
  description: string;
  suggestions: string[];
  confidence: 'high' | 'medium' | 'low';
}> => {
  const startTime = Date.now();
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `O usuário deseja adicionar "${itemName}" à lista de desejos.

      Sua tarefa:
      1. Identifique o que é este item (produto, viagem, experiência, serviço, etc.)
      2. Pesquise e estime o preço médio atual no Brasil em Reais (R$) baseado em dados de mercado de ${new Date().getFullYear()}
      3. Forneça uma faixa de preço (mínimo e máximo) realista
      4. Dê uma breve descrição do item
      5. Forneça 2-3 sugestões práticas e específicas para o usuário
      6. Indique o nível de confiança da estimativa:
         - 'high': produto comum com preço bem definido e fontes confiáveis
         - 'medium': preço variável mas estimável com boa margem
         - 'low': item muito genérico, sem informações claras ou desatualizado

      IMPORTANTE - Contexto temporal e sazonal:
      - Data atual: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      - Mês atual: ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}
      - Considere APENAS dados de ${new Date().getFullYear()} e ${new Date().getFullYear() - 1}
      - Identifique se há promoções sazonais próximas (Black Friday em novembro, Natal em dezembro, etc.)
      - Para viagens: considere alta/baixa temporada

      Casos especiais:
      - VIAGEM: calcule custo total incluindo passagens (ida/volta), hospedagem (3-5 dias médio), alimentação (~R$ 80-150/dia), passeios (2-3 principais)
      - EXPERIÊNCIA: estime custo total da experiência completa (ingresso + extras)
      - Produto GENÉRICO (ex: "celular"): use preço médio de modelos populares atuais
      - Produto ESPECÍFICO: seja preciso no modelo e ano

      Diretrizes de qualidade:
      - Se não tiver certeza do preço, seja honesto e marque confidence='low'
      - Prefira subestimar a superestimar (melhor surpreender positivamente)
      - Mencione se o preço pode variar muito por região/época
      - Se aplicável, sugira alternativas mais baratas

      Retorne JSON com as informações.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedPrice: { type: Type.NUMBER, description: "Preço médio estimado em R$" },
            priceRange: {
              type: Type.OBJECT,
              properties: {
                min: { type: Type.NUMBER },
                max: { type: Type.NUMBER }
              }
            },
            description: { type: Type.STRING, description: "Descrição breve do item" },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 dicas práticas"
            },
            confidence: { type: Type.STRING, enum: ["high", "medium", "low"] }
          }
        }
      }
    });

    if (response.text) {
      logApiCall({ endpoint: 'researchWishlistItem', status: 'success', duration: Date.now() - startTime });
      return JSON.parse(response.text);
    }

    throw new Error("No response from AI");
  } catch (error) {
    logApiCall({ endpoint: 'researchWishlistItem', status: 'error', duration: Date.now() - startTime, error: String(error) });
    console.error("Research error:", error);
    // Fallback response
    return {
      estimatedPrice: 0,
      priceRange: { min: 0, max: 0 },
      description: "Não foi possível estimar o preço automaticamente. Por favor, insira manualmente.",
      suggestions: ["Pesquise em sites de comparação de preços", "Aguarde promoções sazonais"],
      confidence: 'low'
    };
  }
};

// 7. Wishlist: Analyze viability with payment options
export const analyzeWishlistViability = async (
  itemName: string,
  targetAmount: number,
  monthlyIncome: number,
  monthlyExpenses: number,
  paymentOption: 'cash' | 'installments',
  installmentCount?: number
): Promise<{
  isViable: boolean;
  viabilityDate: string | null;
  analysis: string;
  recommendation: string;
  monthsNeeded: number;
  installmentAmount?: number;
  installmentImpact?: string;
}> => {
  const startTime = Date.now();
  try {
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const installmentAmount = installmentCount ? targetAmount / installmentCount : 0;
    const ai = getAI();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analise a viabilidade deste objetivo financeiro com critérios realistas:

      CONTEXTO FINANCEIRO:
      Item: ${itemName}
      Valor Total: R$ ${targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      Renda Mensal: R$ ${monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      Despesas Mensais (média): R$ ${monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      Disponível Mensal: R$ ${monthlySavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

      Forma de Pagamento: ${paymentOption === 'cash' ? 'À Vista (economizar até ter o valor total)' : `Parcelado em ${installmentCount}x parcelas`}
      ${paymentOption === 'installments' ? `Valor da Parcela: R$ ${installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${((installmentAmount / monthlySavings) * 100).toFixed(1)}% do disponível mensal)` : ''}

      Data Atual: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}

      DIRETRIZES DE ANÁLISE:

      1. VIABILIDADE (seja REALISTA, não otimista demais):
         - À Vista: considere que a pessoa consegue poupar REALISTICAMENTE 50% do disponível mensal (não 100%)
         - Parcelado: parcela NÃO deve exceder 25% do disponível mensal (deixar margem de segurança)
         - Se comprometer >25% do disponível = NÃO viável agora

      2. CÁLCULO DE TEMPO:
         - Use CENÁRIO REALISTA: pessoa poupa 50% do disponível
         - Arredonde para cima (seja conservador)
         - Considere buffer de segurança

      3. ANÁLISE (2-3 frases):
         - Seja direto e honesto
         - Mencione o percentual de impacto no orçamento
         - Indique se há risco de comprometer finanças

      4. RECOMENDAÇÃO PRÁTICA:
         - Se viável: dicas para acelerar (economias extras)
         - Se não viável: alternativas concretas (aumentar renda, reduzir meta, parcelar em mais vezes)
         - Mencione possibilidade de negociar desconto à vista

      5. ${paymentOption === 'installments' ? 'ANÁLISE DE PARCELAS: Calcule percentual do disponível mensal, compare com a regra dos 25%, alerte se comprometer muito o orçamento' : ''}

      CRITÉRIOS CONSERVADORES:
      - Viável = impacto <= 25% do disponível mensal
      - Planejável = impacto 26-40% (requer cuidado)
      - Arriscado = impacto > 40% (não recomendado)

      Retorne JSON com análise detalhada e honesta.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isViable: { type: Type.BOOLEAN },
            viabilityDate: { type: Type.STRING, description: "Data ISO quando será viável, ou null se já for viável" },
            analysis: { type: Type.STRING, description: "Análise objetiva em 1-2 frases" },
            recommendation: { type: Type.STRING, description: "Recomendação prática" },
            monthsNeeded: { type: Type.INTEGER, description: "Meses necessários para alcançar" },
            installmentAmount: { type: Type.NUMBER, description: "Valor da parcela (se parcelado)" },
            installmentImpact: { type: Type.STRING, description: "Análise do impacto da parcela (se parcelado)" }
          }
        }
      }
    });

    if (response.text) {
      logApiCall({ endpoint: 'analyzeWishlistViability', status: 'success', duration: Date.now() - startTime });
      return JSON.parse(response.text);
    }

    throw new Error("No response from AI");
  } catch (error) {
    logApiCall({ endpoint: 'analyzeWishlistViability', status: 'error', duration: Date.now() - startTime, error: String(error) });
    console.error("Viability analysis error:", error);

    // Fallback calculation
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const monthsNeeded = monthlySavings > 0 ? Math.ceil(targetAmount / monthlySavings) : 999;
    const viabilityDate = new Date();
    viabilityDate.setMonth(viabilityDate.getMonth() + monthsNeeded);

    return {
      isViable: monthsNeeded <= 3,
      viabilityDate: monthsNeeded > 3 ? viabilityDate.toISOString() : null,
      analysis: monthlySavings > 0
        ? `Você precisará economizar por ${monthsNeeded} meses para alcançar este objetivo.`
        : "Suas despesas excedem sua renda. Revise seu orçamento antes de fazer novos planos.",
      recommendation: "Considere aumentar sua renda ou reduzir despesas para acelerar.",
      monthsNeeded,
      installmentAmount: installmentCount ? targetAmount / installmentCount : undefined,
      installmentImpact: installmentCount ? "Análise indisponível no momento." : undefined
    };
  }
};
