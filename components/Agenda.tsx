import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, TransactionType, Category } from '../types';
import { ImportedInvoice, getImportedInvoices, AgendaChecklistEntry } from '../services/storageService';
import { CheckCircle2, Circle, AlertCircle, Calendar, ArrowUpCircle, ArrowDownCircle, Filter, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, X, CreditCard, Receipt, MessageSquare, Send, Link2 } from 'lucide-react';
import { getMonthName } from '../utils/dateUtils';
import { getIconForTransaction } from '../utils/iconMapper';

interface AgendaProps {
  transactions: Transaction[];
  onMarkAsPaid: (item: AgendaItem) => void;
  checklist: AgendaChecklistEntry[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export interface AgendaItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  type: 'EXPENSE' | 'INCOME';
  category?: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  isInvoice: boolean;
  originalTransaction?: Transaction; // For recurring items
  originalInvoice?: ImportedInvoice; // For invoices
}

const Agenda: React.FC<AgendaProps> = ({ transactions, onMarkAsPaid, checklist, currentDate, onDateChange }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<AgendaItem | null>(null);
  const [invoiceQuestion, setInvoiceQuestion] = useState('');
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [invoiceItemFilter, setInvoiceItemFilter] = useState<'all' | 'installments' | 'single' | 'subscriptions'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const agendaItems = useMemo(() => {
    const items: AgendaItem[] = [];
    const invoices = getImportedInvoices();

    // Helper to check if item is manually marked as paid in checklist
    const isMarkedPaid = (targetId: string, date: Date) => {
        const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
        return checklist.find(c => c.targetId === targetId && c.monthKey === monthKey);
    };

    // 1. Process Invoices (Fixed Expenses)
    // Group invoices by issuer and create monthly entries
    const invoicesByIssuer = new Map<string, ImportedInvoice[]>();
    
    invoices.forEach(inv => {
      const issuer = inv.issuer?.toLowerCase() || 'cartão';
      if (!invoicesByIssuer.has(issuer)) {
        invoicesByIssuer.set(issuer, []);
      }
      invoicesByIssuer.get(issuer)!.push(inv);
    });

    // For each issuer, check if there are transactions in the current month
    invoicesByIssuer.forEach((issuerInvoices, issuer) => {
      // Find all transactions for this issuer that have paymentDate in current month
      const monthTransactions = transactions.filter(t => {
        const tPaymentDate = new Date(t.paymentDate || t.date);
        const isInCurrentMonth = tPaymentDate.getMonth() === currentMonth && tPaymentDate.getFullYear() === currentYear;
        
        // Check if this transaction belongs to any invoice from this issuer
        const belongsToIssuer = issuerInvoices.some(inv => 
          inv.transactionIds?.includes(t.id)
        );
        
        return isInCurrentMonth && belongsToIssuer;
      });

      // Find linked subscriptions for this issuer
      const linkedSubscriptions = transactions.filter(t => 
        t.isRecurring && 
        t.linkedToInvoice && 
        t.creditCardIssuer &&
        issuer.includes(t.creditCardIssuer.toLowerCase())
      );

      // If there are transactions OR linked subscriptions in this month, create an agenda item
      if (monthTransactions.length > 0 || linkedSubscriptions.length > 0) {
        const monthlyAmount = monthTransactions.reduce((sum, t) => sum + t.amount, 0) + 
                             linkedSubscriptions.reduce((sum, t) => sum + t.amount, 0);

        // Find the reference invoice (prefer one with due date in this month, or use most recent)
        let referenceInvoice = issuerInvoices.find(inv => {
          const invDate = new Date(inv.dueDate);
          return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
        });

        if (!referenceInvoice) {
          // Use the most recent invoice as reference
          referenceInvoice = issuerInvoices.sort((a, b) => 
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
          )[0];
        }

        // Determine due date: use reference invoice's due date but in current month/year
        const refDueDate = new Date(referenceInvoice.dueDate);
        const dueDate = new Date(currentYear, currentMonth, refDueDate.getDate());

        // Check if paid
        const manualCheck = isMarkedPaid(referenceInvoice.id, dueDate);
        const status = manualCheck ? 'paid' : (new Date() > dueDate ? 'overdue' : 'pending');

        items.push({
          id: `${referenceInvoice.id}-${currentYear}-${currentMonth}`, // Unique ID per month
          title: `Fatura ${referenceInvoice.issuer || 'Cartão'} - ${dueDate.toLocaleDateString('pt-BR', { month: 'long' })}`,
          amount: monthlyAmount,
          dueDate: dueDate.toISOString().split('T')[0],
          type: 'EXPENSE',
          category: 'Cartão de Crédito',
          status,
          paidAt: manualCheck?.paidAt,
          isInvoice: true,
          originalInvoice: referenceInvoice
        });
      }
    });

    // 2. Process Recurring Transactions (Expenses & Income)
    // Find unique recurring definitions from history
    const recurringDefs = new Map<string, Transaction>();
    
    transactions.filter(t => t.isRecurring).forEach(t => {
        // Key by description to find unique recurring items
        // We ignore items with 'issuer' as they are likely inside invoices
        if (!t.issuer) {
            const key = t.description.toLowerCase().trim();
            if (!recurringDefs.has(key)) {
                recurringDefs.set(key, t);
            } else {
                // Update with most recent to get current amount
                const existing = recurringDefs.get(key)!;
                if (new Date(t.date) > new Date(existing.date)) {
                    recurringDefs.set(key, t);
                }
            }
        }
    });

    recurringDefs.forEach((def) => {
        // Skip if this subscription is linked to a credit card invoice
        // (it will be shown inside the invoice details)
        if (def.linkedToInvoice && def.creditCardIssuer) {
            // Find the corresponding invoice for this month
            const linkedInvoice = invoices.find(inv => {
                const invDate = new Date(inv.dueDate);
                const isThisMonth = invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
                return isThisMonth && inv.issuer?.toLowerCase().includes(def.creditCardIssuer!.toLowerCase());
            });

            if (linkedInvoice) {
                // Use invoice due date for linked subscriptions
                const invoiceDueDate = new Date(linkedInvoice.dueDate);
                const manualCheck = isMarkedPaid(def.id, invoiceDueDate);
                
                // Check if occurred using the invoice due date
                const occurredInMonth = transactions.find(t => 
                    t.description.toLowerCase().trim() === def.description.toLowerCase().trim() &&
                    new Date(t.date).getMonth() === currentMonth &&
                    new Date(t.date).getFullYear() === currentYear
                );

                const status = (occurredInMonth || manualCheck) ? 'paid' : (new Date() > invoiceDueDate ? 'overdue' : 'pending');

                items.push({
                    id: def.id,
                    title: def.description,
                    amount: def.amount,
                    dueDate: linkedInvoice.dueDate, // Use invoice due date
                    type: def.type,
                    category: def.category,
                    status,
                    paidAt: occurredInMonth?.date || manualCheck?.paidAt,
                    isInvoice: false,
                    originalTransaction: def
                });
                return; // Skip normal processing
            }
        }

        // Normal processing for non-linked subscriptions
        // Check if this item has occurred in the current month
        const occurredInMonth = transactions.find(t => 
            t.description.toLowerCase().trim() === def.description.toLowerCase().trim() &&
            new Date(t.date).getMonth() === currentMonth &&
            new Date(t.date).getFullYear() === currentYear
        );

        // Determine Due Date for this month
        // Use the day from the definition
        const defDate = new Date(def.date);
        const dueDate = new Date(currentYear, currentMonth, defDate.getDate());
        
        // Check using the original def.id (not the virtual ID)
        const manualCheck = isMarkedPaid(def.id, dueDate);
        const status = (occurredInMonth || manualCheck) ? 'paid' : (new Date() > dueDate ? 'overdue' : 'pending');

        items.push({
            id: def.id, // Use original ID instead of virtual ID
            title: def.description,
            amount: def.amount,
            dueDate: dueDate.toISOString().split('T')[0],
            type: def.type,
            category: def.category,
            status,
            paidAt: occurredInMonth?.date || manualCheck?.paidAt,
            isInvoice: false,
            originalTransaction: def
        });
    });

    // 3. Process Non-Recurring, Non-Invoice Transactions (One-offs & Installments)
    transactions.forEach(t => {
        const pDate = new Date(t.paymentDate || t.date);
        const isThisMonth = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
        
        if (isThisMonth && !t.isRecurring && !t.issuer) {
             const manualCheck = isMarkedPaid(t.id, pDate);
             const isFuture = pDate > new Date();
             
             // If it's in transactions, it's technically "recorded/paid" unless it's a future scheduled payment
             const status = manualCheck ? 'paid' : (isFuture ? 'pending' : 'paid');
             
             items.push({
                id: t.id,
                title: t.description,
                amount: t.amount,
                dueDate: (t.paymentDate || t.date).split('T')[0],
                type: t.type,
                category: t.category,
                status: status as 'pending' | 'paid' | 'overdue',
                paidAt: status === 'paid' ? (t.paymentDate || t.date) : undefined,
                isInvoice: false,
                originalTransaction: t
             });
        }
    });

    return items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [transactions, currentMonth, currentYear, checklist]);

  const filteredItems = agendaItems.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (typeFilter !== 'all' && item.type.toLowerCase() !== typeFilter) return false;
    return true;
  });

