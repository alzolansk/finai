import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import InsightsPanel from './components/InsightsPanel';
import PlanningTab from './components/PlanningTab';
import SavingsPlanPage from './components/SavingsPlanPage';
import Onboarding from './components/Onboarding';
import TransactionList from './components/TransactionList';
import { Transaction, UserSettings, ChatMessage, TransactionType, Category, TimePeriod } from './types';
import { calculateMonthlyForecast, generateSmartAlerts } from './services/forecastService';
import { getTransactions, saveTransaction, getUserSettings, saveUserSettings, deleteTransaction, updateTransaction, getSavingsReviews, saveSavingsReview, SavingsReview, getAgendaChecklist, toggleAgendaChecklist, AgendaChecklistEntry } from './services/storageService';
import { chatWithAdvisor } from './services/geminiService';
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

  // Global State
  const [isTurboMode, setIsTurboMode] = useState(false);
  const [reviews, setReviews] = useState<SavingsReview[]>([]);

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
        isRecurring: true // Assuming salary is recurring
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
        isRecurring: true
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

      const responseText = await chatWithAdvisor(apiHistory, transactions);
      
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: responseText,
        timestamp: Date.now()
      };
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
        <PlanningTab 
          transactions={transactions}
          settings={settings}
          forecast={calculateMonthlyForecast(transactions, currentDate, settings, isTurboMode)}
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
    </Layout>
  );
};

export default App;
