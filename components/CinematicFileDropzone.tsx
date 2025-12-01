import React, { useState, useRef, useCallback } from 'react';
import { FileText, Upload, Image, FileSpreadsheet, Sparkles, Zap, Shield } from 'lucide-react';

interface CinematicFileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
}

const CinematicFileDropzone: React.FC<CinematicFileDropzoneProps> = ({
  onFileSelect,
  accept = ".csv, .pdf, image/*",
  maxSize = 4
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const fileTypes = [
    { icon: FileText, label: 'PDF', color: 'text-red-500', bg: 'bg-red-100' },
    { icon: Image, label: 'Imagem', color: 'text-blue-500', bg: 'bg-blue-100' },
    { icon: FileSpreadsheet, label: 'CSV', color: 'text-emerald-500', bg: 'bg-emerald-100' }
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Main dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative w-full h-72 rounded-3xl border-2 border-dashed cursor-pointer
          transition-all duration-500 overflow-hidden group
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
            : isHovering 
              ? 'border-zinc-400 bg-zinc-50' 
              : 'border-zinc-300 bg-white hover:border-zinc-400'
          }
        `}
      >
        {/* Animated background gradient */}
        <div className={`
          absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5
          transition-opacity duration-500
          ${isDragging || isHovering ? 'opacity-100' : 'opacity-0'}
        `} />

        {/* Floating particles when dragging */}
        {isDragging && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-blue-400 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 1}s`,
                  opacity: 0.5
                }}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
          {/* Icon container */}
          <div className={`
            relative w-20 h-20 mb-6 transition-all duration-500
            ${isDragging ? 'scale-110' : 'group-hover:scale-105'}
          `}>
            <div className={`
              absolute inset-0 rounded-2xl transition-all duration-500
              ${isDragging 
                ? 'bg-blue-500 shadow-lg shadow-blue-500/30' 
                : 'bg-zinc-100 group-hover:bg-zinc-200'
              }
            `} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Upload className={`
                w-10 h-10 transition-all duration-300
                ${isDragging ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'}
              `} />
            </div>
            
            {/* Sparkle decorations */}
            <Sparkles className={`
              absolute -top-2 -right-2 w-5 h-5 text-amber-400 transition-opacity duration-300
              ${isHovering || isDragging ? 'opacity-100 animate-pulse' : 'opacity-0'}
            `} />
            <Zap className={`
              absolute -bottom-1 -left-2 w-4 h-4 text-blue-400 transition-opacity duration-300
              ${isHovering || isDragging ? 'opacity-100 animate-pulse' : 'opacity-0'}
            `} style={{ animationDelay: '0.2s' }} />
          </div>

          {/* Text */}
          <h3 className={`
            text-lg font-bold mb-2 transition-colors duration-300
            ${isDragging ? 'text-blue-600' : 'text-zinc-800'}
          `}>
            {isDragging ? 'Solte o arquivo aqui!' : 'Arraste ou clique para enviar'}
          </h3>
          
          <p className="text-sm text-zinc-500 mb-6 text-center">
            Fatura de cartão ou extrato bancário
          </p>

          {/* File type badges */}
          <div className="flex items-center gap-2">
            {fileTypes.map(({ icon: Icon, label, color, bg }) => (
              <div 
                key={label}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  transition-all duration-300 ${bg}
                  ${isHovering || isDragging ? 'scale-105' : ''}
                `}
              >
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className={color}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Info footer */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-400">
        <div className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5" />
          <span>Processamento seguro</span>
        </div>
        <span>•</span>
        <span>Máx. {maxSize}MB</span>
      </div>
    </div>
  );
};

export default CinematicFileDropzone;