  const expenses = filteredItems.filter(i => i.type === 'EXPENSE');
  const income = filteredItems.filter(i => i.type === 'INCOME');

  const totalExpenses = agendaItems.filter(i => i.type === 'EXPENSE').length;
  const paidExpenses = agendaItems.filter(i => i.type === 'EXPENSE' && i.status === 'paid').length;
  
  const totalIncome = agendaItems.filter(i => i.type === 'INCOME').length;
  const receivedIncome = agendaItems.filter(i => i.type === 'INCOME' && i.status === 'paid').length;

  return (
    <div className="space-y-8 pb-24 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-light text-zinc-800">Agenda</h2>
          <p className="text-zinc-500 text-sm mt-1">Controle de pagamentos e recebimentos do mês.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-zinc-100">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
              <Calendar size={16} className="text-emerald-600" />
              <span className="font-bold text-zinc-800 capitalize">
                {getMonthName(currentDate)}
              </span>
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex gap-2 bg-white p-1 rounded-xl border border-zinc-200 shadow-sm">
            <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
            >
                Todos
            </button>
            <button 
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'pending' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
            >
                Pendentes
            </button>
            <button 
                onClick={() => setFilter('paid')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'paid' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
            >
                Pagos
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                        <ArrowDownCircle size={20} />
                    </div>
                    <h3 className="font-bold text-zinc-800">Contas a Pagar</h3>
                </div>
                <span className="text-sm font-bold text-zinc-500">{paidExpenses}/{totalExpenses}</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${totalExpenses ? (paidExpenses / totalExpenses) * 100 : 0}%` }}
                ></div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <ArrowUpCircle size={20} />
                    </div>
                    <h3 className="font-bold text-zinc-800">Recebimentos</h3>
                </div>
                <span className="text-sm font-bold text-zinc-500">{receivedIncome}/{totalIncome}</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${totalIncome ? (receivedIncome / totalIncome) * 100 : 0}%` }}
                ></div>
            </div>
        </div>
      </div>

