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
      6. **DEBTOR DETECTION**: If text mentions someone owing money (e.g. "Andressa me deve", "Patrick gastou no meu cartão", "Lanna precisa pagar"), treat as INCOME and extract:
         - debtor: person's name
         - description: what the money is for (e.g. "Almoço", "Compras", "Reembolso")
      7. **TAGS EXTRACTION**: Extract relevant tags from context (e.g. "reembolso", "viagem", "trabalho"). Return as array of strings.

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
            installments: { type: Type.INTEGER },
            debtor: { type: Type.STRING, description: "Name of person who owes money (for INCOME only)" },
            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Relevant tags for categorization" }
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
  ownerName?: string, // Optional: User's name to detect internal transfers
  userContext?: string // Optional: Additional context from user to guide AI interpretation
): Promise<{ normalized: TransacaoNormalizada[]; dueDate?: string; issuer?: string; tipoImportacao: TipoImportacao; documentType?: 'invoice' | 'bank_statement' }> => {
  const startTime = Date.now();
  try {
    const ai = getAI();
    const tipoImportacao = detectarTipoImportacao({ name: fileName, type: mimeType });

    // Validate base64 data
    if (!fileData || fileData.length === 0) {
      throw new Error('INVALID_ARGUMENT: Arquivo vazio ou inválido');
    }

    // Check approximate file size (base64 is ~33% larger than original)
    const approximateSize = (fileData.length * 0.75) / (1024 * 1024); // in MB
    console.log(`Processing file: ${fileName}, type: ${mimeType}, size: ~${approximateSize.toFixed(2)}MB`);

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

            ${userContext ? `\n⚠️ CONTEXTO ADICIONAL DO USUÁRIO (PRIORIDADE MÁXIMA):\n"${userContext}"\n\nESTE CONTEXTO DEVE GUIAR A INTERPRETAÇÃO DO DOCUMENTO. Por exemplo:\n- Se o usuário mencionar que é uma fatura de cartão específico, considere como fatura desse cartão\n- Se mencionar uma data de vencimento específica, use essa data para todas as transações\n- Se mencionar que deve ser tratado como extrato, trate como extrato mesmo que pareça fatura\n` : ''}

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

            12. **DETECT DEBTOR-TYPE INCOME** (For INCOME transactions):
                - If the description mentions someone owing money (e.g., "Andressa deve", "Patrick usou cartão", "Lanna pagar"), extract:
                  * debtor: person's name
                  * description: what the money is for (clean description)
                - Common patterns: "deve", "pagar", "reembolso de", "usou meu", etc.

            13. **EXTRACT TAGS**:
                - Extract relevant tags from descriptions (e.g., "reembolso", "viagem", "trabalho", "presente")
                - Return as array of lowercase strings without # symbol

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
                  reimbursedBy: { type: Type.STRING, description: "Name of the person who will reimburse, if available" },
                  debtor: { type: Type.STRING, description: "Name of person who owes money (for INCOME only)" },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Relevant tags for categorization" }
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
                reimbursedBy: t.reimbursedBy,
                debtor: t.debtor,
                tags: t.tags
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
              reimbursedBy: t.reimbursedBy,
              debtor: t.debtor,
              tags: t.tags
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
                reimbursedBy: t.reimbursedBy,
                debtor: t.debtor,
                tags: t.tags
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
              reimbursedBy: t.reimbursedBy,
              debtor: t.debtor,
              tags: t.tags
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
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logApiCall({ endpoint: 'parseImportFile', status: 'error', duration, error: String(error) });

    console.error("Gemini import error:", error);
    console.error("File details:", { fileName, mimeType, fileSize: fileData.length });

    // Provide more specific error messages
    if (error?.message?.includes('API_KEY_NOT_CONFIGURED')) {
      throw new Error('API_KEY_NOT_CONFIGURED');
    } else if (error?.message?.includes('INVALID_ARGUMENT')) {
      throw new Error('INVALID_ARGUMENT: O arquivo pode estar em formato incompatível ou corrompido. Tente converter para PDF ou use uma captura de tela.');
    } else if (error?.message?.includes('quota')) {
      throw new Error('Limite de uso da API atingido. Aguarde alguns minutos e tente novamente.');
    } else if (error?.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Limite de requisições excedido. Aguarde um momento e tente novamente.');
    } else {
      throw error;
    }
  }
};

