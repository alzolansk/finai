# 🔐 Melhorias de Segurança - FinAI

Este documento descreve as melhorias de segurança necessárias para tornar o FinAI um projeto open source seguro.

## 📋 Resumo das Vulnerabilidades

| Prioridade | Vulnerabilidade | Impacto |
|------------|-----------------|---------|
| 🔴 Crítica | Regras Firestore abertas | Acesso total a dados de qualquer usuário |
| 🔴 Crítica | Sem autenticação | Qualquer um pode acessar dados com userId |
| 🟠 Alta | Documentos enviados para Gemini | Dados financeiros processados por terceiros |
| 🟠 Alta | Dados sem criptografia | Exposição de informações financeiras |
| 🟡 Média | localStorage sem proteção | Dados acessíveis via DevTools |
| 🟡 Média | Logs expõem dados sensíveis | Console.log com informações de arquivos |

---

## 🛠️ Implementações Recomendadas

### 1. Autenticação Firebase (Prioridade: Crítica)

Implementar Firebase Authentication com opções de login simples:

```typescript
// services/authService.ts
import { 
  getAuth, 
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { app } from './firebaseConfig';

const auth = getAuth(app);

// Login anônimo (mantém simplicidade para usuários casuais)
export const signInAnonymous = async (): Promise<User> => {
  const result = await signInAnonymously(auth);
  return result.user;
};

// Login com Google (para sincronização entre dispositivos)
export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

// Observador de estado de autenticação
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Obter usuário atual
export const getCurrentUser = (): User | null => auth.currentUser;

// Logout
export const signOut = () => auth.signOut();
```

**Impacto na UX:** Mínimo. Usuários podem continuar usando anonimamente, mas com opção de vincular conta Google para sincronização segura.

---

### 2. Regras de Segurança do Firestore

