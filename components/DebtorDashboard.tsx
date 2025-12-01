import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { ChevronDown, ChevronUp, DollarSign, Users, CheckCircle } from 'lucide-react';

interface DebtorDashboardProps {
  transactions: Transaction[];
}

interface DebtorSummary {
  name: string;
  totalPending: number;
  totalPaid: number;
  transactions: Transaction[];
}

export default function DebtorDashboard({ transactions }: DebtorDashboardProps) {
  const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null);

  // Group transactions by debtor
  const debtorSummaries = useMemo(() => {
    const summaries = new Map<string, DebtorSummary>();

    transactions
      .filter(t =>
        // INCOME with debtor OR EXPENSE that is reimbursable
        (t.type === TransactionType.INCOME && t.debtor) ||
        (t.type === TransactionType.EXPENSE && t.isReimbursable)
      )
      .forEach(transaction => {
        // Get debtor name from either field
        const debtorName = transaction.type === TransactionType.INCOME
          ? transaction.debtor!
          : transaction.reimbursedBy || 'Sem nome';

        if (!summaries.has(debtorName)) {
          summaries.set(debtorName, {
            name: debtorName,
            totalPending: 0,
            totalPaid: 0,
            transactions: []
          });
        }

        const summary = summaries.get(debtorName)!;
        summary.transactions.push(transaction);

        // Check if payment is pending
        // For debtor income: consider pending if future date OR within last 30 days
        // This allows users to track debts that are due or recently due
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const paymentDate = transaction.paymentDate
          ? new Date(transaction.paymentDate)
          : new Date(transaction.date);

        paymentDate.setHours(0, 0, 0, 0);

        // Consider "pending" if:
        // - Future date (not yet due)
        // - Within last 30 days (recently due, likely not paid yet)
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const isPending = paymentDate >= thirtyDaysAgo;

        if (isPending) {
          summary.totalPending += transaction.amount;
        } else {
          summary.totalPaid += transaction.amount;
        }
      });

    // Sort by total pending (descending)
    return Array.from(summaries.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [transactions]);

  const totalPendingAll = useMemo(() => {
    return debtorSummaries.reduce((sum, debtor) => sum + debtor.totalPending, 0);
  }, [debtorSummaries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short'
    }).format(date);
  };

  const toggleDebtor = (debtorName: string) => {
    setExpandedDebtor(expandedDebtor === debtorName ? null : debtorName);
  };

  if (debtorSummaries.length === 0) {
    return (
      <div className="animate-fadeIn pb-20">
        <div className="mb-6">
          <h2 className="text-3xl font-light text-zinc-800 mb-2">📊 Dashboard de Cobrança</h2>
          <p className="text-zinc-500 text-sm">Acompanhe suas pendências por pessoa</p>
        </div>

        <div className="bg-zinc-100 rounded-3xl p-8 text-center border border-zinc-200">
          <Users className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-600 mb-2 font-semibold">Nenhuma pendência cadastrada</p>
          <p className="text-sm text-zinc-500">
            Adicione receitas com devedor para começar a acompanhar suas cobranças
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn pb-20">
      <div className="mb-6">
        <h2 className="text-3xl font-light text-zinc-800 mb-2">📊 Dashboard de Cobrança</h2>
        <p className="text-zinc-500 text-sm">Acompanhe suas pendências por pessoa</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Total Summary Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl p-6 border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-700 font-semibold mb-1">Total Pendente</p>
              <p className="text-3xl font-bold text-emerald-900">{formatCurrency(totalPendingAll)}</p>
              <p className="text-xs text-emerald-600 mt-1">
                {debtorSummaries.filter(d => d.totalPending > 0).length} pessoa(s) com pendências
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-emerald-600/30" />
          </div>
        </div>

        {/* Debtor List */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider px-2">
            Pendências por Pessoa
          </h2>

          {debtorSummaries.map((debtor) => (
            <div
              key={debtor.name}
              className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm"
            >
              {/* Debtor Header */}
              <button
                onClick={() => toggleDebtor(debtor.name)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {debtor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-zinc-800">{debtor.name}</p>
                    <p className="text-xs text-zinc-500">
                      {debtor.transactions.length} transação(ões)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      debtor.totalPending > 0 ? 'text-emerald-600' : 'text-zinc-400'
                    }`}>
                      {formatCurrency(debtor.totalPending)}
                    </p>
                    {debtor.totalPending === 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs mt-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Quitado</span>
                      </div>
                    )}
                  </div>
                  {expandedDebtor === debtor.name ? (
                    <ChevronUp className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedDebtor === debtor.name && (
                <div className="border-t border-zinc-100 bg-zinc-50/50">
                  <div className="px-6 py-4 space-y-3">
                    {debtor.transactions
                      .sort((a, b) => {
                        const dateA = new Date(a.paymentDate || a.date);
                        const dateB = new Date(b.paymentDate || b.date);
                        return dateB.getTime() - dateA.getTime();
                      })
                      .map((transaction) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        const paymentDate = transaction.paymentDate
                          ? new Date(transaction.paymentDate)
                          : new Date(transaction.date);

                        paymentDate.setHours(0, 0, 0, 0);

                        // Consider "pending" if within last 30 days or future
                        const thirtyDaysAgo = new Date(today);
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                        const isPending = paymentDate >= thirtyDaysAgo;

                        return (
                          <div
                            key={transaction.id}
                            className={`flex items-center justify-between p-3 rounded-xl ${
                              isPending ? 'bg-white border border-zinc-200' : 'bg-zinc-100 border border-zinc-200'
                            }`}
                          >
                            <div className="flex-1">
                              <p className={`text-sm font-semibold ${
                                isPending ? 'text-zinc-800' : 'text-zinc-500'
                              }`}>
                                {transaction.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-zinc-500">
                                  {formatDate(transaction.paymentDate || transaction.date)}
                                </p>
                                {transaction.type === TransactionType.EXPENSE && transaction.isReimbursable && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                    💰 Reembolso
                                  </span>
                                )}
                              </div>
                              {transaction.tags && transaction.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {transaction.tags.map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className={`text-sm font-bold ${
                                isPending ? 'text-emerald-600' : 'text-zinc-400'
                              }`}>
                                {formatCurrency(transaction.amount)}
                              </p>
                              {!isPending && (
                                <p className="text-xs text-emerald-600">Pago</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Summary in expanded view */}
                  {debtor.totalPaid > 0 && (
                    <div className="border-t border-zinc-200 px-6 py-3 bg-zinc-100">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-600">Total Pago:</span>
                        <span className="text-zinc-700 font-bold">
                          {formatCurrency(debtor.totalPaid)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-700">
            💡 <strong>Dica:</strong> Este dashboard mostra tanto receitas com devedor quanto gastos de terceiros marcados como reembolsáveis.
            Use tags como #reembolso para organizar melhor suas cobranças.
          </p>
        </div>
      </div>
    </div>
  );
}