// 3. Insights: Analyze history and generate intelligent, actionable tips
export const generateInsights = async (transactions: Transaction[]): Promise<Insight[]> => {
  if (transactions.length === 0) return [];
  const startTime = Date.now();

  // Sort by date desc and take recent ones for relevance
  const recentTransactions = transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 150);
  
  // Calculate financial context for smarter insights
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Group by month for trend analysis
  const monthlyData: Record<string, { income: number; expense: number; categories: Record<string, number> }> = {};
  
  recentTransactions.forEach(t => {
    const date = new Date(t.paymentDate || t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[key]) {
      monthlyData[key] = { income: 0, expense: 0, categories: {} };
    }
    
    if (t.type === TransactionType.INCOME) {
      monthlyData[key].income += t.amount;
    } else {
      monthlyData[key].expense += t.amount;
      monthlyData[key].categories[t.category] = (monthlyData[key].categories[t.category] || 0) + t.amount;
    }
  });
  
  // Get recurring subscriptions
  const subscriptions = recentTransactions.filter(t => t.isRecurring);
  const totalSubscriptions = subscriptions.reduce((sum, t) => sum + t.amount, 0);
  
  // Identify spending patterns
  const categoryTotals: Record<string, number> = {};
  recentTransactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const jsonHistory = JSON.stringify(recentTransactions.slice(0, 100));
  const contextSummary = {
    totalSubscriptions,
    subscriptionCount: subscriptions.length,
    topCategories: topCategories.map(([cat, val]) => ({ category: cat, total: val })),
    monthlyTrend: Object.entries(monthlyData).slice(0, 3).map(([month, data]) => ({
      month,
      balance: data.income - data.expense,
      topCategory: Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    }))
  };

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Você é um analista financeiro pessoal inteligente. Analise estas transações e contexto:

      TRANSAÇÕES RECENTES: ${jsonHistory}
      
      CONTEXTO CALCULADO:
      - Total em assinaturas: R$ ${totalSubscriptions.toFixed(2)} (${subscriptions.length} assinaturas)
      - Top categorias de gasto: ${topCategories.map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`).join(', ')}
      - Tendência mensal: ${JSON.stringify(contextSummary.monthlyTrend)}
      
      DATA ATUAL: ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      DIA DO MÊS: ${now.getDate()} (${now.getDate() <= 10 ? 'início' : now.getDate() <= 20 ? 'meio' : 'fim'} do mês)

      GERE INSIGHTS INTELIGENTES seguindo estas diretrizes:

      1. ANÁLISE DE PADRÕES:
         - Identifique gastos que aumentaram vs mês anterior
         - Detecte assinaturas duplicadas ou subutilizadas
         - Encontre oportunidades de economia baseadas em comportamento real

      2. INSIGHTS CONTEXTUAIS:
         - Se estamos no início do mês: foque em planejamento
         - Se estamos no fim do mês: foque em revisão e ajustes
         - Considere sazonalidade (férias, festas, etc.)

      3. TIPOS DE INSIGHT:
         - 'warning': Alerta sobre gasto excessivo, tendência negativa, risco financeiro
         - 'tip': Dica prática e acionável para economizar ou otimizar
         - 'success': Reconhecimento de bom comportamento financeiro

      4. QUALIDADE DOS INSIGHTS:
         - Seja ESPECÍFICO (mencione valores, categorias, transações)
         - Seja ACIONÁVEL (diga O QUE fazer, não apenas o problema)
         - Seja PERSONALIZADO (baseie-se nos dados reais do usuário)
         - Use linguagem NATURAL e amigável (como um amigo financeiro)

      5. PRIORIZAÇÃO:
         - Primeiro: alertas urgentes (gastos fora do padrão)
         - Segundo: oportunidades de economia significativas (>R$ 50/mês)
         - Terceiro: dicas de otimização e boas práticas

      6. FORMATO:
         - Título: curto e impactante (máx 6 palavras)
         - Descrição: 2-3 frases explicando o insight e a ação sugerida
         - Se aplicável: inclua relatedTransactionId e suggestedAmount

      EXEMPLOS DE BONS INSIGHTS:
      - "Streaming em dobro?" → "Você tem Netflix e Prime Video. Considerando que ambos têm catálogos similares, cancelar um pode economizar R$ 45/mês."
      - "Delivery disparou 📈" → "Seus gastos com iFood aumentaram 40% este mês (R$ 380 vs R$ 270). Que tal cozinhar mais em casa?"
      - "Parabéns! 🎉" → "Você reduziu gastos com transporte em 25% este mês. Continue assim!"

      Retorne um array JSON com 4-8 insights relevantes e acionáveis.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Título curto e impactante" },
              description: { type: Type.STRING, description: "Explicação detalhada com ação sugerida" },
              type: { type: Type.STRING, enum: ["warning", "tip", "success"] },
              savingsPotential: { type: Type.NUMBER, description: "Economia potencial em R$, ou 0" },
              relatedTransactionId: { type: Type.STRING, description: "ID da transação relacionada, se aplicável" },
              suggestedAmount: { type: Type.NUMBER, description: "Valor sugerido para ajuste, se aplicável" }
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
  userSettings?: {
    monthlyIncome?: number;
    savingsGoal?: number;
  };
}

// Helper: Detect user intent for smarter responses
const detectUserIntent = (message: string): {
  type: 'query' | 'advice' | 'action' | 'greeting' | 'comparison' | 'forecast';
  urgency: 'low' | 'medium' | 'high';
  topics: string[];
} => {
  const msg = message.toLowerCase();
  
  // Greeting patterns
  const greetings = ['oi', 'olá', 'ola', 'hey', 'e aí', 'eai', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem'];
  if (greetings.some(g => msg.startsWith(g) || msg === g)) {
    return { type: 'greeting', urgency: 'low', topics: [] };
  }
  
  // Query patterns (data lookup)
  const queryPatterns = ['quanto', 'qual', 'quantas', 'quantos', 'soma', 'total', 'gastei', 'recebi', 'saldo', 'mostre', 'liste'];
  
  // Advice patterns
  const advicePatterns = ['consigo', 'posso', 'devo', 'vale a pena', 'recomenda', 'sugere', 'acha', 'opina', 'conselho', 'dica', 'ajuda', 'melhor'];
  
  // Action patterns
  const actionPatterns = ['adicionar', 'criar', 'remover', 'deletar', 'mudar', 'alterar', 'cancelar'];
  
  // Comparison patterns
  const comparisonPatterns = ['comparar', 'diferença', 'versus', 'vs', 'melhor que', 'pior que', 'mais que', 'menos que'];
  
  // Forecast patterns
  const forecastPatterns = ['previsão', 'projeção', 'futuro', 'próximo mês', 'próximos meses', 'vou conseguir', 'vai dar'];
  
  // Urgency detection
  const urgentPatterns = ['urgente', 'agora', 'hoje', 'preciso', 'socorro', 'ajuda', 'problema', 'erro'];
  
  const topics: string[] = [];
  
  // Detect topics
  if (msg.includes('fatura') || msg.includes('cartão') || msg.includes('cartao')) topics.push('invoices');
  if (msg.includes('assinatura') || msg.includes('recorrente') || msg.includes('mensal')) topics.push('subscriptions');
  if (msg.includes('meta') || msg.includes('objetivo') || msg.includes('desejo') || msg.includes('wishlist')) topics.push('goals');
  if (msg.includes('economia') || msg.includes('economizar') || msg.includes('poupar')) topics.push('savings');
  if (msg.includes('gasto') || msg.includes('despesa')) topics.push('expenses');
  if (msg.includes('receita') || msg.includes('salário') || msg.includes('renda')) topics.push('income');
  
  let type: 'query' | 'advice' | 'action' | 'greeting' | 'comparison' | 'forecast' = 'query';
  
  if (forecastPatterns.some(p => msg.includes(p))) type = 'forecast';
  else if (comparisonPatterns.some(p => msg.includes(p))) type = 'comparison';
  else if (actionPatterns.some(p => msg.includes(p))) type = 'action';
  else if (advicePatterns.some(p => msg.includes(p))) type = 'advice';
  else if (queryPatterns.some(p => msg.includes(p))) type = 'query';
  
  const urgency = urgentPatterns.some(p => msg.includes(p)) ? 'high' : 
                  type === 'advice' || type === 'forecast' ? 'medium' : 'low';
  
  return { type, urgency, topics };
};

// 4. Chat with Financial Advisor - Enhanced with personality and smart context
export const chatWithAdvisor = async (
  history: {role: string, parts: {text: string}[]}[],
  transactions: Transaction[],
  context: AdvisorContext = {}
): Promise<{ text: string; cta?: ChatCTA }> => {
  const startTime = Date.now();
  const lastUserMessage = history[history.length - 1].parts[0].text;
  const lastUserMsg = lastUserMessage.toLowerCase();
  const wishlistItems = context.wishlistItems || [];
  const invoiceSummaries = context.invoiceSummaries || [];
  const invoiceFocus = context.invoiceFocus;
  const userSettings = context.userSettings;
  
  // Detect user intent for smarter responses
  const userIntent = detectUserIntent(lastUserMessage);

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
    .map(t => {
      const baseInfo = `${t.description} - R$ ${t.amount} (${t.category}) [${t.type === TransactionType.INCOME ? 'RECEITA' : 'DESPESA'}]`;
      const dateInfo = t.paymentDate && t.paymentDate !== t.date
        ? `Data: ${t.date}, Vencimento: ${t.paymentDate}`
        : `Data: ${t.date}`;
      return `${dateInfo} | ${baseInfo}`;
    })
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

  // Build dynamic personality based on context
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  
  const timeGreeting = hour < 12 ? 'bom dia' : hour < 18 ? 'boa tarde' : 'boa noite';
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isEndOfMonth = dayOfMonth >= 25;
  const isStartOfMonth = dayOfMonth <= 5;

  // Financial health score (simple calculation)
  const financialHealthScore = avgBalance > 0 
    ? Math.min(100, Math.round((avgBalance / avgIncome) * 100 * 2))
    : Math.max(0, 50 + Math.round((avgBalance / avgIncome) * 100));

  try {
    const ai = getAI();

    // Build context-aware system instruction
    const basePersonality = `Você é Fin, um assistente financeiro pessoal inteligente e amigável. 
    
    SUA PERSONALIDADE:
    - Você é como um amigo financeiramente experiente, não um robô
    - Use linguagem natural e brasileira (pode usar expressões como "show", "beleza", "tranquilo")
    - Seja empático mas honesto - não esconda problemas financeiros
    - Use emojis com moderação para tornar a conversa mais leve (1-2 por resposta)
    - Adapte seu tom: mais sério para problemas, mais leve para conquistas
    
    CONTEXTO TEMPORAL:
    - Agora: ${now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    - ${isWeekend ? '🌴 É fim de semana!' : '💼 Dia útil'}
    - ${isStartOfMonth ? '📅 Início do mês - bom momento para planejar!' : isEndOfMonth ? '⏰ Fim do mês - hora de revisar!' : ''}
    
    SAÚDE FINANCEIRA DO USUÁRIO: ${financialHealthScore}/100
    ${financialHealthScore >= 70 ? '✅ Situação saudável' : financialHealthScore >= 40 ? '⚠️ Atenção necessária' : '🚨 Situação crítica'}`;

    // Smart system instruction based on intent type
    let systemInstruction: string;
    
    if (userIntent.type === 'greeting') {
      systemInstruction = `${basePersonality}
      
      O usuário está te cumprimentando. Responda de forma amigável e proativa:
      1. Cumprimente de volta (${timeGreeting}!)
      2. Dê um resumo rápido da situação financeira atual
      3. Sugira uma ação útil baseada no contexto (ex: "quer ver como estão suas metas?" ou "posso te mostrar os próximos vencimentos")
      
      CONTEXTO FINANCEIRO: ${snapshotText}
      
      Seja breve (2-3 frases) e acolhedor.`;
      
    } else if (userIntent.type === 'query') {
      systemInstruction = `${basePersonality}

        MODO: CONSULTA DE DADOS 📊

        CONTEXTO FINANCEIRO (últimos meses): ${snapshotText}

        TRANSAÇÕES RELEVANTES (${relevantTransactions.length} analisadas):
        ${summary}

        CONTEXTO DO APP:
        📋 Lista de Desejos: ${wishlistSummary || 'vazia'}
        📅 Próximos Pagamentos: ${paymentSummary || 'nenhum'}
        💳 Faturas: ${invoiceSummaryText || 'nenhuma'}
        ${invoiceFocusText ? `\n${invoiceFocusText}` : ''}

        REGRAS PARA CONSULTAS:
        1. Responda de forma DIRETA e PRECISA
        2. Use formatação clara (bullets se necessário)
        3. Sempre especifique o período dos dados
        4. Se não encontrar dados, sugira onde procurar
        
        FILTROS DE DATA:
        - "Data:" = data da compra/transação
        - "Vencimento:" = data de pagamento
        - Use o campo apropriado baseado na pergunta
        
        TIPOS DE TRANSAÇÃO:
        - [RECEITA] = entradas de dinheiro
        - [DESPESA] = saídas de dinheiro
        
        Formato: Resposta direta + dados relevantes. Sem conselhos não solicitados.
        Valores em R$ (BRL).`;
        
    } else if (userIntent.type === 'advice' || userIntent.type === 'forecast') {
      systemInstruction = `${basePersonality}

        MODO: CONSULTORIA FINANCEIRA 🎯

        CONTEXTO FINANCEIRO: ${snapshotText}
        
        ${userSettings?.monthlyIncome ? `Renda declarada: R$ ${userSettings.monthlyIncome.toFixed(2)}` : ''}
        ${userSettings?.savingsGoal ? `Meta de economia: R$ ${userSettings.savingsGoal.toFixed(2)}/mês` : ''}

        TRANSAÇÕES RELEVANTES:
        ${summary}

        📋 LISTA DE DESEJOS (${wishlistItems.length} itens):
        ${wishlistSummary || 'nenhum desejo cadastrado.'}
        ${wishlistConflicts}
        Compromisso mensal com parcelas: R$ ${totalWishlistCommitment.toFixed(2)} (${avgIncome > 0 ? ((totalWishlistCommitment / avgIncome) * 100).toFixed(1) : 0}% da renda)

        📅 AGENDA (${paymentsContext.length} pagamentos):
        ${paymentSummary || 'sem vencimentos.'}

        💳 FATURAS (${invoiceSummaries.length}):
        ${invoiceSummaryText || 'nenhuma.'}
        ${invoiceFocusText ? `\n${invoiceFocusText}` : ''}

        DIRETRIZES DE CONSULTORIA:

        1. ANÁLISE HOLÍSTICA:
           - Considere TODOS os compromissos existentes
           - Avalie impacto no fluxo de caixa dos próximos 3 meses
           - Identifique conflitos entre objetivos

        2. SEJA HONESTO E REALISTA:
           - Se não é viável, diga claramente (mas com empatia)
           - Ofereça alternativas concretas
           - Use números reais, não estimativas vagas

        3. FORMATO DE RESPOSTA:
           a) Veredito direto (1 frase clara)
           b) Análise de impacto (2-3 bullets com números)
           c) Recomendação prática (o que fazer agora)
           d) Se relevante: alternativas ou próximos passos

        4. PARA RECOMENDAÇÕES DE COMPRA:
           - Avalie se cabe no orçamento atual
           - Compare com outros objetivos da wishlist
           - Sugira adicionar à wishlist se fizer sentido
           - CTA: 'CTA: {"type":"wishlist_add","name":"ITEM","rationale":"motivo","suggestedPrice":1234.56}'

        Máximo 150 palavras. Seja direto mas humano.`;
        
    } else if (userIntent.type === 'comparison') {
      systemInstruction = `${basePersonality}

        MODO: ANÁLISE COMPARATIVA 📈

        CONTEXTO: ${snapshotText}
        
        TRANSAÇÕES: ${summary}
        
        WISHLIST: ${wishlistSummary || 'vazia'}
        
        REGRAS:
        1. Compare dados de forma clara e visual
        2. Use percentuais e variações
        3. Destaque tendências (↑ aumentou, ↓ diminuiu, → estável)
        4. Conclua com insight acionável
        
        Formato: Comparação clara + conclusão prática.`;
        
    } else {
      // Default: balanced response
      systemInstruction = `${basePersonality}

        CONTEXTO FINANCEIRO: ${snapshotText}

        TRANSAÇÕES: ${summary}

        📋 WISHLIST: ${wishlistSummary || 'vazia'}
        📅 AGENDA: ${paymentSummary || 'vazia'}
        💳 FATURAS: ${invoiceSummaryText || 'nenhuma'}
        ${invoiceFocusText || ''}

        REGRAS:
        1. Entenda a intenção do usuário
        2. Responda de forma útil e contextualizada
        3. Seja proativo mas não invasivo
        4. Ofereça próximos passos quando relevante
        
        CTA opcional: 'CTA: {"type":"wishlist_add","name":"ITEM","rationale":"motivo","suggestedPrice":1234.56}'
        
        Máximo 120 palavras. Valores em R$.`;
    }

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
