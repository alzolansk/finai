import React, { useState } from 'react';
import { Shield, Eye, Server, Clock, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { getImportPrivacyNotice, saveImportConsent } from '../utils/importSecurity';

interface ImportPrivacyConsentProps {
  onAccept: () => void;
  onDecline: () => void;
}

const ImportPrivacyConsent: React.FC<ImportPrivacyConsentProps> = ({ onAccept, onDecline }) => {
  const [understood, setUnderstood] = useState(false);
  const notice = getImportPrivacyNotice();

  const handleAccept = () => {
    saveImportConsent(true);
    onAccept();
  };

  const handleDecline = () => {
    saveImportConsent(false);
    onDecline();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 p-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Shield className="text-blue-600" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-zinc-900">{notice.title}</h2>
            <p className="text-sm text-zinc-500 mt-1">{notice.description}</p>
          </div>
          <button 
            onClick={handleDecline}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Data Processed */}
          <div className="bg-zinc-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={18} className="text-zinc-600" />
              <h3 className="font-bold text-zinc-800 text-sm">Dados Processados</h3>
            </div>
            <ul className="space-y-2">
              {notice.dataProcessed.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-zinc-600">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Third Parties */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <Server size={18} className="text-amber-600" />
              <h3 className="font-bold text-amber-800 text-sm">Serviços de Terceiros</h3>
            </div>
            <ul className="space-y-2">
              {notice.thirdParties.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 mt-3 bg-amber-100 p-2 rounded-lg">
              ⚠️ O conteúdo do seu documento será enviado para os servidores do Google para processamento. 
              Consulte a <a href="https://ai.google.dev/terms" target="_blank" rel="noopener noreferrer" className="underline font-medium">política de privacidade do Google AI</a>.
            </p>
          </div>

          {/* Retention */}
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-emerald-600" />
              <h3 className="font-bold text-emerald-800 text-sm">Armazenamento</h3>
            </div>
            <p className="text-sm text-emerald-700">{notice.retention}</p>
          </div>

          {/* What we DON'T do */}
          <div className="bg-zinc-50 rounded-xl p-4">
            <h3 className="font-bold text-zinc-800 text-sm mb-3">O que NÃO fazemos:</h3>
            <ul className="space-y-2 text-sm text-zinc-600">
              <li className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                Não armazenamos o arquivo original após processamento
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                Não compartilhamos seus dados com terceiros além do processamento
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                Não vendemos ou monetizamos suas informações financeiras
              </li>
            </ul>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-zinc-700 group-hover:text-zinc-900 transition-colors">
              Entendo que meus documentos financeiros serão processados pelo Google Gemini AI 
              e concordo com o uso dos dados conforme descrito acima.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-100 p-4 flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 py-3 px-4 bg-zinc-100 text-zinc-700 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAccept}
            disabled={!understood}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Shield size={18} />
            Aceitar e Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPrivacyConsent;
