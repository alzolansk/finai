import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import InsightsPanel from './components/InsightsPanel';
import WishlistTab from './components/WishlistTab';
import SavingsPlanPage from './components/SavingsPlanPage';
import Onboarding from './components/Onboarding';
import TransactionList from './components/TransactionList';
import ImportHistoryPage from './components/ImportHistoryPage';
import { Transaction, UserSettings, ChatMessage, TransactionType, Category, TimePeriod, WishlistItem, WishlistPriority, WishlistItemType } from './types';
import { generateSmartAlerts } from './services/forecastService';
import { getTransactions, saveTransaction, getUserSettings, saveUserSettings, deleteTransaction, updateTransaction, getSavingsReviews, saveSavingsReview, SavingsReview, getAgendaChecklist, toggleAgendaChecklist, AgendaChecklistEntry, getWishlistItems, saveWishlistItem, deleteWishlistItem, getImportedInvoices } from './services/storageService';
import { chatWithAdvisor, researchWishlistItem, analyzeWishlistViability } from './services/geminiService';
import { SavingsPlanAction } from './services/savingsService';
import ReviewRecommendationPanel from './components/ReviewRecommendationPanel';
import Agenda, { AgendaItem } from './components/Agenda';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [agendaChecklist, setAgendaChecklist] = useState<AgendaChecklistEntry[]>([]);
  
  // Date & Period Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [period, setPeriod] = useState<TimePeriod>('month');

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatActionLoadingId, setChatActionLoadingId] = useState<string | null>(null);

  // Global State
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [reviews, setReviews] = useState<SavingsReview[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

  // Review Panel State
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);
  const [selectedReviewAction, setSelectedReviewAction] = useState<SavingsPlanAction | null>(null);

  // Derived State
  const alerts = React.useMemo(() => generateSmartAlerts(transactions, settings, isTurboMode), [transactions, settings, isTurboMode]);

  // Initial Load
  useEffect(() => {
    setTransactions(getTransactions());
    setSettings(getUserSettings());
    setReviews(getSavingsReviews());
    setAgendaChecklist(getAgendaChecklist());
    setWishlistItems(getWishlistItems());
  }, []);

  const handleAddTransactions = (newTransactions: Transaction[]) => {
    let updated = transactions;
    // Process all transactions
    newTransactions.forEach(t => {
        updated = saveTransaction(t);
    });
    setTransactions(updated);
    setActiveTab('dashboard');
  };

  const handleDeleteTransaction = (id: string) => {
      const updated = deleteTransaction(id);
      setTransactions(updated);
  };

  const handleUpdateTransaction = (transaction: Transaction) => {
      const updated = updateTransaction(transaction);
      setTransactions(updated);
  };

  const handleOnboardingComplete = (newSettings: UserSettings) => {
    // 1. Save Settings
    saveUserSettings(newSettings);
    setSettings(newSettings);
    const dateNow = new Date().toISOString();

    // 2. Add Monthly Income as a Transaction (Revenue) automatically
    const incomeTransaction: Transaction = {
        id: crypto.randomUUID(),
        description: 'Salário Mensal',
        amount: newSettings.monthlyIncome,
        category: Category.SALARY,
        type: TransactionType.INCOME,
        date: dateNow,
        isRecurring: true, // Assuming salary is recurring
        createdAt: Date.now()
    };

    // 3. Convert Fixed Expenses to Actual Transactions
    const expenseTransactions: Transaction[] = newSettings.fixedExpenses
      .filter(exp => exp.amount > 0)
      .map(exp => ({
        id: crypto.randomUUID(),
        description: exp.description,
        amount: exp.amount,
        category: Category.SUBSCRIPTIONS,
        type: TransactionType.EXPENSE,
        date: dateNow,
        isRecurring: true,
        createdAt: Date.now()
      }));

    const allNewTransactions = [incomeTransaction, ...expenseTransactions];

    // 4. Persist Transactions
    let currentAll = getTransactions();
    allNewTransactions.forEach(t => {
       currentAll = [t, ...currentAll];
    });
    
    // Manually saving the bulk update to local storage to be efficient
    localStorage.setItem('finai_transactions', JSON.stringify(currentAll));
    setTransactions(currentAll);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isPurchaseIntent = (text: string) => {
    const lower = text.toLowerCase();
    const keywords = ['comprar', 'posso comprar', 'consigo comprar', 'compraria', 'adicionar na lista', 'colocar na lista', 'botar na lista'];
    return keywords.some(k => lower.includes(k));
  };

  const extractItemName = (text: string) => {
    const lower = text.toLowerCase();
    const idx = lower.indexOf('comprar');
    if (idx >= 0) {
      const sliced = text.substring(idx + 'comprar'.length).replace(/\?/g, '').trim();
      if (sliced.length > 0) return sliced;
    }
    return text.replace(/\?/g, '').trim();
  };

  const handleSendMessage = async (text: string) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...chatMessages, newMessage];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);

    try {
      // Format history for Gemini
        const apiHistory = updatedMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));

        const invoiceSnapshots = getImportedInvoices()
          .slice(0, 8)
          .map(inv => {
            const issuerLower = inv.issuer?.toLowerCase();
            const items = inv.transactionIds
              ? transactions.filter(t => inv.transactionIds!.includes(t.id))
              : transactions.filter(t => {
                  if (!issuerLower) return false;
                  const transactionIssuer = t.issuer?.toLowerCase();
                  const cardIssuer = t.creditCardIssuer?.toLowerCase();

                  return (transactionIssuer && transactionIssuer.includes(issuerLower)) ||
                         (cardIssuer && cardIssuer.includes(issuerLower));
                });

            const currentMonthTotal = items
              .filter(t => {
                const d = new Date(t.paymentDate || t.date);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
              })
              .reduce((sum, t) => sum + t.amount, 0);

            return {
              title: `Fatura ${inv.issuer || 'Cartao'}`,
              issuer: inv.issuer,
              dueDate: inv.dueDate,
              amount: inv.totalAmount,
              itemCount: inv.transactionIds?.length || inv.transactionCount,
              currentMonthTotal
            };
          });

        const now = new Date();
        const horizon = new Date();
        horizon.setMonth(horizon.getMonth() + 2);
        const upcomingPayments = transactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .filter(t => {
            const due = new Date(t.paymentDate || t.date);
            return due >= now && due <= horizon;
          })
          .sort((a, b) => new Date(a.paymentDate || a.date).getTime() - new Date(b.paymentDate || b.date).getTime())
          .slice(0, 20)
          .map(t => ({
            title: t.description,
            amount: t.amount,
            dueDate: t.paymentDate || t.date,
            category: t.category,
            type: t.type,
            status: 'pending' as const,
            source: (t.issuer || (t.isCreditPurchase && t.creditCardIssuer)) ? 'invoice' : 'transaction'
          }));

        const response = await chatWithAdvisor(apiHistory, transactions, {
          wishlistItems,
          upcomingPayments,
          invoiceSummaries: invoiceSnapshots
        });

        const botMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: response.text,
          timestamp: Date.now(),
          cta: response.cta,
          uiActions: response.cta?.type === 'wishlist_add' ? [
            { id: 'cta-yes', label: 'Sim', action: 'approve_cta' },
            { id: 'cta-no', label: 'Nao', action: 'reject_cta' }
          ] : undefined
        };

        // Fallback CTA if the model didn't emit but intent is purchase
        if (!botMessage.cta && isPurchaseIntent(text)) {
          const name = extractItemName(text);
          botMessage.cta = { type: 'wishlist_add', name };
          botMessage.uiActions = [
            { id: 'cta-yes', label: 'Sim', action: 'approve_cta' },
            { id: 'cta-no', label: 'Nao', action: 'reject_cta' }
          ];
        }

        setChatMessages(prev => [...prev, botMessage]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleOpenReview = (action: SavingsPlanAction) => {
    setSelectedReviewAction(action);
    setIsReviewPanelOpen(true);
    setIsChatOpen(false);
  };

  const handleCloseReview = () => {
    setIsReviewPanelOpen(false);
    setSelectedReviewAction(null);
  };

  const handleSaveReview = (review: SavingsReview) => {
    const updated = saveSavingsReview(review);
    setReviews(updated);
    handleCloseReview();
  };

  const handleMarkAsPaid = (item: AgendaItem) => {
    // Just toggle the checklist status, do NOT create a transaction
    // For recurring items, use the originalTransaction ID
    // For invoices, use the original invoice ID (without month suffix)
    // For one-off items, use the item ID
    let targetId: string;

    if (item.isInvoice && item.originalInvoice) {
      targetId = item.originalInvoice.id;
    } else if (item.originalTransaction) {
      targetId = item.originalTransaction.id;
    } else {
      targetId = item.id;
    }

    const entry: AgendaChecklistEntry = {
        targetId: targetId,
        monthKey: item.dueDate.substring(0, 7), // YYYY-MM
        paidAt: new Date().toISOString()
    };

    const updated = toggleAgendaChecklist(entry);
    setAgendaChecklist(updated);
  };

  const handleAddWishlistItem = (item: WishlistItem) => {
    const updated = saveWishlistItem(item);
    setWishlistItems(updated);
  };

  const handleUpdateWishlistItem = (item: WishlistItem) => {
    const updated = saveWishlistItem(item);
    setWishlistItems(updated);
  };

  const handleDeleteWishlistItem = (id: string) => {
    const updated = deleteWishlistItem(id);
    setWishlistItems(updated);
  };

  const handleChatAction = async (message: ChatMessage, actionId: string) => {
    if (!message.cta || message.cta.type !== 'wishlist_add') return;

    if (actionId === 'cta-no') {
      setChatMessages(prev => prev.map(m => m.id === message.id ? { ...m, uiActions: undefined, ctaStatus: 'rejected' } : m));
      return;
    }

    const loadingKey = `${message.id}:${actionId}`;
    setChatActionLoadingId(loadingKey);

    try {
      const itemName = message.cta.name;
      const priceData = await researchWishlistItem(itemName);

      // Calculate monthly expenses (average of last 3 months)
      const now = new Date();
      const months = [0, 1, 2].map(offset => {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return `${d.getFullYear()}-${d.getMonth()}`;
      });
      const monthlyExpenses = months.reduce((sum, key) => {
        const [y, m] = key.split('-').map(Number);
        const total = transactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .filter(t => {
            const d = new Date(t.paymentDate || t.date);
            return d.getFullYear() === y && d.getMonth() === m;
          })
          .reduce((s, t) => s + t.amount, 0);
        return sum + total;
      }, 0) / (months.length || 1);

      const viability = await analyzeWishlistViability(
        itemName,
        priceData.estimatedPrice,
        settings?.monthlyIncome || 0,
        monthlyExpenses || 0,
        'cash'
      );

      const newItem: WishlistItem = {
        id: crypto.randomUUID(),
        name: itemName,
        description: priceData.description,
        targetAmount: priceData.estimatedPrice,
        savedAmount: 0,
        type: WishlistItemType.PURCHASE,
        priority: WishlistPriority.MEDIUM,
        paymentOption: 'cash',
        isViable: viability.isViable,
        viabilityDate: viability.viabilityDate || undefined,
        aiAnalysis: viability.analysis,
        aiRecommendation: viability.recommendation,
        priceResearchConfidence: priceData.confidence,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdViaChat: true
      };

      const updated = saveWishlistItem(newItem);
      setWishlistItems(updated);

      setChatMessages(prev => prev.map(m => m.id === message.id ? { ...m, uiActions: undefined, ctaStatus: 'approved' } : m));

      const confirmMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Adicionei "${itemName}" na Lista de Desejos com valor estimado de R$ ${priceData.estimatedPrice.toFixed(2)} (via chat). Viabilidade: ${viability.isViable ? 'viavel agora' : 'planejando'}.`,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, confirmMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setChatActionLoadingId(null);
    }
  };

  if (!settings || !settings.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <Layout 
      activeTab={activeTab === 'history' ? 'dashboard' : activeTab} 
      onTabChange={setActiveTab}
      isChatOpen={isChatOpen}
      onToggleChat={() => {
        setIsChatOpen(!isChatOpen);
        if (!isChatOpen) setIsReviewPanelOpen(false);
      }}
      chatMessages={chatMessages}
      onSendMessage={handleSendMessage}
      isChatLoading={isChatLoading}
      onChatAction={handleChatAction}
      chatActionLoadingId={chatActionLoadingId}
      alerts={alerts}
      isTurboMode={isTurboMode}
      onToggleTurboMode={() => setIsTurboMode(!isTurboMode)}
      extraPanel={
        <ReviewRecommendationPanel 
          isOpen={isReviewPanelOpen}
          onClose={handleCloseReview}
          recommendation={selectedReviewAction}
          onSave={handleSaveReview}
        />
      }
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
          transactions={transactions} 
          settings={settings}
          reviews={reviews}
          alerts={alerts}
          onViewAllHistory={() => setActiveTab('history')}
          onViewSavingsPlan={() => setActiveTab('savings-plan')}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          period={period}
          isTurboMode={isTurboMode}
          onToggleTurboMode={() => setIsTurboMode(!isTurboMode)}
        />
      )}
      
      {activeTab === 'history' && (
          <TransactionList 
            transactions={transactions} 
            onDelete={handleDeleteTransaction}
            onBack={() => setActiveTab('dashboard')}
          />
      )}

      {activeTab === 'add' && (
        <AddTransaction
          onAdd={handleAddTransactions}
          onCancel={() => setActiveTab('dashboard')}
          existingTransactions={transactions}
        />
      )}

      {activeTab === 'insights' && (
        <InsightsPanel 
          transactions={transactions} 
          onUpdate={handleUpdateTransaction}
          onDelete={handleDeleteTransaction}
          onAdd={(t) => handleAddTransactions([t])}
        />
      )}

      {activeTab === 'agenda' && (
        <Agenda 
          transactions={transactions}
          onMarkAsPaid={handleMarkAsPaid}
          checklist={agendaChecklist}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />
      )}

      {activeTab === 'planning' && (
        <WishlistTab
          transactions={transactions}
          settings={settings}
          wishlistItems={wishlistItems}
          onAddItem={handleAddWishlistItem}
          onUpdateItem={handleUpdateWishlistItem}
          onDeleteItem={handleDeleteWishlistItem}
        />
      )}

      {activeTab === 'savings-plan' && (
        <SavingsPlanPage
          transactions={transactions}
          settings={settings}
          reviews={reviews}
          onReview={handleOpenReview}
          onBack={() => setActiveTab('dashboard')}
        />
      )}

      {activeTab === 'import-history' && (
        <ImportHistoryPage
          onBack={() => setActiveTab('dashboard')}
          onImportDeleted={() => setTransactions(getTransactions())}
        />
      )}
    </Layout>
  );
};

export default App;
