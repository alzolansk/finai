/**
 * Encryption utilities for sensitive financial data
 * Uses Web Crypto API for secure encryption
 */

const SALT_KEY = 'finai_encryption_salt';
const ALGORITHM = 'AES-GCM';

/**
 * Generate a random salt for key derivation
 */
const generateSalt = (): Uint8Array => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, arrayBufferToBase64(salt));
  return salt;
};

/**
 * Get or create salt
 */
const getSalt = (): Uint8Array => {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) {
    return base64ToArrayBuffer(stored);
  }
  return generateSalt();
};

/**
 * Derive encryption key from user ID
 */
const deriveKey = async (userId: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = getSalt();
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Encrypt sensitive data
 * @param data - Data to encrypt (will be JSON stringified)
 * @param userId - User ID for key derivation
 * @returns Encrypted string (base64)
 */
export const encryptData = async (data: any, userId: string): Promise<string> => {
  try {
    const key = await deriveKey(userId);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return arrayBufferToBase64(combined);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data
 * @param encryptedData - Base64 encrypted string
 * @param userId - User ID for key derivation
 * @returns Decrypted data
 */
export const decryptData = async <T>(encryptedData: string, userId: string): Promise<T> => {
  try {
    const key = await deriveKey(userId);
    const combined = base64ToArrayBuffer(encryptedData);
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Check if a string is encrypted (basic check)
 */
export const isEncrypted = (data: string): boolean => {
  try {
    // Encrypted data is base64 and at least 12 bytes (IV) + some data
    const decoded = atob(data);
    return decoded.length > 12 && !/^[\x20-\x7E]*$/.test(decoded);
  } catch {
    return false;
  }
};

/**
 * Sensitive fields that should be encrypted
 */
export const SENSITIVE_FIELDS = [
  'description',
  'debtor',
  'reimbursedBy',
  'monthlyIncome',
  'savingsGoal',
  'name', // for wishlist items
  'issuer'
] as const;

/**
 * Encrypt sensitive fields in an object
 */
export const encryptSensitiveFields = async <T extends Record<string, any>>(
  obj: T,
  userId: string,
  fields: readonly string[] = SENSITIVE_FIELDS
): Promise<T> => {
  const result = { ...obj } as Record<string, any>;
  
  for (const field of fields) {
    if (field in result && result[field] != null) {
      result[field] = await encryptData(result[field], userId);
    }
  }
  
  return result as T;
};

/**
 * Decrypt sensitive fields in an object
 */
export const decryptSensitiveFields = async <T extends Record<string, any>>(
  obj: T,
  userId: string,
  fields: readonly string[] = SENSITIVE_FIELDS
): Promise<T> => {
  const result = { ...obj } as Record<string, any>;
  
  for (const field of fields) {
    if (field in result && typeof result[field] === 'string' && isEncrypted(result[field])) {
      try {
        result[field] = await decryptData(result[field], userId);
      } catch {
        // If decryption fails, keep original value (might be unencrypted legacy data)
        console.warn(`Failed to decrypt field: ${field}`);
      }
    }
  }
  
  return result as T;
};
