import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cloud,
  CloudOff,
  Copy,
  Check,
  Link2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Activity,
  FileText,
  Search,
  Users,
  Bell,
  Shield,
  Palette,
  Database,
  ChevronRight,
  X,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Zap,
  Download,
  Upload,
  HelpCircle,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Info,
  Sparkles
} from 'lucide-react';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import { clearAllData, getApiLogs, ApiLog } from '../services/storageService';
import { enableDemoMode, disableDemoMode, isDemoMode } from '../utils/mockData';

interface SettingsPageProps {
  onNavigate: (tab: string) => void;
  isTurboMode?: boolean;
  onToggleTurboMode?: () => void;
  onUploadData?: () => Promise<void>;
}

type SettingsSection = 'geral' | 'sincronizacao' | 'notificacoes' | 'dados' | 'aparencia' | 'avancado' | 'sobre';

const SettingsPage: React.FC<SettingsPageProps> = ({
  onNavigate,
  isTurboMode = false,
  onToggleTurboMode,
  onUploadData
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('geral');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Sync settings state
  const { syncEnabled, userId, connectToUser, uploadAllData } = useFirebaseSync();
  const [copied, setCopied] = useState(false);
  const [connectId, setConnectId] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // API logs state
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [showApiLogs, setShowApiLogs] = useState(false);

  // Notification preferences (mock state - would be persisted)
  const [notificationPrefs, setNotificationPrefs] = useState({
    budgetAlerts: true,
    weeklyReport: true,
    unusualSpending: true,
    goalProgress: true,
    newFeatures: false
  });

  useEffect(() => {
    if (activeSection === 'avancado') {
      setApiLogs(getApiLogs());
    }
  }, [activeSection]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    if (connectId.trim() && connectId !== userId) {
      if (confirm('Isso irá substituir seus dados locais pelos dados do outro dispositivo. Continuar?')) {
        connectToUser(connectId.trim());
      }
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      if (onUploadData) {
        await onUploadData();
      } else {
        await uploadAllData();
      }
      alert('Dados enviados para a nuvem com sucesso!');
    } catch (error) {
      alert('Erro ao enviar dados. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const menuItems: { id: SettingsSection; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'geral', label: 'Geral', icon: <Settings size={20} />, description: 'Preferências básicas' },
    { id: 'sincronizacao', label: 'Sincronização', icon: <Cloud size={20} />, description: 'Backup na nuvem' },
    { id: 'notificacoes', label: 'Notificações', icon: <Bell size={20} />, description: 'Alertas e avisos' },
    { id: 'dados', label: 'Dados', icon: <Database size={20} />, description: 'Gerenciar informações' },
    { id: 'aparencia', label: 'Aparência', icon: <Palette size={20} />, description: 'Tema e visual' },
    { id: 'avancado', label: 'Avançado', icon: <Activity size={20} />, description: 'Logs e debug' },
    { id: 'sobre', label: 'Sobre', icon: <Info size={20} />, description: 'Versão e ajuda' }
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'geral':
        return <GeneralSection isTurboMode={isTurboMode} onToggleTurboMode={onToggleTurboMode} />;
      case 'sincronizacao':
        return (
          <SyncSection
            syncEnabled={syncEnabled}
            userId={userId}
            copied={copied}
            onCopy={handleCopy}
            connectId={connectId}
            setConnectId={setConnectId}
            showConnect={showConnect}
            setShowConnect={setShowConnect}
            onConnect={handleConnect}
            isUploading={isUploading}
            onUpload={handleUpload}
          />
        );
      case 'notificacoes':
        return <NotificationsSection prefs={notificationPrefs} setPrefs={setNotificationPrefs} />;
      case 'dados':
        return <DataSection onNavigate={onNavigate} />;
      case 'aparencia':
        return <AppearanceSection />;
      case 'avancado':
        return <AdvancedSection apiLogs={apiLogs} showApiLogs={showApiLogs} setShowApiLogs={setShowApiLogs} />;
      case 'sobre':
        return <AboutSection />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-1">Configurações</h1>
        <p className="text-sm text-zinc-500">Personalize sua experiência no FinAI</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Section Selector */}
        <div className="lg:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {menuItems.find(m => m.id === activeSection)?.icon}
              <span className="font-medium text-zinc-900">
                {menuItems.find(m => m.id === activeSection)?.label}
              </span>
            </div>
            <ChevronRight size={20} className={`text-zinc-400 transition-transform ${isMobileMenuOpen ? 'rotate-90' : ''}`} />
          </button>
          
          {isMobileMenuOpen && (
            <div className="mt-2 bg-white rounded-2xl border border-zinc-200 shadow-lg overflow-hidden animate-fadeIn">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'hover:bg-zinc-50 text-zinc-700'
                  }`}
                >
                  <div className={activeSection === item.id ? 'text-emerald-600' : 'text-zinc-400'}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden sticky top-24">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 p-4 text-left transition-all ${
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-emerald-50 to-transparent border-l-4 border-emerald-500 text-emerald-700'
                    : 'hover:bg-zinc-50 text-zinc-700 border-l-4 border-transparent'
                }`}
              >
                <div className={activeSection === item.id ? 'text-emerald-600' : 'text-zinc-400'}>
                  {item.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-zinc-400">{item.description}</p>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8 animate-fadeIn">
            {renderSectionContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

// ============ Section Components ============

const GeneralSection: React.FC<{ isTurboMode?: boolean; onToggleTurboMode?: () => void }> = ({
  isTurboMode,
  onToggleTurboMode
}) => (
  <div className="space-y-8">
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">Preferências Gerais</h2>
      <p className="text-sm text-zinc-500">Configure o comportamento básico do aplicativo</p>
    </div>

    {/* Turbo Mode */}
    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
          <Zap size={24} className={isTurboMode ? 'text-indigo-600 fill-current' : 'text-indigo-400'} />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900">Modo Turbo</h3>
          <p className="text-sm text-zinc-500">Respostas mais rápidas da IA com análises simplificadas</p>
        </div>
      </div>
      <button
        onClick={onToggleTurboMode}
        className={`p-2 rounded-full transition-all ${isTurboMode ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-500'}`}
      >
        {isTurboMode ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>

    {/* Currency */}
    <SettingRow
      icon={<span className="text-lg font-bold">R$</span>}
      title="Moeda"
      description="Real Brasileiro (BRL)"
      action={
        <select className="px-3 py-2 bg-zinc-100 border-0 rounded-lg text-sm font-medium text-zinc-700 focus:ring-2 focus:ring-emerald-500">
          <option>BRL - Real</option>
          <option>USD - Dólar</option>
          <option>EUR - Euro</option>
        </select>
      }
    />

    {/* Language */}
    <SettingRow
      icon={<span className="text-base">🇧🇷</span>}
      title="Idioma"
      description="Português (Brasil)"
      action={
        <select className="px-3 py-2 bg-zinc-100 border-0 rounded-lg text-sm font-medium text-zinc-700 focus:ring-2 focus:ring-emerald-500">
          <option>Português (BR)</option>
          <option>English</option>
          <option>Español</option>
        </select>
      }
    />
  </div>
);


interface SyncSectionProps {
  syncEnabled: boolean;
  userId: string;
  copied: boolean;
  onCopy: () => void;
  connectId: string;
  setConnectId: (id: string) => void;
  showConnect: boolean;
  setShowConnect: (show: boolean) => void;
  onConnect: () => void;
  isUploading: boolean;
  onUpload: () => void;
}

const SyncSection: React.FC<SyncSectionProps> = ({
  syncEnabled,
  userId,
  copied,
  onCopy,
  connectId,
  setConnectId,
  showConnect,
  setShowConnect,
  onConnect,
  isUploading,
  onUpload
}) => (
  <div className="space-y-8">
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">Sincronização na Nuvem</h2>
      <p className="text-sm text-zinc-500">Mantenha seus dados seguros e sincronizados entre dispositivos</p>
    </div>

    {/* Status Card */}
    <div className={`p-6 rounded-2xl border-2 ${syncEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${syncEnabled ? 'bg-emerald-100' : 'bg-zinc-200'}`}>
          {syncEnabled ? (
            <Cloud className="text-emerald-600" size={28} />
          ) : (
            <CloudOff className="text-zinc-400" size={28} />
          )}
        </div>
        <div className="flex-1">
          <h3 className={`font-bold text-lg ${syncEnabled ? 'text-emerald-800' : 'text-zinc-600'}`}>
            {syncEnabled ? 'Sincronização Ativa' : 'Sincronização Desativada'}
          </h3>
          <p className="text-sm text-zinc-500">
            {syncEnabled
              ? 'Seus dados são sincronizados em tempo real'
              : 'Configure o Firebase para ativar'}
          </p>
        </div>
        <div className={`w-3 h-3 rounded-full ${syncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`} />
      </div>
    </div>

    {syncEnabled ? (
      <>
        {/* User ID */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-zinc-700">Seu ID de Sincronização</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-100 px-4 py-3 rounded-xl text-sm font-mono text-zinc-700 truncate border border-zinc-200">
              {userId}
            </code>
            <button
              onClick={onCopy}
              className="p-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors border border-zinc-200"
              title="Copiar ID"
            >
              {copied ? (
                <Check size={20} className="text-emerald-600" />
              ) : (
                <Copy size={20} className="text-zinc-600" />
              )}
            </button>
          </div>
          <p className="text-xs text-zinc-400">Compartilhe este ID com outro dispositivo para sincronizar</p>
        </div>

        {/* Connect to another device */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowConnect(!showConnect)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Link2 size={20} className="text-zinc-500" />
              <span className="font-medium text-zinc-700">Conectar a outro dispositivo</span>
            </div>
            <ChevronRight size={20} className={`text-zinc-400 transition-transform ${showConnect ? 'rotate-90' : ''}`} />
          </button>

          {showConnect && (
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 space-y-3 animate-fadeIn">
              <input
                type="text"
                value={connectId}
                onChange={(e) => setConnectId(e.target.value)}
                placeholder="Cole o ID do outro dispositivo"
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <button
                onClick={onConnect}
                disabled={!connectId.trim() || connectId === userId}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Conectar
              </button>
            </div>
          )}
        </div>

        {/* Upload button */}
        <button
          onClick={onUpload}
          disabled={isUploading}
          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-200"
        >
          <RefreshCw size={20} className={isUploading ? 'animate-spin' : ''} />
          {isUploading ? 'Enviando...' : 'Enviar dados para nuvem'}
        </button>
      </>
    ) : (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h4 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
          <HelpCircle size={18} />
          Como ativar a sincronização
        </h4>
        <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
          <li>Crie um projeto no Firebase Console</li>
          <li>Ative o Firestore Database</li>
          <li>Copie as credenciais do projeto</li>
          <li>Adicione no arquivo .env.local</li>
          <li>Reinicie a aplicação</li>
        </ol>
      </div>
    )}
  </div>
);

const NotificationsSection: React.FC<{
  prefs: Record<string, boolean>;
  setPrefs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}> = ({ prefs, setPrefs }) => {
  const togglePref = (key: string) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 mb-1">Notificações</h2>
        <p className="text-sm text-zinc-500">Escolha quais alertas você deseja receber</p>
      </div>

      <div className="space-y-4">
        <NotificationToggle
          title="Alertas de Orçamento"
          description="Aviso quando atingir 80% ou 100% do limite"
          enabled={prefs.budgetAlerts}
          onToggle={() => togglePref('budgetAlerts')}
          icon={<AlertTriangle size={20} />}
        />
        <NotificationToggle
          title="Relatório Semanal"
          description="Resumo dos seus gastos toda segunda-feira"
          enabled={prefs.weeklyReport}
          onToggle={() => togglePref('weeklyReport')}
          icon={<FileText size={20} />}
        />
        <NotificationToggle
          title="Gastos Incomuns"
          description="Alerta para transações fora do padrão"
          enabled={prefs.unusualSpending}
          onToggle={() => togglePref('unusualSpending')}
          icon={<Activity size={20} />}
        />
        <NotificationToggle
          title="Progresso de Metas"
          description="Atualizações sobre suas metas de economia"
          enabled={prefs.goalProgress}
          onToggle={() => togglePref('goalProgress')}
          icon={<Zap size={20} />}
        />
        <NotificationToggle
          title="Novidades do App"
          description="Fique por dentro das novas funcionalidades"
          enabled={prefs.newFeatures}
          onToggle={() => togglePref('newFeatures')}
          icon={<Bell size={20} />}
        />
      </div>
    </div>
  );
};

const NotificationToggle: React.FC<{
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}> = ({ title, description, enabled, onToggle, icon }) => (
  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-200 text-zinc-400'}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
    </div>
    <button
      onClick={onToggle}
      className={`p-1 rounded-full transition-all ${enabled ? 'bg-emerald-600 text-white' : 'bg-zinc-300 text-zinc-500'}`}
    >
      {enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
    </button>
  </div>
);


const DataSection: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => (
  <div className="space-y-8">
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">Gerenciamento de Dados</h2>
      <p className="text-sm text-zinc-500">Acesse e gerencie suas informações financeiras</p>
    </div>

    {/* Quick Access Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <DataCard
        icon={<Users size={24} />}
        title="Dashboard de Cobrança"
        description="Gerencie valores a receber"
        onClick={() => onNavigate('debtor-dashboard')}
        gradient="from-emerald-500 to-teal-500"
      />
      <DataCard
        icon={<Search size={24} />}
        title="Explorar Transações"
        description="Busca avançada de gastos"
        onClick={() => onNavigate('explore')}
        gradient="from-blue-500 to-indigo-500"
      />
      <DataCard
        icon={<FileText size={24} />}
        title="Histórico de Importações"
        description="Veja todas as importações"
        onClick={() => onNavigate('import-history')}
        gradient="from-purple-500 to-pink-500"
      />
      <DataCard
        icon={<AlertTriangle size={24} />}
        title="Auditoria de Duplicados"
        description="Encontre transações duplicadas"
        onClick={() => onNavigate('duplicates')}
        gradient="from-orange-500 to-red-500"
      />
    </div>

    {/* Export/Import */}
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-zinc-50 border-b border-zinc-200">
        <h3 className="font-bold text-zinc-900">Exportar / Importar</h3>
        <p className="text-sm text-zinc-500">Faça backup ou restaure seus dados</p>
      </div>
      <div className="p-4 flex flex-col sm:flex-row gap-3">
        <button className="flex-1 py-3 px-4 bg-white border border-zinc-200 rounded-xl font-medium text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2">
          <Download size={18} />
          Exportar JSON
        </button>
        <button className="flex-1 py-3 px-4 bg-white border border-zinc-200 rounded-xl font-medium text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2">
          <Upload size={18} />
          Importar Backup
        </button>
      </div>
    </div>

    {/* Danger Zone */}
    <div className="border-2 border-rose-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-rose-50 border-b border-rose-200">
        <h3 className="font-bold text-rose-700 flex items-center gap-2">
          <Shield size={18} />
          Zona de Perigo
        </h3>
      </div>
      <div className="p-6 bg-white">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
            <Trash2 size={24} />
          </div>
          <div>
            <h4 className="font-bold text-rose-900">Excluir todos os dados</h4>
            <p className="text-sm text-rose-700 mt-1">
              Esta ação não pode ser desfeita. Todos os seus registros, metas e configurações serão apagados permanentemente.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm('Tem certeza absoluta? Todos os seus dados serão perdidos.')) {
              clearAllData();
              window.location.reload();
            }
          }}
          className="w-full py-3 bg-white border-2 border-rose-300 text-rose-600 font-bold rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all flex items-center justify-center gap-2"
        >
          <Trash2 size={18} />
          Excluir todos os registros
        </button>
      </div>

      {/* Demo Mode Section */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 mb-1">🎬 Modo Demonstração</h3>
            <p className="text-sm text-zinc-600">
              {isDemoMode() 
                ? 'Modo demo ativo! Os dados exibidos são fictícios para demonstração.'
                : 'Carrega dados fictícios realistas para tirar prints e demonstrações.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (isDemoMode()) {
              disableDemoMode();
            } else {
              if (confirm('Isso substituirá seus dados atuais por dados de demonstração. Continuar?')) {
                enableDemoMode();
              }
            }
            window.location.reload();
          }}
          className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            isDemoMode()
              ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700'
          }`}
        >
          <Sparkles size={18} />
          {isDemoMode() ? 'Desativar Modo Demo' : 'Ativar Modo Demo'}
        </button>
      </div>
    </div>
  </div>
);

const DataCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  gradient: string;
}> = ({ icon, title, description, onClick, gradient }) => (
  <button
    onClick={onClick}
    className="group p-5 bg-white border border-zinc-200 rounded-xl hover:shadow-lg hover:border-zinc-300 transition-all text-left"
  >
    <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <h3 className="font-bold text-zinc-900 mb-1">{title}</h3>
    <p className="text-sm text-zinc-500">{description}</p>
  </button>
);

const AppearanceSection: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 mb-1">Aparência</h2>
        <p className="text-sm text-zinc-500">Personalize o visual do aplicativo</p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-zinc-700">Tema</label>
        <div className="grid grid-cols-3 gap-3">
          <ThemeOption
            icon={<Sun size={24} />}
            label="Claro"
            selected={theme === 'light'}
            onClick={() => setTheme('light')}
          />
          <ThemeOption
            icon={<Moon size={24} />}
            label="Escuro"
            selected={theme === 'dark'}
            onClick={() => setTheme('dark')}
            disabled
          />
          <ThemeOption
            icon={<Monitor size={24} />}
            label="Sistema"
            selected={theme === 'system'}
            onClick={() => setTheme('system')}
            disabled
          />
        </div>
        <p className="text-xs text-zinc-400">Tema escuro em breve!</p>
      </div>

      {/* Accent Color */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-zinc-700">Cor de Destaque</label>
        <div className="flex gap-3">
          {['emerald', 'blue', 'purple', 'rose', 'orange'].map((color) => (
            <button
              key={color}
              className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${
                color === 'emerald' ? 'bg-emerald-500 ring-2 ring-offset-2 ring-emerald-500' :
                color === 'blue' ? 'bg-blue-500' :
                color === 'purple' ? 'bg-purple-500' :
                color === 'rose' ? 'bg-rose-500' :
                'bg-orange-500'
              }`}
              title={color}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-400">Personalização de cores em breve!</p>
      </div>

      {/* Device Preview */}
      <div className="p-6 bg-zinc-100 rounded-xl">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="w-16 h-28 bg-zinc-900 rounded-xl mx-auto mb-2 flex items-center justify-center">
              <Smartphone size={20} className="text-zinc-600" />
            </div>
            <span className="text-xs text-zinc-500">Mobile</span>
          </div>
          <div className="text-center">
            <div className="w-32 h-20 bg-zinc-900 rounded-lg mx-auto mb-2 flex items-center justify-center">
              <Monitor size={24} className="text-zinc-600" />
            </div>
            <span className="text-xs text-zinc-500">Desktop</span>
          </div>
        </div>
        <p className="text-center text-xs text-zinc-500 mt-4">Layout responsivo ativo</p>
      </div>
    </div>
  );
};

const ThemeOption: React.FC<{
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, selected, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
      selected
        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
        : disabled
        ? 'border-zinc-200 bg-zinc-50 text-zinc-300 cursor-not-allowed'
        : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
    }`}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </button>
);


const AdvancedSection: React.FC<{
  apiLogs: ApiLog[];
  showApiLogs: boolean;
  setShowApiLogs: (show: boolean) => void;
}> = ({ apiLogs, showApiLogs, setShowApiLogs }) => (
  <div className="space-y-8">
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">Configurações Avançadas</h2>
      <p className="text-sm text-zinc-500">Monitoramento e diagnóstico do sistema</p>
    </div>

    {/* API Monitoring */}
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowApiLogs(!showApiLogs)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-zinc-500" />
          <div className="text-left">
            <span className="font-medium text-zinc-700 block">Monitoramento de API</span>
            <span className="text-xs text-zinc-400">Últimas chamadas para Gemini AI</span>
          </div>
        </div>
        <ChevronRight size={20} className={`text-zinc-400 transition-transform ${showApiLogs ? 'rotate-90' : ''}`} />
      </button>

      {showApiLogs && (
        <div className="bg-zinc-900 p-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-4 text-zinc-400 text-xs">
            <Activity size={14} />
            <span>Últimas chamadas (Gemini AI)</span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 pr-2">
            {apiLogs.length === 0 ? (
              <p className="text-zinc-600 text-sm italic text-center py-4">Nenhum registro encontrado.</p>
            ) : (
              apiLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs border-b border-zinc-800 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-zinc-300 font-mono">{log.endpoint}</p>
                    <p className="text-zinc-600">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        log.status === 'success'
                          ? 'bg-emerald-900/30 text-emerald-400'
                          : 'bg-rose-900/30 text-rose-400'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                    <p className="text-zinc-500 mt-1">{log.duration}ms</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>

    {/* Debug Info */}
    <div className="p-4 bg-zinc-100 rounded-xl">
      <h3 className="font-bold text-zinc-700 mb-3 text-sm">Informações de Debug</h3>
      <div className="space-y-2 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-zinc-500">LocalStorage:</span>
          <span className="text-zinc-700">{(localStorage.length)} itens</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">User Agent:</span>
          <span className="text-zinc-700 truncate max-w-[200px]">{navigator.userAgent.split(' ')[0]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Viewport:</span>
          <span className="text-zinc-700">{window.innerWidth}x{window.innerHeight}</span>
        </div>
      </div>
    </div>

    {/* Clear Cache */}
    <button className="w-full py-3 px-4 bg-zinc-100 border border-zinc-200 rounded-xl font-medium text-zinc-700 hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
      <RefreshCw size={18} />
      Limpar Cache do App
    </button>
  </div>
);

const AboutSection: React.FC = () => (
  <div className="space-y-8">
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">Sobre o FinAI</h2>
      <p className="text-sm text-zinc-500">Informações sobre o aplicativo</p>
    </div>

    {/* App Info */}
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
        <div className="w-8 h-8 bg-emerald-500 rounded-full"></div>
      </div>
      <h3 className="text-2xl font-bold text-zinc-900">FinAI</h3>
      <p className="text-zinc-500">Controle Financeiro Inteligente</p>
      <p className="text-sm text-zinc-400 mt-2">Versão 1.0.0</p>
    </div>

    {/* Links */}
    <div className="space-y-3">
      <LinkButton icon={<HelpCircle size={18} />} label="Central de Ajuda" />
      <LinkButton icon={<FileText size={18} />} label="Termos de Uso" />
      <LinkButton icon={<Shield size={18} />} label="Política de Privacidade" />
      <LinkButton icon={<ExternalLink size={18} />} label="Avaliar o App" />
    </div>

    {/* Credits */}
    <div className="p-4 bg-zinc-100 rounded-xl text-center">
      <p className="text-xs text-zinc-500">
        Desenvolvido com ❤️ usando React + TypeScript
      </p>
      <p className="text-xs text-zinc-400 mt-1">
        Powered by Google Gemini AI
      </p>
    </div>
  </div>
);

const LinkButton: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <button className="w-full flex items-center justify-between p-4 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors">
    <div className="flex items-center gap-3 text-zinc-700">
      {icon}
      <span className="font-medium">{label}</span>
    </div>
    <ExternalLink size={16} className="text-zinc-400" />
  </button>
);

// ============ Helper Components ============

const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center text-zinc-600">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
    </div>
    {action}
  </div>
);

export default SettingsPage;
