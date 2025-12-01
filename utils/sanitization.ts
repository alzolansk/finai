/**
 * Input sanitization and validation utilities
 * Protects against XSS, injection attacks, and invalid data
 */

// ============ File Validation ============

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel' // xls
] as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file before processing
 */
export const validateImportFile = (file: File): FileValidationResult => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `Arquivo muito grande. Máximo permitido: ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
    };
  }

  // Check file size minimum (empty files)
  if (file.size === 0) {
    return { valid: false, error: 'Arquivo vazio' };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return { 
      valid: false, 
      error: `Tipo de arquivo não suportado: ${file.type || 'desconhecido'}. Use PDF, imagens ou planilhas.` 
    };
  }

  // Check file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase();
  const validExtensions: Record<string, string[]> = {
    'application/pdf': ['pdf'],
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/jpg': ['jpg', 'jpeg'],
    'image/webp': ['webp'],
    'text/csv': ['csv'],
    'text/plain': ['txt', 'csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.ms-excel': ['xls']
  };

  const allowedExtensions = validExtensions[file.type] || [];
  if (extension && !allowedExtensions.includes(extension)) {
    return { 
      valid: false, 
      error: `Extensão do arquivo não corresponde ao tipo. Esperado: ${allowedExtensions.join(', ')}` 
    };
  }

  return { valid: true };
};

// ============ Text Sanitization ============

/**
 * Remove HTML tags and dangerous characters from text
 */
export const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Sanitize transaction description
 */
export const sanitizeDescription = (description: string): string => {
  if (!description || typeof description !== 'string') return '';
  
  return sanitizeText(description)
    .replace(/[^\w\s\-.,()\/áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/gi, '') // Allow only safe chars
    .slice(0, 200); // Limit length
};

/**
 * Sanitize person name (debtor, reimbursedBy)
 */
export const sanitizeName = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  return sanitizeText(name)
    .replace(/[^\w\s\-'áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/gi, '')
    .slice(0, 100);
};

/**
 * Sanitize tags array
 */
export const sanitizeTags = (tags: string[]): string[] => {
  if (!Array.isArray(tags)) return [];
  
  return tags
    .filter(tag => typeof tag === 'string')
    .map(tag => sanitizeText(tag).toLowerCase().slice(0, 50))
    .filter(tag => tag.length > 0)
    .slice(0, 10); // Max 10 tags
};

// ============ Number Validation ============

/**
 * Validate and sanitize monetary amount
 */
export const sanitizeAmount = (amount: any): number => {
  const num = parseFloat(amount);
  
  if (isNaN(num) || !isFinite(num)) return 0;
  if (num < 0) return Math.abs(num); // Convert negative to positive
  if (num > 999999999) return 999999999; // Max ~1 billion
  
  return Math.round(num * 100) / 100; // Round to 2 decimal places
};

/**
 * Validate date string
 */
export const sanitizeDate = (date: string): string | null => {
  if (!date || typeof date !== 'string') return null;
  
  // Try to parse as ISO date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return null;
  
  // Check if date is reasonable (not too far in past or future)
  const now = new Date();
  const minDate = new Date('2000-01-01');
  const maxDate = new Date(now.getFullYear() + 10, 11, 31);
  
  if (parsed < minDate || parsed > maxDate) return null;
  
  return parsed.toISOString();
};

// ============ Transaction Validation ============

import { Transaction, TransactionType, Category } from '../types';

/**
 * Validate and sanitize a transaction object
 */
export const sanitizeTransaction = (transaction: Partial<Transaction>): Partial<Transaction> => {
  const sanitized: Partial<Transaction> = {};

  // Required fields
  if (transaction.id) {
    sanitized.id = sanitizeText(transaction.id).slice(0, 100);
  }

  if (transaction.description) {
    sanitized.description = sanitizeDescription(transaction.description);
  }

  if (transaction.amount !== undefined) {
    sanitized.amount = sanitizeAmount(transaction.amount);
  }

  if (transaction.date) {
    const date = sanitizeDate(transaction.date);
    if (date) sanitized.date = date;
  }

  if (transaction.paymentDate) {
    const paymentDate = sanitizeDate(transaction.paymentDate);
    if (paymentDate) sanitized.paymentDate = paymentDate;
  }

  // Enum validation
  if (transaction.type && Object.values(TransactionType).includes(transaction.type)) {
    sanitized.type = transaction.type;
  }

  if (transaction.category && Object.values(Category).includes(transaction.category)) {
    sanitized.category = transaction.category;
  }

  // Optional fields
  if (transaction.issuer) {
    sanitized.issuer = sanitizeName(transaction.issuer);
  }

  if (transaction.debtor) {
    sanitized.debtor = sanitizeName(transaction.debtor);
  }

  if (transaction.reimbursedBy) {
    sanitized.reimbursedBy = sanitizeName(transaction.reimbursedBy);
  }

  if (transaction.tags) {
    sanitized.tags = sanitizeTags(transaction.tags);
  }

  // Boolean fields
  if (typeof transaction.isRecurring === 'boolean') {
    sanitized.isRecurring = transaction.isRecurring;
  }

  if (typeof transaction.isReimbursable === 'boolean') {
    sanitized.isReimbursable = transaction.isReimbursable;
  }

  if (typeof transaction.isCreditPurchase === 'boolean') {
    sanitized.isCreditPurchase = transaction.isCreditPurchase;
  }

  return sanitized;
};

// ============ API Response Validation ============

/**
 * Validate Gemini API response structure
 */
export const validateGeminiResponse = (response: any): boolean => {
  if (!response || typeof response !== 'object') return false;
  
  // Check for required fields based on expected response type
  if (Array.isArray(response)) {
    return response.every(item => typeof item === 'object');
  }
  
  return true;
};

/**
 * Rate limiting helper - tracks API calls per time window
 */
export class RateLimiter {
  private calls: number[] = [];
  private maxCalls: number;
  private windowMs: number;

  constructor(maxCalls: number = 10, windowMs: number = 60000) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  canMakeCall(): boolean {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.windowMs);
    return this.calls.length < this.maxCalls;
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  getRemainingCalls(): number {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxCalls - this.calls.length);
  }

  getResetTime(): number {
    if (this.calls.length === 0) return 0;
    const oldestCall = Math.min(...this.calls);
    return Math.max(0, this.windowMs - (Date.now() - oldestCall));
  }
}

// Global rate limiter for Gemini API
export const geminiRateLimiter = new RateLimiter(15, 60000); // 15 calls per minute
