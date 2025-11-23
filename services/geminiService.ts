import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, TransactionType, Insight } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 1. Smart Entry: Parse natural language into a Transaction object
export const parseTransactionFromText = async (text: string): Promise<Partial<Transaction> & { installments?: number }> => {
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
      const data = JSON.parse(response.text);
      return {
        ...data,
        id: crypto.randomUUID(),
      };
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini parse error:", error);
    throw error;
  }
};

// 2. Import Tool: Parse File Content (Base64 or Text)
export const parseImportFile = async (fileData: string, mimeType: string): Promise<Transaction[]> => {
  try {
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
            
            CRITICAL RULES:
            1. **INVOICE DUE DATE**: Search the document for the "Data de Vencimento" or "Vencimento" (Due Date) of the Invoice/Bill. 
               - If found, set 'paymentDate' of ALL extracted items to this Due Date.
               - If NOT found (e.g. bank statement), 'paymentDate' should be the same as 'date'.
            2. Ignore totals, sub-totals, or balance lines. Only extract individual purchases/transfers.
            3. **SANITIZE DESCRIPTIONS**: Shorten and clean merchant names (e.g., "MERCADOLIVRE*VENDEDOR" -> "Mercado Livre").
            4. Detect if it is Income or Expense based on context (negative signs usually expense, or "Crédito").
            5. Map categories intelligently.
            
            Return a JSON array of transactions.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD (Date of purchase)" },
              paymentDate: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD (Invoice Due Date or Payment Date)" },
              category: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] }
            }
          }
        }
      }
    });

    if (response.text) {
      const raw = JSON.parse(response.text);
      return raw.map((t: any) => ({
        ...t,
        id: crypto.randomUUID(),
        isRecurring: false
      }));
    }
    return [];
  } catch (error) {
    console.error("Gemini import error:", error);
    throw error;
  }
};

// 3. Insights: Analyze history and generate unlimited tips
export const generateInsights = async (transactions: Transaction[]): Promise<Insight[]> => {
  if (transactions.length === 0) return [];

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
              savingsPotential: { type: Type.NUMBER, description: "Estimated savings amount if applicable, else 0" }
            }
          }
        }
      }
    });

    if (response.text) {
      const rawInsights = JSON.parse(response.text);
      return rawInsights.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
    }
    return [];
  } catch (error) {
    console.error("Gemini insights error:", error);
    return [];
  }
};

// 4. Chat with Financial Advisor
export const chatWithAdvisor = async (history: {role: string, parts: {text: string}[]}[], transactions: Transaction[]): Promise<string> => {
  // Pass a summary instead of full history to save tokens but keep context
  const summary = transactions.slice(0, 50).map(t => `${t.date}: ${t.description} (${t.amount})`).join('\n');
  
  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are FinAI, a sophisticated financial advisor. 
        User's recent transactions: 
        ${summary}
        
        Answer questions about their spending, habits, and give advice. 
        Be concise, professional but friendly. 
        Values are in BRL (R$).
        Language: Portuguese.`
      },
      history: history
    });

    const lastUserMsg = history[history.length - 1].parts[0].text;
    const response = await chat.sendMessage({ message: lastUserMsg });
    
    return response.text || "Desculpe, não entendi.";
  } catch (error) {
    console.error("Chat error:", error);
    return "Desculpe, estou com dificuldade de conexão no momento.";
  }
};

// 5. Onboarding: Calculate Goals
export const calculateBudgetGoal = async (income: number, fixedExpenses: {description: string, amount: number}[]): Promise<{ recommendedGoal: number, reasoning: string }> => {
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
    
    if (response.text) return JSON.parse(response.text);
    return { recommendedGoal: income * 0.2, reasoning: "Estimativa baseada em 20% da renda." };
  } catch (e) {
    return { recommendedGoal: income * 0.2, reasoning: "Padrão de 20% aplicado." };
  }
};