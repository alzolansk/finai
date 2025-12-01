/**
 * Security utilities for financial document import
 * Handles validation, sanitization, and privacy protection
 */

// ============ File Validation ============

export const IMPORT_MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (Gemini API limit)

export const ALLOWED_IMPORT_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls']
} as const;

export interface ImportValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate file before import processing
 */
export const validateImportFile = (file: File): ImportValidationResult => {
  const warnings: string[] = [];

  // Check file size
  if (file.size > IMPORT_MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo: ${IMPORT_MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Arquivo vazio' };
  }

  // Check MIME type
  const allowedMimes = Object.keys(ALLOWED_IMPORT_TYPES);
  if (!allowedMimes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não suportado: ${file.type || 'desconhecido'}. Use PDF, imagens ou planilhas.`
    };
  }

  // Check extension matches MIME
  const extension = file.name.toLowerCase().split('.').pop();
  const expectedExtensions = ALLOWED_IMPORT_TYPES[file.type as keyof typeof ALLOWED_IMPORT_TYPES];
  
  if (extension && !expectedExtensions?.some(ext => ext.slice(1) === extension)) {
    warnings.push(`Extensão do arquivo (.${extension}) não corresponde ao tipo declarado`);
  }

  // Warn about potentially sensitive file names
  const sensitivePatterns = [
    /cpf/i, /rg/i, /cnpj/i, /senha/i, /password/i,
    /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF pattern
    /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/ // CNPJ pattern
  ];

  if (sensitivePatterns.some(pattern => pattern.test(file.name))) {
    warnings.push('Nome do arquivo pode conter informações sensíveis. Considere renomear antes de importar.');
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
};

// ============ Privacy Notice ============

export interface PrivacyNotice {
  title: string;
  description: string;
  dataProcessed: string[];
  thirdParties: string[];
  retention: string;
}

/**
 * Get privacy notice for import feature
 */
export const getImportPrivacyNotice = (): PrivacyNotice => ({
  title: 'Aviso de Privacidade - Importação',
  description: 'Ao importar documentos financeiros, seus dados serão processados da seguinte forma:',
  dataProcessed: [
    'Conteúdo do arquivo (fatura, extrato)',
    'Transações extraídas (descrição, valor, data)',
    'Informações do emissor (banco, cartão)'
  ],
  thirdParties: [
    'Google Gemini AI - para extração de dados do documento'
  ],
  retention: 'Os dados extraídos são armazenados localmente no seu dispositivo. O arquivo original não é armazenado após o processamento.'
});

// ============ Data Sanitization ============

/**
 * Patterns that might indicate sensitive personal data
 */
const SENSITIVE_PATTERNS = {
  cpf: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
  cnpj: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g,
  phone: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
  // Partial card numbers (last 4 digits are usually safe)
  partialCard: /\*{4,}\s?\d{4}/g
};

/**
 * Mask sensitive data in text (for logging purposes)
 */
export const maskSensitiveData = (text: string): string => {
  let masked = text;
  
  // Mask CPF: 123.456.789-00 -> ***.***.***-**
  masked = masked.replace(SENSITIVE_PATTERNS.cpf, '***.***.***-**');
  
  // Mask CNPJ
  masked = masked.replace(SENSITIVE_PATTERNS.cnpj, '**.***.***/****.***');
  
  // Mask phone numbers
  masked = masked.replace(SENSITIVE_PATTERNS.phone, '(**) *****-****');
  
  // Mask emails: user@domain.com -> u***@d***.com
  masked = masked.replace(SENSITIVE_PATTERNS.email, (match) => {
    const [local, domain] = match.split('@');
    return `${local[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
  });
  
  // Mask full credit card numbers
  masked = masked.replace(SENSITIVE_PATTERNS.creditCard, '**** **** **** ****');
  
  return masked;
};

/**
 * Check if extracted transaction contains sensitive data
 */
export const checkTransactionSensitivity = (transaction: {
  description?: string;
  debtor?: string;
  reimbursedBy?: string;
}): { hasSensitiveData: boolean; fields: string[] } => {
  const sensitiveFields: string[] = [];
  
  const checkField = (value: string | undefined, fieldName: string) => {
    if (!value) return;
    
    for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
      if (pattern.test(value)) {
        sensitiveFields.push(`${fieldName} (${type})`);
        break;
      }
    }
  };
  
  checkField(transaction.description, 'description');
  checkField(transaction.debtor, 'debtor');
  checkField(transaction.reimbursedBy, 'reimbursedBy');
  
  return {
    hasSensitiveData: sensitiveFields.length > 0,
    fields: sensitiveFields
  };
};

// ============ Secure Logging ============

/**
 * Safe console log that masks sensitive data
 * Use this instead of console.log for import-related logging
 */
export const secureLog = (message: string, data?: any): void => {
  if (process.env.NODE_ENV === 'production') {
    // In production, only log minimal info
    console.log(`[Import] ${message}`);
    return;
  }
  
  // In development, mask sensitive data
  if (data) {
    const safeData = typeof data === 'string' 
      ? maskSensitiveData(data)
      : JSON.parse(maskSensitiveData(JSON.stringify(data)));
    console.log(`[Import] ${message}`, safeData);
  } else {
    console.log(`[Import] ${message}`);
  }
};

// ============ Import Consent ============

const IMPORT_CONSENT_KEY = 'finai_import_consent';

export interface ImportConsent {
  accepted: boolean;
  timestamp: number;
  version: string;
}

const CURRENT_CONSENT_VERSION = '1.0';

/**
 * Check if user has accepted import privacy terms
 */
export const hasImportConsent = (): boolean => {
  try {
    const stored = localStorage.getItem(IMPORT_CONSENT_KEY);
    if (!stored) return false;
    
    const consent: ImportConsent = JSON.parse(stored);
    return consent.accepted && consent.version === CURRENT_CONSENT_VERSION;
  } catch {
    return false;
  }
};

/**
 * Save user's import consent
 */
export const saveImportConsent = (accepted: boolean): void => {
  const consent: ImportConsent = {
    accepted,
    timestamp: Date.now(),
    version: CURRENT_CONSENT_VERSION
  };
  localStorage.setItem(IMPORT_CONSENT_KEY, JSON.stringify(consent));
};

/**
 * Clear import consent (for testing or user request)
 */
export const clearImportConsent = (): void => {
  localStorage.removeItem(IMPORT_CONSENT_KEY);
};

// ============ Rate Limiting for Imports ============

const IMPORT_RATE_KEY = 'finai_import_rate';
const MAX_IMPORTS_PER_HOUR = 20;

interface ImportRateData {
  timestamps: number[];
}

/**
 * Check if user can perform another import (rate limiting)
 */
export const canPerformImport = (): { allowed: boolean; remainingImports: number; resetIn?: number } => {
  try {
    const stored = localStorage.getItem(IMPORT_RATE_KEY);
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let data: ImportRateData = stored ? JSON.parse(stored) : { timestamps: [] };
    
    // Filter to only recent imports
    data.timestamps = data.timestamps.filter(t => t > oneHourAgo);
    
    const remaining = MAX_IMPORTS_PER_HOUR - data.timestamps.length;
    
    if (remaining <= 0) {
      const oldestTimestamp = Math.min(...data.timestamps);
      const resetIn = (oldestTimestamp + 60 * 60 * 1000) - now;
      return { allowed: false, remainingImports: 0, resetIn };
    }
    
    return { allowed: true, remainingImports: remaining };
  } catch {
    return { allowed: true, remainingImports: MAX_IMPORTS_PER_HOUR };
  }
};

/**
 * Record an import for rate limiting
 */
export const recordImport = (): void => {
  try {
    const stored = localStorage.getItem(IMPORT_RATE_KEY);
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let data: ImportRateData = stored ? JSON.parse(stored) : { timestamps: [] };
    
    // Clean old entries and add new one
    data.timestamps = data.timestamps.filter(t => t > oneHourAgo);
    data.timestamps.push(now);
    
    localStorage.setItem(IMPORT_RATE_KEY, JSON.stringify(data));
  } catch {
    // Ignore errors
  }
};

// ============ Export Summary ============

export const importSecurityUtils = {
  validateImportFile,
  getImportPrivacyNotice,
  maskSensitiveData,
  checkTransactionSensitivity,
  secureLog,
  hasImportConsent,
  saveImportConsent,
  clearImportConsent,
  canPerformImport,
  recordImport
};
