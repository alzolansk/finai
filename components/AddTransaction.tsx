import React, { useState, useRef } from 'react';
import { Category, Transaction, TransactionType } from '../types';
import { parseTransactionFromText, parseImportFile } from '../services/geminiService';
import { generateInvoiceFingerprint, isInvoiceAlreadyImported, saveImportedInvoice } from '../services/storageService';
import { Mic, Send, Loader2, Wand2, Check, Layers, Upload, FileText, X, AlertTriangle } from 'lucide-react';

interface AddTransactionProps {
  onAdd: (transactions: Transaction[]) => void;
  onCancel: () => void;
  existingTransactions?: Transaction[];
}

const AddTransaction: React.FC<AddTransactionProps> = ({ onAdd, onCancel, existingTransactions = [] }) => {
  const [mode, setMode] = useState<'ai' | 'manual' | 'import'>('ai');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importDueDate, setImportDueDate] = useState<string | null>(null);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ dueDate: string; importedAt: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staging for logic that handles multiple installments
  const [detectedInstallments, setDetectedInstallments] = useState(1);

  const [formData, setFormData] = useState<Partial<Transaction>>({
    description: '',
    amount: 0,
    category: Category.OTHER,
    type: TransactionType.EXPENSE,
    date: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0], // Default payment date is today
    isRecurring: false
  });

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const result = await parseTransactionFromText(inputText);
      if (result) {
        setFormData({
          ...result,
          date: result.date ? new Date(result.date).toISOString().split('T')[0] : formData.date,
          // If AI detected a payment date, use it, else default to date or today
          paymentDate: result.paymentDate ? new Date(result.paymentDate).toISOString().split('T')[0] : (result.date || formData.date)
        });
        setDetectedInstallments(result.installments || 1);
        setMode('manual');
      }
    } catch (error) {
      setMode('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportSuccess(false);
    setDuplicateDetected(false);
    setDuplicateInfo(null);
    setImportDueDate(null);
    const reader = new FileReader();

    reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];

        try {
            const result = await parseImportFile(base64Data, file.type, existingTransactions);
            if (result.transactions.length > 0) {
                // Generate fingerprint for this invoice
                const fingerprint = generateInvoiceFingerprint(result.dueDate || null, result.transactions);

                // Check if already imported
                const existingInvoice = isInvoiceAlreadyImported(fingerprint);

                if (existingInvoice) {
                    // Duplicate detected!
                    setDuplicateDetected(true);
                    setDuplicateInfo({
                        dueDate: existingInvoice.dueDate,
                        importedAt: existingInvoice.importedAt
                    });
                    setLoading(false);
                } else {
                    // Not a duplicate, proceed with import
                    // Save invoice record
                    saveImportedInvoice({
                        id: crypto.randomUUID(),
                        dueDate: result.dueDate || 'no-date',
                        totalAmount: result.transactions.reduce((sum, t) => sum + t.amount, 0),
                        transactionCount: result.transactions.length,
                        importedAt: Date.now(),
                        fingerprint: fingerprint
                    });

                    // Show success state with due date
                    setImportSuccess(true);
                    setImportDueDate(result.dueDate || null);

                    // Wait for animation then add transactions
                    setTimeout(() => {
                        onAdd(result.transactions);
                    }, 1500);
                }
            } else {
                alert("Não conseguimos identificar transações neste arquivo.");
                setLoading(false);
            }
        } catch (error) {
            alert("Erro ao processar arquivo. Tente novamente.");
            setLoading(false);
        }
    };

    reader.readAsDataURL(file);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    const baseAmount = Number(formData.amount);
    const purchaseDateObj = new Date(formData.date || Date.now());
    const paymentDateObj = new Date(formData.paymentDate || formData.date || Date.now());
    
    const transactionsToAdd: Transaction[] = [];

    if (detectedInstallments > 1 && formData.type === TransactionType.EXPENSE) {
        // Handle installments logic
        const amountPerInstallment = parseFloat((baseAmount / detectedInstallments).toFixed(2));
        
        for (let i = 0; i < detectedInstallments; i++) {
            // For installments, the payment date usually shifts by 1 month each time
            // The purchase date remains the original date (for history), 
            // but for tracking, we might want to shift the effective date?
            // Usually, standard installments:
            // Purchase Date: Today
            // Payment 1: Today (or Next Month) -> Let's assume Next Month relative to Payment Date start
            
            const nextPaymentDate = new Date(paymentDateObj);
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + i);
            
            transactionsToAdd.push({
                id: crypto.randomUUID(),
                description: `${formData.description} (${i + 1}/${detectedInstallments})`,
                amount: amountPerInstallment,
                category: formData.category as Category,
                type: formData.type as TransactionType,
                date: purchaseDateObj.toISOString(), // Purchase date stays same
                paymentDate: nextPaymentDate.toISOString(), // Payment date shifts
                isRecurring: false
            });
        }
    } else {
        // Single transaction
        transactionsToAdd.push({
            id: crypto.randomUUID(),
            description: formData.description,
            amount: baseAmount,
            category: formData.category as Category,
            type: formData.type as TransactionType,
            date: purchaseDateObj.toISOString(),
            paymentDate: paymentDateObj.toISOString(),
            isRecurring: formData.isRecurring
        });
    }

    onAdd(transactionsToAdd);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-140px)]">
      {/* Left Panel - Visual/Context */}
      <div className="hidden md:flex flex-1 bg-zinc-900 rounded-3xl p-10 flex-col justify-between text-white relative overflow-hidden shadow-xl hover:scale-[1.01] transition-transform duration-500">
        <div className="relative z-10">
             <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-6 border border-zinc-700">
                <Wand2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-light mb-4 leading-tight">
               {mode === 'import' ? 'Importação Inteligente' : 'Inteligência que organiza.'}
            </h2>
            <p className="text-zinc-400 leading-relaxed">
                {mode === 'import' 
                 ? "Envie sua fatura (PDF ou Imagem). Nossa IA detectará a Data de Vencimento e lançará os gastos no mês correto."
                 : <span>Digite naturalmente e nossa IA extrairá data, valor, categoria e até <span className="text-emerald-400 font-bold">parcelas</span>.</span>
                }
            </p>
        </div>

        {mode !== 'import' && (
            <div className="space-y-3 relative z-10">
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 mb-1">Você digita</p>
                    <p className="text-zinc-300 italic">"Gastei 600 reais em 3x no shopping, pago dia 10"</p>
                </div>
                <div className="flex justify-center text-zinc-600">↓</div>
                <div className="bg-emerald-900/20 p-4 rounded-xl border border-emerald-900/30">
                    <p className="text-xs text-emerald-600 mb-1">Nós registramos</p>
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-500">3x R$ 200,00</span>
                        <span className="text-xs text-emerald-400">Venc. Dia 10</span>
                    </div>
                </div>
            </div>
        )}

        {/* Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 animate-pulse"></div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-zinc-100 flex flex-col overflow-y-auto hover:shadow-lg transition-shadow duration-300">
        
        {/* Toggle */}
        <div className="flex bg-zinc-100 p-1 rounded-xl mb-8 w-fit mx-auto md:mx-0">
             <button
                onClick={() => setMode('ai')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'ai' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
             >
                IA
             </button>
             <button
                onClick={() => setMode('manual')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
             >
                Manual
             </button>
        </div>
        
        {/* Import Button */}
        {mode !== 'import' && (
            <div className="absolute top-10 right-10">
                <button 
                    onClick={() => setMode('import')}
                    className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-800 transition-colors bg-zinc-50 px-3 py-2 rounded-lg"
                    title="Importar Arquivo (CSV/PDF/IMG)"
                >
                    <Upload size={14} /> Importar
                </button>
            </div>
        )}

        {mode === 'import' ? (
             <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn text-center relative">
                 <button onClick={() => {
                     setMode('ai');
                     setImportSuccess(false);
                     setDuplicateDetected(false);
                     setDuplicateInfo(null);
                     setImportDueDate(null);
                 }} className="absolute top-0 right-0 p-2 text-zinc-400 hover:text-zinc-800"><X /></button>

                 <div className={`w-full max-w-sm h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all ${
                     duplicateDetected ? 'border-orange-500 bg-orange-50/50' :
                     importSuccess ? 'border-emerald-500 bg-emerald-50/50' :
                     loading ? 'border-emerald-500 bg-emerald-50/50' :
                     'border-zinc-300 hover:border-zinc-800 hover:bg-zinc-50'
                 }`}>
                     {duplicateDetected ? (
                         <>
                            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center animate-fadeIn">
                                <AlertTriangle className="w-12 h-12 text-orange-600" />
                            </div>
                            <div className="animate-fadeIn">
                                <p className="text-orange-800 font-bold text-lg mb-2">Fatura Já Importada!</p>
                                {duplicateInfo && (
                                    <div className="text-orange-600 text-sm space-y-1">
                                        {duplicateInfo.dueDate !== 'no-date' && (
                                            <p>Vencimento: {new Date(duplicateInfo.dueDate).toLocaleDateString('pt-BR')}</p>
                                        )}
                                        <p>Importada em: {new Date(duplicateInfo.importedAt).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                )}
                                <p className="text-orange-700 text-xs mt-3 max-w-xs">
                                    Esta fatura já foi processada anteriormente. Não é possível importar novamente.
                                </p>
                            </div>
                         </>
                     ) : importSuccess ? (
                         <>
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-fadeIn">
                                <Check className="w-12 h-12 text-emerald-600" />
                            </div>
                            <div className="animate-fadeIn">
                                <p className="text-emerald-800 font-bold text-lg mb-2">Fatura Processada!</p>
                                {importDueDate && (
                                    <p className="text-emerald-600 text-sm">
                                        Data de Vencimento: {new Date(importDueDate).toLocaleDateString('pt-BR')}
                                    </p>
                                )}
                            </div>
                         </>
                     ) : loading ? (
                         <>
                            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                            <p className="text-emerald-700 font-bold">Analisando Fatura...</p>
                            <p className="text-emerald-600 text-xs max-w-xs">
                                Identificando data de vencimento e itens...
                            </p>
                         </>
                     ) : (
                         <>
                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
                                <FileText size={32} />
                            </div>
                            <div>
                                <p className="font-bold text-zinc-800">Clique para enviar fatura</p>
                                <p className="text-xs text-zinc-400 mt-1">PDF, JPG, PNG ou CSV</p>
                            </div>
                            {!duplicateDetected && (
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileImport}
                                    accept=".csv, .pdf, image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            )}
                         </>
                     )}
                 </div>
                 <p className="text-xs text-zinc-400 mt-6 max-w-xs">
                    Identificaremos automaticamente a data de vencimento e os itens da fatura.
                 </p>
             </div>
        ) : mode === 'ai' ? (
             <div className="flex-1 flex flex-col justify-center animate-fadeIn">
                <p className="text-zinc-500 mb-4">Descreva a transação...</p>
                <form onSubmit={handleAiSubmit} className="relative">
                    <textarea
                        className="w-full bg-zinc-50 p-6 rounded-3xl border-2 border-transparent focus:border-zinc-200 focus:bg-white text-xl text-zinc-800 placeholder-zinc-300 outline-none resize-none min-h-[200px] transition-all"
                        placeholder="Ex: Tênis novo 300 reais em 3 parcelas, vence dia 15"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading || !inputText}
                        className="absolute right-4 bottom-4 w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center hover:bg-zinc-800 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                    </button>
                </form>
             </div>
        ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-5 animate-fadeIn">
                
                {detectedInstallments > 1 && (
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 animate-slideUp">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Layers size={16} />
                        </div>
                        <div>
                            <p className="text-emerald-900 font-bold text-sm">Parcelamento Detectado</p>
                            <p className="text-emerald-700 text-xs">Serão criados {detectedInstallments} registros de R$ {(Number(formData.amount) / detectedInstallments).toFixed(2)}</p>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setDetectedInstallments(1)} 
                            className="ml-auto text-xs text-zinc-400 underline hover:text-zinc-800"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Descrição</label>
                    <input
                        type="text"
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-800 font-medium"
                        placeholder="Nome do gasto"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Valor Total</label>
                        <input
                            type="number"
                            required
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                            className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-800 font-bold"
                        />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Categoria</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value as Category})}
                            className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-800 cursor-pointer appearance-none"
                        >
                            {Object.values(Category).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Data da Compra</label>
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-2">Data do Pagamento</label>
                        <input
                            type="date"
                            required
                            value={formData.paymentDate}
                            onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                            className="w-full p-4 bg-emerald-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-emerald-800 font-medium"
                            title="Se for crédito, coloque o vencimento da fatura"
                        />
                    </div>
                </div>

                <div className="flex gap-4 pt-2">
                     <button
                        type="button"
                        onClick={() => setFormData({...formData, type: TransactionType.EXPENSE})}
                        className={`flex-1 p-4 rounded-2xl font-bold text-sm transition-all border ${formData.type === TransactionType.EXPENSE ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                     >
                        Despesa
                     </button>
                     <button
                        type="button"
                        onClick={() => setFormData({...formData, type: TransactionType.INCOME})}
                        className={`flex-1 p-4 rounded-2xl font-bold text-sm transition-all border ${formData.type === TransactionType.INCOME ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                     >
                        Receita
                     </button>
                </div>

                <button
                    type="submit"
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 hover:shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all"
                >
                    {detectedInstallments > 1 ? `Salvar ${detectedInstallments} Parcelas` : 'Salvar Registro'}
                </button>
            </form>
        )}
      </div>
    </div>
  );
};

export default AddTransaction;