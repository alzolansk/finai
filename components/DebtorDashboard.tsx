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
      .filter(t => t.type === TransactionType.INCOME && t.debtor)
      .forEach(transaction => {
        const debtorName = transaction.debtor!;

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

        // Check if payment is pending (future date or no payment date)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const paymentDate = transaction.paymentDate
          ? new Date(transaction.paymentDate)
          : null;

        if (paymentDate) {
          paymentDate.setHours(0, 0, 0, 0);
        }

        const isPending = !paymentDate || paymentDate > today;

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
      <div className="min-h-screen bg-zinc-950 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">📊 Dashboard de Cobrança</h1>
            <p className="text-sm text-zinc-400">Acompanhe suas pendências por pessoa</p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-8 text-center border border-zinc-800">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-2">Nenhuma pendência cadastrada</p>
            <p className="text-sm text-zinc-500">
              Adicione receitas com devedor para começar a acompanhar suas cobranças
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">📊 Dashboard de Cobrança</h1>
          <p className="text-sm text-zinc-400">Acompanhe suas pendências por pessoa</p>
        </div>

        {/* Total Summary Card */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 rounded-xl p-6 mb-6 border border-emerald-800/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-300 mb-1">Total Pendente</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(totalPendingAll)}</p>
              <p className="text-xs text-emerald-400 mt-1">
                {debtorSummaries.filter(d => d.totalPending > 0).length} pessoa(s) com pendências
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-emerald-400/30" />
          </div>
        </div>

        {/* Debtor List */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider px-2">
            Pendências por Pessoa
          </h2>

          {debtorSummaries.map((debtor) => (
            <div
              key={debtor.name}
              className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
            >
              {/* Debtor Header */}
              <button
                onClick={() => toggleDebtor(debtor.name)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {debtor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-white">{debtor.name}</p>
                    <p className="text-xs text-zinc-500">
                      {debtor.transactions.length} transação(ões)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      debtor.totalPending > 0 ? 'text-emerald-400' : 'text-zinc-500'
                    }`}>
                      {formatCurrency(debtor.totalPending)}
                    </p>
                    {debtor.totalPending === 0 && (
                      <div className="flex items-center gap-1 text-emerald-500 text-xs mt-1">
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
                <div className="border-t border-zinc-800 bg-zinc-900/50">
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
                          : null;

                        if (paymentDate) {
                          paymentDate.setHours(0, 0, 0, 0);
                        }

                        const isPending = !paymentDate || paymentDate > today;

                        return (
                          <div
                            key={transaction.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              isPending ? 'bg-zinc-800/50' : 'bg-zinc-800/20'
                            }`}
                          >
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                isPending ? 'text-white' : 'text-zinc-400'
                              }`}>
                                {transaction.description}
                              </p>
                              <p className="text-xs text-zinc-500 mt-1">
                                {paymentDate ? formatDate(transaction.paymentDate!) : 'Data não definida'}
                              </p>
                              {transaction.tags && transaction.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {transaction.tags.map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className={`text-sm font-bold ${
                                isPending ? 'text-emerald-400' : 'text-zinc-500'
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
                    <div className="border-t border-zinc-800 px-6 py-3 bg-zinc-800/30">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">Total Pago:</span>
                        <span className="text-zinc-500 font-semibold">
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
        <div className="mt-8 p-4 bg-blue-950/30 border border-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-300">
            💡 <strong>Dica:</strong> As receitas com devedor aparecem aqui e também na sua agenda de recebimentos.
            Use tags como #reembolso para organizar melhor suas cobranças.
          </p>
        </div>
      </div>
    </div>
  );
}
