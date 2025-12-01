import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Category, Transaction, TransactionType } from '../types';
import { parseTransactionFromText, parseImportFile } from '../services/geminiService';
import { generateInvoiceFingerprint, isInvoiceAlreadyImported, saveImportedInvoice, getCreditCardHistory, suggestCreditCardDueDate } from '../services/storageService';
import { parseLocalDate } from '../utils/dateUtils';
import { Mic, Send, Loader2, Wand2, Check, Layers, Upload, FileText, X, AlertTriangle, Sparkles, TrendingDown, TrendingUp, Wallet, CreditCard, Banknote, Calendar, DollarSign } from 'lucide-react';
import CinematicImportExperience from './CinematicImportExperience';
import CinematicFileDropzone from './CinematicFileDropzone';
import CinematicConfirmation from './CinematicConfirmation';

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
  const [importDocumentType, setImportDocumentType] = useState<'invoice' | 'bank_statement' | null>(null);
  const [duplicateDetected, setDuplicateDetected] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ dueDate: string; importedAt: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New states for confirmation flow
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    fileName: string;
    fileData: string;
    mimeType: string;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    result: any;
    fileName: string;
    fileData: string;
    mimeType: string;
  } | null>(null);
  const [userContext, setUserContext] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Staging for logic that handles multiple installments
  const [detectedInstallments, setDetectedInstallments] = useState(1);

  // Custom installment input
  const [showCustomInstallment, setShowCustomInstallment] = useState(false);
  const [customInstallmentValue, setCustomInstallmentValue] = useState('');

  // Credit card autocomplete
  const [creditCardInput, setCreditCardInput] = useState('');
  const [showCardSuggestions, setShowCardSuggestions] = useState(false);
  const availableCardsData = getCreditCardHistory();
  const [availableCards, setAvailableCards] = useState(availableCardsData);

  // AI date change animation
  const [dateChangedByAI, setDateChangedByAI] = useState(false);

  // Debug: log available cards on mount
  React.useEffect(() => {
    console.log('💳 Available cards:', availableCards);
  }, []);

  const [formData, setFormData] = useState<Partial<Transaction>>({
    description: '',
    amount: 0,
    category: Category.OTHER,
    type: TransactionType.EXPENSE,
    date: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split('T')[0], // Default payment date is today
    isRecurring: false,
    isCreditPurchase: false
  });
  const toInputDate = (date: Date) => date.toISOString().split('T')[0];

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const result = await parseTransactionFromText(inputText);
      if (result) {
        const parsedDate = result.date ? new Date(result.date).toISOString().split('T')[0] : formData.date;
        const parsedPaymentDate = result.paymentDate
          ? new Date(result.paymentDate).toISOString().split('T')[0]
          : parsedDate;

        setFormData({
          ...result,
          date: parsedDate,
          paymentDate: parsedPaymentDate,
          isCreditPurchase: false
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

    // Validate file size (max 4MB to be safe with Gemini API)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      alert(`Arquivo muito grande. O tamanho máximo permitido é 4MB.\nTamanho do arquivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'text/csv'];
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.csv'];
    const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];

    if (!validTypes.includes(file.type) && (!fileExtension || !validExtensions.includes(fileExtension))) {
      alert('Tipo de arquivo não suportado. Por favor, envie um arquivo PDF, JPG, PNG ou CSV.');
      return;
    }

    // Reset states
    setImportSuccess(false);
    setDuplicateDetected(false);
    setDuplicateInfo(null);
    setImportDueDate(null);
    setImportDocumentType(null);
    setPendingImport(null);

    const reader = new FileReader();

    reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];

        // Just store the file, don't process yet
        setSelectedFile({
            file,
            fileName: file.name,
            fileData: base64Data,
            mimeType: file.type || 'application/octet-stream'
        });
    };

    reader.onerror = () => {
      alert('Erro ao ler o arquivo. Por favor, tente novamente.');
    };

    reader.readAsDataURL(file);
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
        // Parse with user context if provided
        const result = await parseImportFile(
            selectedFile.fileData,
            selectedFile.mimeType,
            selectedFile.fileName,
            existingTransactions,
            undefined, // ownerName
            userContext.trim() || undefined
        );

        if (result.normalized.length > 0) {
            // For bank statements, skip duplicate detection (they have different logic)
            const isBankStatement = result.documentType === 'bank_statement';

            if (!isBankStatement) {
                // Generate fingerprint for invoices only
                const fingerprint = generateInvoiceFingerprint(result.dueDate || null, result.normalized);

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
                    setSelectedFile(null);
                    return;
                }
            }

            // Store pending import for confirmation
            setPendingImport({
                result,
                fileName: selectedFile.fileName,
                fileData: selectedFile.fileData,
                mimeType: selectedFile.mimeType
            });
            setSelectedFile(null);
            setLoading(false);
        } else {
            alert("Não conseguimos identificar transações neste arquivo.");
            setLoading(false);
            setSelectedFile(null);
        }
    } catch (error: any) {
        console.error("Erro ao processar arquivo:", error);

        let errorMessage = "Erro ao processar arquivo.";

        // Check for specific error types
        if (error?.message?.includes('INVALID_ARGUMENT')) {
            errorMessage = "Erro ao processar arquivo:\n\n" +
                          "• O arquivo pode estar corrompido ou em formato incompatível\n" +
                          "• Tamanho muito grande (máx 4MB)\n" +
                          "• Tente converter para PDF ou usar uma captura de tela\n\n" +
                          "Dica: Se for uma prévia de fatura, tire um print da tela e envie como imagem.";
        } else if (error?.message?.includes('API_KEY_NOT_CONFIGURED')) {
            errorMessage = "Chave de API não configurada. Configure sua chave do Gemini nas configurações.";
        } else if (error?.message?.includes('quota')) {
            errorMessage = "Limite de uso da API atingido. Aguarde alguns minutos e tente novamente.";
        } else if (error?.message) {
            errorMessage = `Erro: ${error.message}`;
        }

        alert(errorMessage);
        setLoading(false);
        setSelectedFile(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;

    setLoading(true);
    try {
        // Use the already processed result (context was applied in handleProcessFile)
        const result = pendingImport.result;
        const isBankStatement = result.documentType === 'bank_statement';

        // Generate transaction IDs upfront so we can save them with the invoice
        const transactionIds = result.normalized.map(() => crypto.randomUUID());

        // Assign the pre-generated IDs to transactions
        const transactionsWithIds = result.normalized.map((t: any, index: number) => ({
            ...t,
            id: transactionIds[index],
            createdAt: Date.now()
        }));

        // Save invoice record only for credit card invoices
        if (!isBankStatement) {
            saveImportedInvoice({
                id: crypto.randomUUID(),
                dueDate: result.dueDate || 'no-date',
                totalAmount: result.normalized.reduce((sum, t) => sum + t.amount, 0),
                transactionCount: result.normalized.length,
                importedAt: Date.now(),
                fingerprint: generateInvoiceFingerprint(result.dueDate || null, result.normalized),
                transactionIds: transactionIds,
                issuer: result.issuer
            });
        }

        // Show success state with appropriate info
        setImportSuccess(true);
        setImportDueDate(result.dueDate || null);
        setImportDocumentType(result.documentType || 'invoice');
        setPendingImport(null);
        setUserContext('');

        // Wait for animation then add transactions
        setTimeout(() => {
            onAdd(transactionsWithIds);
        }, 1500);
    } catch (error) {
        alert("Erro ao processar arquivo. Tente novamente.");
        setLoading(false);
    }
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    setUserContext('');
  };

  const handleCancelFileSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreditToggle = (checked: boolean) => {
    setFormData(prev => {
      const purchaseDate = prev.date ? parseLocalDate(prev.date) : new Date();
      const suggestedPaymentDate = toInputDate(new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, purchaseDate.getDate()));
      const shouldAutoSet = checked && (!prev.paymentDate || prev.paymentDate === prev.date);

      return {
        ...prev,
        isCreditPurchase: checked,
        paymentDate: shouldAutoSet
          ? suggestedPaymentDate
          : (prev.paymentDate || prev.date || suggestedPaymentDate)
      };
    });
  };

  const handleCardSelection = (issuer: string) => {
    console.log('🔍 handleCardSelection called with issuer:', issuer);

    setCreditCardInput(issuer);
    setShowCardSuggestions(false);

    // Auto-fill due date based on history
    const suggestedDate = suggestCreditCardDueDate(issuer);
    console.log('📅 Suggested date for', issuer, ':', suggestedDate);

    if (suggestedDate) {
      console.log('✅ Setting payment date to:', suggestedDate);
      setFormData(prev => ({
        ...prev,
        paymentDate: suggestedDate,
        creditCardIssuer: issuer
      }));

      // Trigger AI sparkle animation
      setDateChangedByAI(true);
      setTimeout(() => setDateChangedByAI(false), 2000);
    } else {
      console.log('❌ No suggested date found, just setting issuer');
      setFormData(prev => ({ ...prev, creditCardIssuer: issuer }));
    }
  };

  const handleCardInputChange = (value: string) => {
    setCreditCardInput(value);
    setShowCardSuggestions(value.length > 0);
    setFormData(prev => ({ ...prev, creditCardIssuer: value }));
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    const baseAmount = Number(formData.amount);
    const creditIssuer = formData.isCreditPurchase ? formData.creditCardIssuer : undefined;
    // Use parseLocalDate to ensure we get 00:00:00 Local Time, avoiding timezone shifts
    const purchaseDateObj = formData.date ? parseLocalDate(formData.date) : new Date();
    const paymentDateObj = formData.paymentDate ? parseLocalDate(formData.paymentDate) : (formData.date ? parseLocalDate(formData.date) : new Date());
    
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
                isRecurring: false,
                isAiGenerated: formData.isAiGenerated,
                isCreditPurchase: formData.isCreditPurchase,
                creditCardIssuer: creditIssuer,
                issuer: creditIssuer,
                linkedToInvoice: formData.linkedToInvoice,
                debtor: formData.debtor,
                tags: formData.tags,
                createdAt: Date.now()
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
            isRecurring: formData.isRecurring,
            isAiGenerated: formData.isAiGenerated,
            isCreditPurchase: formData.isCreditPurchase,
            linkedToInvoice: formData.linkedToInvoice,
            creditCardIssuer: creditIssuer,
            issuer: creditIssuer,
            debtor: formData.debtor,
            tags: formData.tags,
            createdAt: Date.now()
        });
    }

    onAdd(transactionsToAdd);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 min-h-[calc(100vh-180px)] md:h-[calc(100vh-140px)]">
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
                 ? "Envie sua fatura de cartão ou extrato bancário (PDF ou Imagem). Nossa IA processará automaticamente, aplicando filtros inteligentes para evitar duplicações."
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
      <div className="flex-1 bg-white rounded-2xl md:rounded-3xl p-4 md:p-10 shadow-sm border border-zinc-100 flex flex-col overflow-y-auto relative">
        
        {/* Toggle + Import - Desktop Version */}
        <div className="hidden md:flex items-center justify-between mb-8">
          <div className="flex bg-zinc-100 p-1 rounded-xl">
               <button
                  onClick={() => setMode('ai')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'ai' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                  Assistente IA
               </button>
               <button
                  onClick={() => setMode('manual')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                  Manual
               </button>
          </div>
          
          {mode !== 'import' && (
              <button 
                  onClick={() => setMode('import')}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors bg-zinc-100 px-3 py-2 rounded-lg"
                  title="Importar"
              >
                  <Upload size={14} />
                  <span>Importar</span>
              </button>
          )}
        </div>
        
        {/* Toggle + Import - Mobile Version */}
        <div className="flex md:hidden items-center justify-between gap-2 mb-4">
          <div className="flex bg-zinc-100 p-0.5 rounded-lg shrink-0">
               <button
                  onClick={() => setMode('ai')}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${mode === 'ai' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 active:text-zinc-600'}`}
               >
                  IA
               </button>
               <button
                  onClick={() => setMode('manual')}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 active:text-zinc-600'}`}
               >
                  Manual
               </button>
          </div>
          
          {mode !== 'import' && (
              <button 
                  onClick={() => setMode('import')}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 active:text-zinc-800 transition-colors bg-zinc-100 px-2.5 py-1.5 rounded-lg shrink-0"
                  title="Importar"
              >
                  <Upload size={14} />
                  <span>Importar</span>
              </button>
          )}
        </div>

        {mode === 'import' ? (
             <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn text-center relative">
                 <button onClick={() => {
                     setMode('ai');
                     setImportSuccess(false);
                     setDuplicateDetected(false);
                     setDuplicateInfo(null);
                     setImportDueDate(null);
                     setImportDocumentType(null);
                     setPendingImport(null);
                     setSelectedFile(null);
                     setUserContext('');
                     if (fileInputRef.current) {
                         fileInputRef.current.value = '';
                     }
                 }} className="absolute top-0 right-0 p-2 text-zinc-400 hover:text-zinc-800"><X /></button>

                 {/* Cinematic Processing Experience */}
                 {selectedFile && loading ? (
                     <div className="w-full animate-fadeIn">
                         <CinematicImportExperience 
                             fileName={selectedFile.fileName} 
                             isProcessing={loading}
                         />
                     </div>
                 ) : selectedFile && !loading ? (
                     /* File Selected - Ready to Process - Cinematic */
                     <div className="w-full max-w-2xl animate-fadeIn">
                         <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl p-6 md:p-8 border border-zinc-700/50 shadow-2xl overflow-hidden">
                             {/* Animated background glow */}
                             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                             <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                             
                             {/* Header */}
                             <div className="relative z-10 flex items-center gap-4 mb-6">
                                 <div className="relative">
                                     <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg"
                                          style={{ boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)' }}>
                                         <FileText className="w-7 h-7 md:w-8 md:h-8 text-white" />
                                     </div>
                                     <div className="absolute inset-0 bg-blue-500 rounded-2xl animate-ping opacity-20" />
                                     <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400 animate-pulse" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <h3 className="text-white font-bold text-xl md:text-2xl mb-1">Arquivo Pronto</h3>
                                     <p className="text-zinc-400 text-sm font-mono truncate">{selectedFile.fileName}</p>
                                 </div>
                             </div>

                             {/* Context Input */}
                             <div className="relative z-10 mb-6">
                                 <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-3 flex items-center gap-2">
                                     <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                     Contexto para a IA (opcional)
                                 </label>
                                 <textarea
                                     value={userContext}
                                     onChange={(e) => setUserContext(e.target.value)}
                                     placeholder="Ex: Considere essas movimentações para a fatura de 20/02 do cartão Nubank"
                                     className="w-full p-4 bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50 rounded-xl focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-white placeholder-zinc-500 resize-none"
                                     rows={3}
                                 />
                                 <p className="text-xs text-zinc-500 mt-2 flex items-start gap-1.5">
                                     <span className="text-amber-400 shrink-0">💡</span>
                                     <span>Adicione instruções específicas para ajudar a IA a interpretar corretamente o arquivo.</span>
                                 </p>
                             </div>

                             {/* Action Buttons */}
                             <div className="relative z-10 flex gap-3">
                                 <button
                                     onClick={handleCancelFileSelection}
                                     className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-2xl font-bold transition-all border border-zinc-700 hover:border-zinc-600"
                                 >
                                     Cancelar
                                 </button>
                                 <button
                                     onClick={handleProcessFile}
                                     className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                 >
                                     <Sparkles size={20} />
                                     Processar com IA
                                 </button>
                             </div>
                         </div>
                         <p className="text-xs text-zinc-500 mt-4 text-center flex items-center justify-center gap-1.5">
                             <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                             A IA irá analisar o documento automaticamente
                         </p>
                     </div>
                 ) : pendingImport && !loading ? (
                     /* Cinematic Confirmation Screen */
                     <CinematicConfirmation
                         fileName={pendingImport.fileName}
                         transactionCount={pendingImport.result.normalized.length}
                         issuer={pendingImport.result.issuer}
                         dueDate={pendingImport.result.dueDate}
                         documentType={pendingImport.result.documentType}
                         transactions={pendingImport.result.normalized}
                         onConfirm={handleConfirmImport}
                         onCancel={handleCancelImport}
                     />
                 ) : loading ? (
                     /* Cinematic Import Experience */
                     <div className="w-full animate-fadeIn">
                         <CinematicImportExperience 
                             fileName={selectedFile?.fileName || 'documento'} 
                             isProcessing={loading}
                         />
                     </div>
                 ) : duplicateDetected ? (
                     /* Duplicate Detected State - Cinematic */
                     <div className="w-full max-w-md animate-fadeIn">
                         <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl p-8 border border-orange-500/30 shadow-2xl overflow-hidden">
                             {/* Animated background */}
                             <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
                             
                             <div className="relative z-10 text-center">
                                 <div className="relative w-20 h-20 mx-auto mb-6">
                                     <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20" />
                                     <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg"
                                          style={{ boxShadow: '0 0 30px rgba(249, 115, 22, 0.4)' }}>
                                         <AlertTriangle className="w-10 h-10 text-white" />
                                     </div>
                                 </div>
                                 
                                 <h3 className="text-white font-bold text-2xl mb-3">Fatura Já Importada</h3>
                                 
                                 {duplicateInfo && (
                                     <div className="bg-orange-500/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-orange-500/30">
                                         {duplicateInfo.dueDate !== 'no-date' && (
                                             <p className="text-orange-300 text-sm mb-1">
                                                 <span className="text-zinc-400">Vencimento:</span> {new Date(duplicateInfo.dueDate).toLocaleDateString('pt-BR')}
                                             </p>
                                         )}
                                         <p className="text-orange-300 text-sm">
                                             <span className="text-zinc-400">Importada em:</span> {new Date(duplicateInfo.importedAt).toLocaleDateString('pt-BR')}
                                         </p>
                                     </div>
                                 )}
                                 
                                 <p className="text-zinc-400 text-sm">
                                     Esta fatura já foi processada anteriormente e não pode ser importada novamente.
                                 </p>
                             </div>
                         </div>
                     </div>
                 ) : importSuccess ? (
                     /* Success State - Cinematic */
                     <div className="w-full max-w-md animate-fadeIn">
                         <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl p-8 border border-emerald-500/30 shadow-2xl overflow-hidden">
                             {/* Animated background */}
                             <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
                             <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                             
                             <div className="relative z-10 text-center">
                                 <div className="relative w-20 h-20 mx-auto mb-6">
                                     <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
                                     <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg"
                                          style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }}>
                                         <Check className="w-10 h-10 text-white" strokeWidth={3} />
                                     </div>
                                     <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400 animate-pulse" />
                                 </div>
                                 
                                 <h3 className="text-white font-bold text-2xl mb-3">
                                     {importDocumentType === 'bank_statement' ? 'Extrato Processado!' : 'Fatura Processada!'}
                                 </h3>
                                 
                                 <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
                                     {importDueDate && importDocumentType === 'invoice' ? (
                                         <p className="text-emerald-300 text-sm">
                                             <span className="text-zinc-400">Vencimento:</span> {new Date(importDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                         </p>
                                     ) : (
                                         <p className="text-emerald-300 text-sm">
                                             Transações filtradas e categorizadas com sucesso
                                         </p>
                                     )}
                                 </div>
                             </div>
                         </div>
                     </div>
                 ) : (
                     /* Cinematic File Dropzone */
                     <CinematicFileDropzone 
                         onFileSelect={(file) => {
                             // Validate file size (max 4MB)
                             const maxSize = 4 * 1024 * 1024;
                             if (file.size > maxSize) {
                                 alert(`Arquivo muito grande. O tamanho máximo permitido é 4MB.\nTamanho do arquivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                                 return;
                             }

                             // Validate file type
                             const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'text/csv'];
                             const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.csv'];
                             const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];

                             if (!validTypes.includes(file.type) && (!fileExtension || !validExtensions.includes(fileExtension))) {
                                 alert('Tipo de arquivo não suportado. Por favor, envie um arquivo PDF, JPG, PNG ou CSV.');
                                 return;
                             }

                             // Reset states
                             setImportSuccess(false);
                             setDuplicateDetected(false);
                             setDuplicateInfo(null);
                             setImportDueDate(null);
                             setImportDocumentType(null);
                             setPendingImport(null);

                             const reader = new FileReader();
                             reader.onloadend = () => {
                                 const base64String = reader.result as string;
                                 const base64Data = base64String.split(',')[1];
                                 setSelectedFile({
                                     file,
                                     fileName: file.name,
                                     fileData: base64Data,
                                     mimeType: file.type || 'application/octet-stream'
                                 });
                             };
                             reader.onerror = () => {
                                 alert('Erro ao ler o arquivo. Por favor, tente novamente.');
                             };
                             reader.readAsDataURL(file);
                         }}
                         accept=".csv, .pdf, image/*"
                         maxSize={4}
                     />
                 )}
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
            <form onSubmit={handleFinalSubmit} className="space-y-6 animate-fadeIn">

                {/* STEP 1: TIPO - Primeira pergunta mental do usuário */}
                <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-3">É uma entrada ou saída?</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, type: TransactionType.EXPENSE})}
                            className={`p-4 rounded-2xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${formData.type === TransactionType.EXPENSE ? 'bg-red-50 text-red-700 border-red-300 shadow-sm' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                        >
                            <TrendingDown size={20} />
                            Despesa
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, type: TransactionType.INCOME})}
                            className={`p-4 rounded-2xl font-bold text-sm transition-all border-2 flex items-center justify-center gap-2 ${formData.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm' : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'}`}
                        >
                            <TrendingUp size={20} />
                            Receita
                        </button>
                    </div>
                </div>

                {/* STEP 2: DESCRIÇÃO */}
                <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                        {formData.type === TransactionType.INCOME ? 'De onde veio?' : 'No que gastou?'}
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-800 font-medium"
                        placeholder={formData.type === TransactionType.INCOME ? 'Ex: Salário, Freelance...' : 'Ex: Mercado, Uber...'}
                    />
                </div>

                {/* STEP 3: VALOR E CATEGORIA */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Quanto?</label>
                        <input
                            type="number"
                            required
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                            className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-800 font-bold text-lg"
                            placeholder="0,00"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Categoria</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value as Category})}
                            className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-800 cursor-pointer"
                        >
                            {Object.values(Category).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* AI Detected Installments Badge */}
                {detectedInstallments > 1 && formData.type === TransactionType.EXPENSE && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-blue-600" />
                                <span className="text-sm font-bold text-blue-900">Parcelamento Detectado pela IA</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setDetectedInstallments(1);
                                    setShowCustomInstallment(false);
                                    setCustomInstallmentValue('');
                                }}
                                className="text-xs text-zinc-400 hover:text-zinc-800 underline"
                            >
                                Remover
                            </button>
                        </div>
                        <p className="text-blue-700 text-sm">
                            {detectedInstallments}x de R$ {(Number(formData.amount) / detectedInstallments).toFixed(2)}
                        </p>
                    </div>
                )}

                {/* STEP 4: DATAS */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                            {formData.type === TransactionType.INCOME ? 'Quando recebeu?' : 'Quando foi?'}
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                setFormData({
                                    ...formData,
                                    date: newDate,
                                    // Se não for compra a crédito, atualizar paymentDate junto
                                    paymentDate: !formData.isCreditPurchase ? newDate : formData.paymentDate
                                });
                            }}
                            className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-700 font-medium"
                        />
                    </div>
                    <div className="relative">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2 flex items-center gap-2">
                            {formData.type === TransactionType.INCOME ? 'Vencimento' : 'Data de Vencimento'}
                            {dateChangedByAI && (
                                <span className="text-emerald-600 flex items-center gap-1 animate-pulse">
                                    <Sparkles size={12} />
                                    <span className="text-[10px]">IA ajustou</span>
                                </span>
                            )}
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.paymentDate}
                            onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                            className={`w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-200 outline-none transition-all text-zinc-700 font-medium ${
                                dateChangedByAI ? 'ring-2 ring-emerald-400 bg-emerald-50 animate-pulse' : ''
                            }`}
                        />
                    </div>
                </div>

                {/* STEP 5A: DEVEDOR E TAGS (só para receitas) */}
                {formData.type === TransactionType.INCOME && (
                    <div className="border-t border-zinc-100 pt-4 space-y-4">
                        {/* Campo Devedor */}
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                                Devedor (Opcional)
                            </label>
                            <input
                                type="text"
                                value={formData.debtor || ''}
                                onChange={(e) => setFormData({...formData, debtor: e.target.value})}
                                className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-zinc-800 font-medium"
                                placeholder="Ex: Andressa, Lanna, Patrick..."
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                💡 Quem deve te pagar? Essa receita aparecerá no Dashboard de Cobrança
                            </p>
                        </div>

                        {/* Campo Tags */}
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                                Tags (Opcional)
                            </label>
                            <input
                                type="text"
                                value={formData.tags?.join(', ') || ''}
                                onChange={(e) => {
                                    const tagsString = e.target.value;
                                    const tagsArray = tagsString
                                        .split(',')
                                        .map(tag => tag.trim().replace(/^#/, ''))
                                        .filter(tag => tag.length > 0);
                                    setFormData({...formData, tags: tagsArray.length > 0 ? tagsArray : undefined});
                                }}
                                className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-zinc-800 font-medium"
                                placeholder="Ex: reembolso, viagem, trabalho..."
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                🏷️ Separe as tags por vírgula. Útil para filtrar e agrupar receitas
                            </p>
                            {formData.tags && formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {formData.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 5: FORMA DE PAGAMENTO (só para despesas) */}
                {formData.type === TransactionType.EXPENSE && (
                    <>
                        <div className="border-t border-zinc-100 pt-4">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-3">Como pagou?</label>
                            <div className="space-y-3">
                                {/* Opção: À vista */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            isCreditPurchase: false,
                                            paymentDate: prev.date
                                        }));
                                        setDetectedInstallments(1);
                                    }}
                                    className={`w-full p-4 rounded-2xl transition-all border-2 ${
                                        !formData.isCreditPurchase
                                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg'
                                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${!formData.isCreditPurchase ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                                            <Banknote size={20} className={!formData.isCreditPurchase ? 'text-white' : 'text-zinc-600'} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="font-bold mb-0.5">À vista / Débito / Pix</div>
                                            <div className="text-xs opacity-70">Pagamento imediato</div>
                                        </div>
                                    </div>
                                </button>

                                {/* Opção: Cartão de Crédito */}
                                <button
                                    type="button"
                                    onClick={() => handleCreditToggle(true)}
                                    className={`w-full p-4 rounded-2xl transition-all border-2 ${
                                        formData.isCreditPurchase
                                            ? 'bg-emerald-900 text-white border-emerald-900 shadow-lg'
                                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${formData.isCreditPurchase ? 'bg-emerald-800' : 'bg-zinc-100'}`}>
                                            <CreditCard size={20} className={formData.isCreditPurchase ? 'text-white' : 'text-zinc-600'} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <div className="font-bold mb-0.5">Cartão de Crédito</div>
                                            <div className="text-xs opacity-70">Pago na fatura do cartão</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Detalhes do Cartão de Crédito */}
                        {formData.isCreditPurchase && (
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-4 animate-slideUp">
                                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                                    <CreditCard size={20} />
                                    Qual Cartão?
                                </div>

                                {/* Campo de Cartão de Crédito com Autocomplete */}
                                <div className="relative">
                                    {availableCards.length > 0 && (
                                        <div className="flex items-center gap-1 mb-2 text-emerald-600">
                                            <Sparkles size={12} />
                                            <span className="text-[10px] font-medium">IA sugere datas de vencimento</span>
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        required
                                        value={creditCardInput}
                                        onChange={(e) => handleCardInputChange(e.target.value)}
                                        onFocus={() => setShowCardSuggestions(creditCardInput.length > 0 || availableCards.length > 0)}
                                        onBlur={() => setTimeout(() => setShowCardSuggestions(false), 300)}
                                        className="w-full p-3 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none transition-all text-emerald-900 font-medium"
                                        placeholder="Ex: Nubank, Itaú, C6 Bank"
                                    />

                                    {/* Dropdown de Sugestões */}
                                    {showCardSuggestions && availableCards.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-emerald-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {availableCards
                                                .filter(card => card.issuer.toLowerCase().includes(creditCardInput.toLowerCase()))
                                                .map((card, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault(); // Previne o blur
                                                            handleCardSelection(card.issuer);
                                                        }}
                                                        className="w-full p-3 text-left hover:bg-emerald-50 transition-colors border-b border-emerald-100 last:border-b-0 flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <div className="font-medium text-emerald-900">{card.issuer}</div>
                                                            <div className="text-xs text-emerald-600">
                                                                Vence dia {card.mostCommonDueDay}
                                                            </div>
                                                        </div>
                                                        <Sparkles size={14} className="text-emerald-400" />
                                                    </button>
                                                ))}

                                            {availableCards.filter(card => card.issuer.toLowerCase().includes(creditCardInput.toLowerCase())).length === 0 && creditCardInput && (
                                                <div className="p-3 text-xs text-zinc-500 text-center">
                                                    Novo cartão - será adicionado ao histórico
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Opções de Parcelamento dentro de Cartão de Crédito */}
                                <div className="mt-4 space-y-2">
                                    <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                                        Parcelar?
                                    </label>
                                    <div className="grid grid-cols-4 md:flex gap-1.5 md:gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDetectedInstallments(1);
                                                setShowCustomInstallment(false);
                                            }}
                                            className={`py-2 px-2 md:px-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                                detectedInstallments === 1 && !showCustomInstallment
                                                    ? 'bg-white text-emerald-900 shadow-sm border-2 border-emerald-400'
                                                    : 'bg-emerald-100 text-emerald-700 active:bg-emerald-200 border-2 border-transparent'
                                            }`}
                                        >
                                            1x
                                        </button>
                                        {[2, 3, 6, 12].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => {
                                                    setDetectedInstallments(n);
                                                    setShowCustomInstallment(false);
                                                }}
                                                className={`py-2 px-2 md:px-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                                    detectedInstallments === n && !showCustomInstallment
                                                        ? 'bg-white text-emerald-900 shadow-sm border-2 border-emerald-400'
                                                        : 'bg-emerald-100 text-emerald-700 active:bg-emerald-200 border-2 border-transparent'
                                                }`}
                                            >
                                                {n}x
                                            </button>
                                        ))}
                                        {!showCustomInstallment ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowCustomInstallment(true);
                                                    setCustomInstallmentValue('');
                                                }}
                                                className="col-span-2 md:col-span-1 py-2 px-2 md:px-3 rounded-lg text-xs md:text-sm font-medium transition-all bg-emerald-100 text-emerald-700 active:bg-emerald-200 border-2 border-transparent"
                                            >
                                                Outros
                                            </button>
                                        ) : (
                                            <input
                                                type="number"
                                                min="1"
                                                max="99"
                                                placeholder="Nº"
                                                value={customInstallmentValue}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setCustomInstallmentValue(value);
                                                    const numValue = parseInt(value);
                                                    if (value && numValue > 0 && numValue <= 99) {
                                                        setDetectedInstallments(numValue);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (!customInstallmentValue || parseInt(customInstallmentValue) < 1) {
                                                        setShowCustomInstallment(false);
                                                        setDetectedInstallments(1);
                                                    }
                                                }}
                                                autoFocus
                                                className="col-span-2 md:col-span-1 py-2 px-2 md:px-3 rounded-lg text-xs md:text-sm font-medium bg-white text-emerald-900 shadow-sm border-2 border-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none w-full"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Recorrência */}
                <div className="border-t border-zinc-100 pt-4">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isRecurring"
                            checked={formData.isRecurring || false}
                            onChange={(e) => {
                                const isRecurring = e.target.checked;
                                setFormData({
                                    ...formData,
                                    isRecurring,
                                    // Se marcar como recorrente E já tem cartão de crédito, vincular automaticamente
                                    linkedToInvoice: isRecurring && formData.isCreditPurchase && creditCardInput ? true : false,
                                    creditCardIssuer: isRecurring && formData.isCreditPurchase && creditCardInput ? creditCardInput : formData.creditCardIssuer
                                });
                            }}
                            className="w-5 h-5 rounded border-2 border-zinc-300 text-emerald-600 focus:ring-2 focus:ring-emerald-200 cursor-pointer"
                        />
                        <div className="flex flex-col">
                            <label htmlFor="isRecurring" className="text-sm text-zinc-700 cursor-pointer select-none font-medium">
                                {formData.type === TransactionType.INCOME ? 'Receita recorrente?' : 'Assinatura ou gasto fixo?'}
                            </label>
                            <span className="text-xs text-zinc-500">
                                {formData.type === TransactionType.INCOME
                                    ? 'Ex: Salário, aluguel recebido'
                                    : 'Ex: Netflix, academia, internet'}
                            </span>
                        </div>
                    </div>

                    {/* Info sobre vínculo automático se já tiver cartão selecionado */}
                    {formData.isRecurring && formData.isCreditPurchase && creditCardInput && formData.type === TransactionType.EXPENSE && (
                        <div className="mt-3 ml-8 text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                            <div className="flex items-center gap-2">
                                <Check size={14} className="shrink-0" />
                                <span>Esta assinatura será vinculada automaticamente às faturas do <span className="font-bold">{creditCardInput}</span></span>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 hover:shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all mt-6 flex items-center justify-center gap-2"
                >
                    <Check size={20} />
                    {detectedInstallments > 1
                        ? `Salvar ${detectedInstallments} Parcelas`
                        : formData.type === TransactionType.INCOME
                            ? 'Salvar Receita'
                            : 'Salvar Despesa'}
                </button>
            </form>
        )}
      </div>

      {/* Modal - All Transactions - Using Portal to render in body */}
      {showAllTransactions && pendingImport && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-slideUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Todas as Transações</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {pendingImport.result.normalized.length} transações detectadas
                </p>
              </div>
              <button
                onClick={() => setShowAllTransactions(false)}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
              >
                <X size={24} className="text-zinc-600" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {pendingImport.result.normalized.map((t: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors border border-zinc-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-zinc-800">{t.description}</p>
                        <span className={`text-base font-bold shrink-0 ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-zinc-900'}`}>
                          {t.type === 'INCOME' ? '+' : ''} R$ {t.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="bg-white px-2 py-1 rounded border border-zinc-200 font-medium">
                          {t.category}
                        </span>
                        {t.date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(t.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        )}
                        {t.paymentDate && t.paymentDate !== t.date && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <DollarSign size={12} />
                            Venc: {new Date(t.paymentDate).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-100 bg-zinc-50">
              <button
                onClick={() => setShowAllTransactions(false)}
                className="w-full py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AddTransaction;