      {/* Tables */}
      <div className="space-y-8">
        {/* Expenses Table */}
        <section>
            <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                Gastos Fixos & Faturas
            </h3>
            <div className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50/50 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                            <th className="p-4 font-bold">Nome</th>
                            <th className="p-4 font-bold">Categoria</th>
                            <th className="p-4 font-bold">Vencimento</th>
                            <th className="p-4 font-bold">Valor</th>
                            <th className="p-4 font-bold text-center">Status</th>
                            <th className="p-4 font-bold text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {expenses.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-zinc-400 italic">
                                    Nenhum gasto fixo encontrado para este filtro.
                                </td>
                            </tr>
                        ) : (
                            expenses.map(item => {
                                const iconConfig = getIconForTransaction(item.title, item.category);
                                const IconComponent = iconConfig.icon;
                                
                                return (
                                <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.isInvoice ? 'bg-zinc-900' : iconConfig.bgColor}`}>
                                                {item.isInvoice ? (
                                                    <CreditCard size={16} className="text-white" />
                                                ) : (
                                                    <IconComponent size={14} className={iconConfig.iconColor} />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-zinc-800">{item.title}</p>
                                                    {item.originalTransaction?.linkedToInvoice && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full" title={`Vinculado à fatura ${item.originalTransaction.creditCardIssuer}`}>
                                                            <Link2 size={9} /> {item.originalTransaction.creditCardIssuer}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.isInvoice && (
                                                    <button 
                                                        onClick={() => setSelectedInvoice(item)}
                                                        className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <Receipt size={10} /> Ver fatura completa
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-zinc-500">{item.category}</td>
                                    <td className="p-4 text-sm font-mono text-zinc-600">
                                        {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="p-4 font-bold text-zinc-800">
                                        R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => onMarkAsPaid(item)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 cursor-pointer ${
                                            item.status === 'paid' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                            item.status === 'overdue' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' :
                                            'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        }`}>
                                            {item.status === 'paid' ? <CheckCircle2 size={12} /> : 
                                             item.status === 'overdue' ? <AlertCircle size={12} /> : <Circle size={12} />}
                                            {item.status === 'paid' ? 'Pago' : item.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {item.status !== 'paid' && (
                                            <button 
                                                onClick={() => onMarkAsPaid(item)}
                                                className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                Marcar Pago
                                            </button>
                                        )}
                                        {item.status === 'paid' && item.paidAt && (
                                            <span className="text-xs text-zinc-400">
                                                em {new Date(item.paidAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-zinc-50 border-t-2 border-zinc-200">
                            <td colSpan={3} className="p-4 font-bold text-zinc-800 text-right">Subtotal</td>
                            <td className="p-4 font-bold text-rose-600 text-lg">
                                R$ {expenses.reduce((sum, item) => sum + item.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>

        {/* Income Table */}
        <section>
            <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                Recebimentos Fixos
            </h3>
            <div className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50/50 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                            <th className="p-4 font-bold">Nome</th>
                            <th className="p-4 font-bold">Origem</th>
                            <th className="p-4 font-bold">Previsão</th>
                            <th className="p-4 font-bold">Valor</th>
                            <th className="p-4 font-bold text-center">Status</th>
                            <th className="p-4 font-bold text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {income.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-zinc-400 italic">
                                    Nenhum recebimento fixo encontrado.
                                </td>
                            </tr>
                        ) : (
                            income.map(item => {
                                const iconConfig = getIconForTransaction(item.title, item.category);
                                const IconComponent = iconConfig.icon;
                                
                                return (
                                <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                <IconComponent size={14} className="text-emerald-600" />
                                            </div>
                                            <p className="font-bold text-zinc-800">{item.title}</p>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-zinc-500">{item.category}</td>
                                    <td className="p-4 text-sm font-mono text-zinc-600">
                                        {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="p-4 font-bold text-emerald-600">
                                        R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => onMarkAsPaid(item)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 cursor-pointer ${
                                            item.status === 'paid' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                            item.status === 'overdue' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' :
                                            'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                        }`}>
                                            {item.status === 'paid' ? <CheckCircle2 size={12} /> : 
                                             item.status === 'overdue' ? <AlertCircle size={12} /> : <Circle size={12} />}
                                            {item.status === 'paid' ? 'Recebido' : item.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {item.status !== 'paid' && (
                                            <button 
                                                onClick={() => onMarkAsPaid(item)}
                                                className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                Confirmar
                                            </button>
                                        )}
                                        {item.status === 'paid' && item.paidAt && (
                                            <span className="text-xs text-zinc-400">
                                                em {new Date(item.paidAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                            <td colSpan={3} className="p-4 font-bold text-zinc-800 text-right">Subtotal</td>
                            <td className="p-4 font-bold text-emerald-600 text-lg">
                                R$ {income.reduce((sum, item) => sum + item.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && selectedInvoice.isInvoice && selectedInvoice.originalInvoice?.transactionIds && (() => {
        // Bank theme helper
        const issuer = selectedInvoice.originalInvoice?.issuer?.toLowerCase() || '';
        const getBankTheme = () => {
          if (issuer.includes('nubank')) {
            return {
              gradient: 'from-purple-700 to-purple-900',
              accent: 'bg-purple-500/10',
              iconHover: 'group-hover:border-purple-200 group-hover:bg-purple-50 group-hover:text-purple-600',
              aiIcon: 'text-purple-600',
              button: 'bg-purple-600 hover:bg-purple-700',
              ring: 'focus:ring-purple-500'
            };
          } else if (issuer.includes('picpay')) {
            return {
              gradient: 'from-emerald-600 to-emerald-800',
              accent: 'bg-emerald-500/10',
              iconHover: 'group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-600',
              aiIcon: 'text-emerald-600',
              button: 'bg-emerald-600 hover:bg-emerald-700',
              ring: 'focus:ring-emerald-500'
            };
          } else if (issuer.includes('bradesco')) {
            return {
              gradient: 'from-red-700 to-red-900',
              accent: 'bg-red-500/10',
              iconHover: 'group-hover:border-red-200 group-hover:bg-red-50 group-hover:text-red-600',
              aiIcon: 'text-red-600',
              button: 'bg-red-600 hover:bg-red-700',
              ring: 'focus:ring-red-500'
            };
          }
          // Default (generic)
          return {
            gradient: 'from-zinc-900 to-zinc-800',
            accent: 'bg-emerald-500/10',
            iconHover: 'group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-600',
            aiIcon: 'text-emerald-600',
            button: 'bg-emerald-600 hover:bg-emerald-700',
            ring: 'focus:ring-emerald-500'
          };
        };
        const theme = getBankTheme();
        
        return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className={`bg-gradient-to-r ${theme.gradient} p-6 relative overflow-hidden`}>
              <div className={`absolute top-0 right-0 w-64 h-64 ${theme.accent} rounded-full blur-3xl`}></div>
              <div className="relative z-10 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{selectedInvoice.title}</h3>
                    <p className="text-zinc-300 text-sm">Vencimento: {new Date(selectedInvoice.dueDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <X size={24} />
                </button>
              </div>
              
              {/* Total */}
              <div className="mt-6 relative z-10">
                <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Valor Total (Mês Atual)</p>
                <p className="text-4xl font-bold text-white">R$ {selectedInvoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Items List */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={14} />
                  Itens da Fatura (Mês Atual)
                </h4>
                <div className="relative">
                  <button
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-all text-xs font-medium text-zinc-700"
                  >
                    <Filter size={14} />
                    {invoiceItemFilter === 'all' ? 'Todas' : 
                     invoiceItemFilter === 'installments' ? 'Parceladas' :
                     invoiceItemFilter === 'subscriptions' ? 'Assinaturas' : 'Avulsas'}
                    <ChevronDown size={14} className={`transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isFilterDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-zinc-200 py-2 z-10 animate-fadeIn">
                      <button
                        onClick={() => { setInvoiceItemFilter('all'); setIsFilterDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                          invoiceItemFilter === 'all' 
                            ? 'bg-zinc-100 text-zinc-900' 
                            : 'text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        Todas
                      </button>
                      <button
                        onClick={() => { setInvoiceItemFilter('installments'); setIsFilterDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                          invoiceItemFilter === 'installments' 
                            ? 'bg-zinc-100 text-zinc-900' 
                            : 'text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        Parceladas
                      </button>
                      <button
                        onClick={() => { setInvoiceItemFilter('single'); setIsFilterDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                          invoiceItemFilter === 'single' 
                            ? 'bg-zinc-100 text-zinc-900' 
                            : 'text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        Avulsas
                      </button>
                      {/* Show subscriptions filter only if there are linked subscriptions */}
                      {transactions.some(t => 
                        t.isRecurring && 
                        t.linkedToInvoice && 
                        t.creditCardIssuer &&
                        selectedInvoice.originalInvoice!.issuer?.toLowerCase().includes(t.creditCardIssuer.toLowerCase())
                      ) && (
                        <button
                          onClick={() => { setInvoiceItemFilter('subscriptions'); setIsFilterDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                            invoiceItemFilter === 'subscriptions' 
                              ? 'bg-zinc-100 text-zinc-900' 
                              : 'text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          Assinaturas
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {/* Linked Subscriptions - Only show if filter is 'all' or 'subscriptions' */}
                {(invoiceItemFilter === 'all' || invoiceItemFilter === 'subscriptions') && transactions
                  .filter(t => 
                    t.isRecurring && 
                    t.linkedToInvoice && 
                    t.creditCardIssuer &&
                    selectedInvoice.originalInvoice!.issuer?.toLowerCase().includes(t.creditCardIssuer.toLowerCase())
                  )
                  .map(sub => {
                    const iconConfig = getIconForTransaction(sub.description, sub.category);
                    const IconComponent = iconConfig.icon;
                    
                    return (
                    <div key={`linked-${sub.id}`} className="bg-blue-50 border-2 border-blue-200 rounded-2xl hover:bg-blue-100 transition-colors group">
                      <div className="flex justify-between items-center p-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-300 group-hover:border-blue-400 transition-all`}>
                            <IconComponent size={20} className="text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-zinc-800">{sub.description}</p>
                              <span className="px-2 py-0.5 bg-blue-200 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide">
                                Assinatura Vinculada
                              </span>
                            </div>
                            <p className="text-xs text-blue-600 font-medium">Cobrança mensal automática • {sub.category}</p>
                          </div>
                        </div>
                        <span className="font-bold text-blue-700 text-lg">
                          R$ {sub.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    );
                  })
                }

                {/* Regular invoice transactions */}
                {(invoiceItemFilter !== 'subscriptions') && transactions
                  .filter(t => {
                    // Check if transaction belongs to any invoice from this issuer
                    const belongsToIssuer = getImportedInvoices()
                      .filter(inv => inv.issuer?.toLowerCase() === selectedInvoice.originalInvoice!.issuer?.toLowerCase())
                      .some(inv => inv.transactionIds?.includes(t.id));
                    
                    if (!belongsToIssuer) return false;
                    
                    const tPaymentDate = new Date(t.paymentDate || t.date);
                    const isInCurrentMonth = tPaymentDate.getMonth() === currentMonth && tPaymentDate.getFullYear() === currentYear;
                    if (!isInCurrentMonth) return false;
                    
                    // Apply item filter
                    const installmentMatch = t.description.match(/\((\d+)\/(\d+)\)/);
                    const isInstallment = !!installmentMatch;
                    
                    // Exclude from 'installments' if it's a linked subscription
                    const isLinkedSubscription = t.isRecurring && t.linkedToInvoice;
                    
                    if (invoiceItemFilter === 'installments') return isInstallment && !isLinkedSubscription;
                    if (invoiceItemFilter === 'single') return !isInstallment && !isLinkedSubscription;
                    if (invoiceItemFilter === 'all') return !isLinkedSubscription; // Exclude subscriptions from 'all' as they're shown separately
                    return true;
                  })
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(t => {
                    // Check if this is an installment
                    const installmentMatch = t.description.match(/\((\d+)\/(\d+)\)/);
                    const isInstallment = !!installmentMatch;
                    const currentInstallment = isInstallment ? parseInt(installmentMatch![1]) : null;
                    const totalInstallments = isInstallment ? parseInt(installmentMatch![2]) : null;
                    
                    // Calculate installment progress
                    let installmentInfo = null;
                    if (isInstallment && currentInstallment && totalInstallments) {
                      const progress = (currentInstallment / totalInstallments) * 100;
                      const remaining = totalInstallments - currentInstallment;
                      const paid = currentInstallment - 1; // Previous installments
                      installmentInfo = { current: currentInstallment, total: totalInstallments, progress, remaining, paid };
                    }
                    
                    const iconConfig = getIconForTransaction(t.description, t.category);
                    const IconComponent = iconConfig.icon;
                    
                    return (
                    <div key={t.id} className="bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-colors group">
                      <div className="flex justify-between items-center p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-zinc-200 ${theme.iconHover} transition-all`}>
                          <IconComponent size={20} className={iconConfig.iconColor} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800">{t.description}</p>
                          <p className="text-xs text-zinc-400">{new Date(t.date).toLocaleDateString('pt-BR')} • {t.category}</p>
                        </div>
                      </div>
                      <span className="font-bold text-zinc-900 text-lg">
                        R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      </div>
                      
                      {/* Installment Progress */}
                      {installmentInfo && (
                        <div className="px-4 pb-4 pt-2 border-t border-zinc-200/50 mt-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-4 text-xs">
                              <span className="text-emerald-600 font-bold">✓ {installmentInfo.paid} pagas</span>
                              <span className="text-zinc-500">• {installmentInfo.remaining} restantes</span>
                              <span className="text-zinc-400">{installmentInfo.progress.toFixed(0)}% concluído</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${theme.gradient.includes('purple') ? 'bg-purple-500' : theme.gradient.includes('red') ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${installmentInfo.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-zinc-700 whitespace-nowrap">
                              R$ {(t.amount * totalInstallments!).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                  })
                }
                {transactions.filter(t => {
                  if (!selectedInvoice.originalInvoice!.transactionIds!.includes(t.id)) return false;
                  const tPaymentDate = new Date(t.paymentDate || t.date);
                  return tPaymentDate.getMonth() === currentMonth && tPaymentDate.getFullYear() === currentYear;
                }).length === 0 && (
                  <div className="p-8 text-center text-zinc-400 text-sm italic bg-zinc-50 rounded-2xl">
                    Nenhum item desta fatura vence no mês atual.
                  </div>
                )}
              </div>
            </div>

            {/* AI Assistant */}
            <div className="border-t border-zinc-100 p-6 bg-zinc-50">
              <h4 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                <MessageSquare size={16} className={theme.aiIcon} />
                Perguntar à IA sobre esta fatura
              </h4>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (invoiceQuestion.trim()) {
                  setIsAskingAI(true);
                  // TODO: Integrate with chatWithAdvisor
                  setTimeout(() => {
                    alert('Funcionalidade de IA em desenvolvimento. Pergunta: ' + invoiceQuestion);
                    setInvoiceQuestion('');
                    setIsAskingAI(false);
                  }, 1000);
                }
              }} className="flex gap-2">
                <input 
                  type="text" 
                  value={invoiceQuestion}
                  onChange={(e) => setInvoiceQuestion(e.target.value)}
                  placeholder="Ex: Por que este valor está alto?"
                  className={`flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 ${theme.ring} focus:border-transparent outline-none text-sm`}
                  disabled={isAskingAI}
                />
                <button 
                  type="submit"
                  disabled={!invoiceQuestion.trim() || isAskingAI}
                  className={`px-6 py-3 ${theme.button} text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2`}
                >
                  {isAskingAI ? 'Perguntando...' : <><Send size={16} /> Perguntar</>}
                </button>
              </form>
            </div>

          </div>
        </div>,
        document.body
      );
      })()}
    </div>
  );
};

export default Agenda;