Substituir as regras atuais por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Função auxiliar para verificar autenticação
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Função para verificar se é o dono dos dados
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Dados do usuário - apenas o próprio usuário pode acessar
    match /users/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    
    // Configurações públicas (se necessário)
    match /public/{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

### 3. Segurança na Importação de Documentos (Prioridade: Alta)

A funcionalidade de importação de faturas e extratos envia documentos financeiros para a API do Gemini. Implementamos as seguintes proteções:

#### 3.1 Consentimento Informado

Antes da primeira importação, o usuário deve aceitar os termos de privacidade:

```typescript
// Usar o componente ImportPrivacyConsent.tsx
import ImportPrivacyConsent from './components/ImportPrivacyConsent';
import { hasImportConsent } from './utils/importSecurity';

// No componente de importação:
if (!hasImportConsent()) {
  return <ImportPrivacyConsent onAccept={handleAccept} onDecline={handleDecline} />;
}
```

#### 3.2 Validação de Arquivos

```typescript
import { validateImportFile } from './utils/importSecurity';

const result = validateImportFile(file);
if (!result.valid) {
  alert(result.error);
  return;
}
```

#### 3.3 Logs Seguros (sem dados sensíveis)

```typescript
import { secureLog } from './utils/importSecurity';

// Em vez de: console.log('Processando:', fileData);
secureLog('Processando arquivo', { fileName, size: fileData.length });
```

#### 3.4 Rate Limiting

```typescript
import { canPerformImport, recordImport } from './utils/importSecurity';

const { allowed, remainingImports } = canPerformImport();
if (!allowed) {
  alert('Limite de importações atingido. Tente novamente em alguns minutos.');
  return;
}
recordImport(); // Após sucesso
```

#### 3.5 O que é enviado para o Gemini

| Dado | Enviado? | Observação |
|------|----------|------------|
| Conteúdo do arquivo (base64) | ✅ Sim | Necessário para extração |
| Nome do arquivo | ✅ Sim | Ajuda na detecção de tipo |
| Transações existentes | ⚠️ Parcial | Apenas descrições para evitar duplicatas |
| Dados do usuário | ❌ Não | Não enviamos nome, email, etc. |

---

### 4. Proxy para API Gemini (Backend)

Criar um endpoint serverless para proteger a API key:

```typescript
// Exemplo com Vercel Edge Functions ou Firebase Functions
// api/gemini.ts

import { GoogleGenAI } from "@google/genai";

const ALLOWED_ORIGINS = ['https://seu-dominio.com', 'http://localhost:5173'];

export default async function handler(req: Request) {
  // Verificar origem
  const origin = req.headers.get('origin');
  if (!ALLOWED_ORIGINS.includes(origin || '')) {
    return new Response('Forbidden', { status: 403 });
  }

  // Verificar autenticação (token Firebase)
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Validar token Firebase aqui...

  // Rate limiting por usuário
  // Implementar com Redis ou similar

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Processar requisição...
}
```

**Alternativa simples (sem backend):** Usar Firebase App Check para proteger chamadas.

---

### 4. Criptografia de Dados Sensíveis

Para dados no localStorage e campos sensíveis no Firestore:

```typescript
// utils/encryption.ts
import CryptoJS from 'crypto-js';

// Derivar chave do userId (ou senha do usuário)
const deriveKey = (userId: string, salt: string): string => {
  return CryptoJS.PBKDF2(userId, salt, { keySize: 256/32, iterations: 1000 }).toString();
};

// Criptografar dados sensíveis
export const encryptData = (data: any, userId: string): string => {
  const salt = localStorage.getItem('finai_salt') || generateSalt();
  const key = deriveKey(userId, salt);
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

// Descriptografar dados
export const decryptData = <T>(encryptedData: string, userId: string): T => {
  const salt = localStorage.getItem('finai_salt') || '';
  const key = deriveKey(userId, salt);
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

// Gerar salt único por instalação
const generateSalt = (): string => {
  const salt = CryptoJS.lib.WordArray.random(128/8).toString();
  localStorage.setItem('finai_salt', salt);
  return salt;
};
```

**Campos a criptografar:**
- `transaction.description` (pode conter nomes de pessoas/empresas)
- `transaction.debtor` / `transaction.reimbursedBy`
- `settings.monthlyIncome`
- `wishlistItem.name` / `wishlistItem.description`

---

### 5. Sanitização de Dados de Importação

Adicionar validação antes de processar arquivos:

```typescript
// utils/sanitization.ts

// Limitar tamanho de arquivo
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Tipos MIME permitidos
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

// Validar arquivo antes de enviar para Gemini
export const validateImportFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Arquivo muito grande (máx 10MB)' };
  }
  
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Tipo de arquivo não suportado' };
  }
  
  return { valid: true };
};

// Sanitizar descrições de transações
export const sanitizeDescription = (desc: string): string => {
  return desc
    .replace(/<[^>]*>/g, '') // Remove HTML
    .replace(/[<>\"\']/g, '') // Remove caracteres perigosos
    .trim()
    .slice(0, 200); // Limita tamanho
};
```

---

### 6. Headers de Segurança (para deploy)

Adicionar no `vite.config.ts` ou configuração do servidor:

```typescript
// vite.config.ts
export default defineConfig({
  // ...
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com"
    }
  }
});
```

---

## 📁 Arquivos a Modificar

1. **Criar:** `services/authService.ts` - Serviço de autenticação
2. **Criar:** `utils/encryption.ts` - Funções de criptografia
3. **Criar:** `utils/sanitization.ts` - Validação de inputs
4. **Modificar:** `services/syncService.ts` - Usar auth.uid ao invés de localStorage
5. **Modificar:** `services/storageService.ts` - Adicionar criptografia
6. **Modificar:** `services/geminiService.ts` - Usar proxy ou App Check
7. **Criar:** `firestore.rules` - Regras de segurança
8. **Atualizar:** `.env.example` - Remover valores de exemplo sensíveis

---

## 🔄 Migração de Dados Existentes

Para usuários existentes, criar um fluxo de migração:

1. Detectar dados antigos no localStorage
2. Solicitar criação de conta (anônima ou Google)
3. Criptografar e migrar dados para novo formato
4. Limpar dados antigos não criptografados

---

## ✅ Checklist de Implementação

- [ ] Implementar Firebase Authentication
- [ ] Atualizar regras do Firestore
- [ ] Criar proxy para Gemini API (ou usar App Check)
- [ ] Adicionar criptografia para dados sensíveis
- [ ] Implementar validação de arquivos de importação
- [ ] Adicionar headers de segurança
- [ ] Criar fluxo de migração de dados
- [ ] Atualizar documentação
- [ ] Remover chaves reais do repositório
- [ ] Adicionar `.env.local` ao `.gitignore` (já está)

---

## 🎯 Impacto na Usabilidade

| Melhoria | Impacto UX | Justificativa |
|----------|------------|---------------|
| Auth anônimo | ⭐ Nenhum | Transparente para o usuário |
| Login Google | ⭐ Mínimo | Opcional, apenas para sync |
| Criptografia | ⭐ Nenhum | Transparente, automático |
| Validação arquivos | ⭐ Positivo | Feedback claro de erros |
| Regras Firestore | ⭐ Nenhum | Backend apenas |

Todas as melhorias foram pensadas para manter a experiência atual do usuário enquanto adicionam camadas de segurança essenciais.
