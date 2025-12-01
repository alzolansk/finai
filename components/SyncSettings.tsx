import React, { useState } from 'react';
import { Cloud, CloudOff, Copy, Check, Link2, RefreshCw } from 'lucide-react';
import { useFirebaseSync } from '../hooks/useFirebaseSync';

interface SyncSettingsProps {
  onUploadData?: () => Promise<void>;
}

const SyncSettings: React.FC<SyncSettingsProps> = ({ onUploadData }) => {
  const { syncEnabled, userId, connectToUser, uploadAllData } = useFirebaseSync();
  const [copied, setCopied] = useState(false);
  const [connectId, setConnectId] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
        Sincronização na Nuvem
      </h4>

      {/* Status */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${syncEnabled ? 'bg-emerald-50 border border-emerald-200' : 'bg-zinc-50 border border-zinc-200'}`}>
        {syncEnabled ? (
          <Cloud className="text-emerald-600" size={24} />
        ) : (
          <CloudOff className="text-zinc-400" size={24} />
        )}
        <div className="flex-1">
          <p className={`font-bold text-sm ${syncEnabled ? 'text-emerald-800' : 'text-zinc-600'}`}>
            {syncEnabled ? 'Sincronização Ativa' : 'Sincronização Desativada'}
          </p>
          <p className="text-xs text-zinc-500">
            {syncEnabled 
              ? 'Seus dados são sincronizados em tempo real' 
              : 'Configure o Firebase para ativar'}
          </p>
        </div>
      </div>

      {syncEnabled && (
        <>
          {/* User ID for sharing */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Seu ID de Sincronização
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-zinc-100 px-3 py-2 rounded-lg text-xs font-mono text-zinc-700 truncate">
                {userId}
              </code>
              <button
                onClick={handleCopy}
                className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                title="Copiar ID"
              >
                {copied ? (
                  <Check size={18} className="text-emerald-600" />
                ) : (
                  <Copy size={18} className="text-zinc-600" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mt-2">
              Compartilhe este ID com outro dispositivo para sincronizar
            </p>
          </div>

          {/* Connect to another device */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <button
              onClick={() => setShowConnect(!showConnect)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors w-full"
            >
              <Link2 size={16} />
              Conectar a outro dispositivo
            </button>

            {showConnect && (
              <div className="mt-3 space-y-2 animate-fadeIn">
                <input
                  type="text"
                  value={connectId}
                  onChange={(e) => setConnectId(e.target.value)}
                  placeholder="Cole o ID do outro dispositivo"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-zinc-200 outline-none"
                />
                <button
                  onClick={handleConnect}
                  disabled={!connectId.trim() || connectId === userId}
                  className="w-full py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Conectar
                </button>
              </div>
            )}
          </div>

          {/* Upload all data */}
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} className={isUploading ? 'animate-spin' : ''} />
            {isUploading ? 'Enviando...' : 'Enviar dados para nuvem'}
          </button>
        </>
      )}

      {!syncEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium mb-2">
            Como ativar a sincronização:
          </p>
          <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
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
};

export default SyncSettings;
