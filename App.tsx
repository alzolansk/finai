import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import InsightsPanel from './components/InsightsPanel';
import Onboarding from './components/Onboarding';
import TransactionList from './components/TransactionList';
import { Transaction, UserSettings, ChatMessage, TransactionType, Category, TimePeriod } from './types';
import { getTransactions, saveTransaction, getUserSettings, saveUserSettings, deleteTransaction } from './services/storageService';
import { chatWithAdvisor } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  
  // Date & Period Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [period, setPeriod] = useState<TimePeriod>('month');

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Initial Load
  useEffect(() => {
    setTransactions(getTransactions());
    setSettings(getUserSettings());
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

  if (!settings || !settings.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <Layout 
      activeTab={activeTab === 'history' ? 'dashboard' : activeTab} 
      onTabChange={setActiveTab}
      isChatOpen={isChatOpen}
      onToggleChat={() => setIsChatOpen(!isChatOpen)}
      chatMessages={chatMessages}
      onSendMessage={handleSendMessage}
      isChatLoading={isChatLoading}
    >
      {activeTab === 'dashboard' && (
        <Dashboard 
          transactions={transactions} 
          settings={settings}
          onViewAllHistory={() => setActiveTab('history')}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          period={period}
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
        <InsightsPanel transactions={transactions} />
      )}
    </Layout>
  );
};

export default App;
