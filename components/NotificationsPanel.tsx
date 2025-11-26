import React, { useState, useEffect } from 'react';
import { BudgetAlert, AlertConfiguration } from '../types';
import {
  getAlerts,
  getAlertConfigurations,
  saveAlertConfiguration,
  toggleAlertType,
  markAlertAsRead,
  dismissAlert,
  clearOldAlerts,
  getUnreadAlerts
} from '../services/alertService';
import { Bell, X, Settings as SettingsIcon, Check, Trash2, BellOff, ChevronRight, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [configurations, setConfigurations] = useState<AlertConfiguration[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
      loadConfigurations();
    }
  }, [isOpen]);

  const loadAlerts = () => {
    const allAlerts = getAlerts();
    setAlerts(allAlerts);
  };

  const loadConfigurations = () => {
    const configs = getAlertConfigurations();
    setConfigurations(configs);
  };

  const handleMarkAsRead = (id: string) => {
    const updated = markAlertAsRead(id);
    setAlerts(updated);
  };

  const handleDismiss = (id: string) => {
    const updated = dismissAlert(id);
    setAlerts(updated);
  };

  const handleToggleAlertType = (alertType: string) => {
    const updated = toggleAlertType(alertType);
    setConfigurations(updated);
  };

  const handleClearOld = () => {
    if (confirm('Deseja limpar alertas antigos (mais de 30 dias)?')) {
      const updated = clearOldAlerts(30);
      setAlerts(updated);
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'danger':
        return <AlertCircle size={20} className="text-rose-600" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-orange-600" />;
      default:
        return <Info size={20} className="text-blue-600" />;
    }
  };

  const getAlertBg = (severity: string) => {
    switch (severity) {
      case 'danger':
        return 'bg-rose-50 border-rose-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getAlertTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      limit_80: 'Limite em 80%',
      limit_100: 'Limite Estourado',
      unusual_spending: 'Gasto Incomum',
      new_subscription: 'Nova Assinatura',
      high_invoice: 'Fatura Elevada',
      overspend_projection: 'Projeção de Estouro',
      category_overspend: 'Categoria Estourada'
    };
    return labels[type] || type;
  };

  const filteredAlerts = filter === 'unread'
    ? alerts.filter(a => !a.isRead && !a.isDismissed)
    : alerts.filter(a => !a.isDismissed);

  const unreadCount = getUnreadAlerts().length;

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white/95 backdrop-blur-xl border-l border-zinc-200 shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 bg-white">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center relative">
                <Bell size={22} className="text-white" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {unreadCount}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-xl">Notificações</h3>
                <p className="text-xs text-zinc-500">Central de alertas e avisos</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
            >
              <X size={20} />
            </button>
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === 'all'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === 'unread'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Não Lidas {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <div className="flex-1"></div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600"
              title="Configurações"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-6 bg-zinc-50 border-b border-zinc-200">
            <h4 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
              <SettingsIcon size={18} />
              Configurações de Alertas
            </h4>
            <div className="space-y-3">
              {configurations.map(config => (
                <div
                  key={config.id}
                  className="flex items-center justify-between bg-white p-4 rounded-xl border border-zinc-200"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.isEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'
                    }`}>
                      <Bell size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-zinc-900">{getAlertTypeLabel(config.alertType)}</p>
                      <p className="text-xs text-zinc-500">
                        {config.isEnabled ? 'Ativo' : 'Desativado'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAlertType(config.alertType)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      config.isEnabled
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {config.isEnabled ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleClearOld}
              className="w-full mt-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
            >
              <Trash2 size={16} />
              Limpar Alertas Antigos
            </button>
          </div>
        )}

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredAlerts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <BellOff className="text-zinc-400 mb-4 w-16 h-16" />
              <h4 className="font-bold text-zinc-900 mb-2">Nenhum alerta</h4>
              <p className="text-sm text-zinc-500">
                {filter === 'unread' ? 'Você não tem alertas não lidos' : 'Tudo certo por aqui!'}
              </p>
            </div>
          )}

          {filteredAlerts
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(alert => (
              <div
                key={alert.id}
                className={`border-2 rounded-2xl p-4 transition-all ${getAlertBg(alert.severity)} ${
                  alert.isRead ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 mt-1">
                    {getAlertIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-bold text-sm text-zinc-900 leading-tight">
                        {alert.title}
                      </h4>
                      {!alert.isRead && (
                        <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0 mt-1"></div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-700 mb-2 leading-relaxed">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>{new Date(alert.createdAt).toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span>{new Date(alert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {alert.relatedCategory && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-zinc-600">{alert.relatedCategory}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="flex-1 py-2 text-xs font-bold bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      Marcar como Lida
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="flex-1 py-2 text-xs font-bold bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <X size={14} />
                    Dispensar
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
};

export default NotificationsPanel;
