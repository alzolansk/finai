# Configuração do Firebase para Sincronização

Este guia explica como configurar o Firebase para sincronizar seus dados entre dispositivos.

## Passo 1: Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Dê um nome ao projeto (ex: "finai-app")
4. Desative o Google Analytics (opcional)
5. Clique em "Criar projeto"

## Passo 2: Criar App Web

1. No painel do projeto, clique no ícone `</>` (Web)
2. Dê um apelido ao app (ex: "FinAI Web")
3. **NÃO** marque "Firebase Hosting"
4. Clique em "Registrar app"
5. Copie as credenciais que aparecem

## Passo 3: Ativar Firestore

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Selecione "Iniciar no modo de teste" (para desenvolvimento)
4. Escolha a região mais próxima (ex: southamerica-east1)
5. Clique em "Ativar"

## Passo 4: Configurar Regras de Segurança

No Firestore, vá em "Regras" e cole:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permite leitura e escrita para qualquer usuário autenticado ou anônimo
    // Para produção, implemente autenticação adequada
    match /users/{userId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ **Importante**: Essas regras são para desenvolvimento. Para produção, implemente autenticação.

## Passo 5: Adicionar Credenciais

1. Abra o arquivo `.env.local` na raiz do projeto
2. Adicione as variáveis do Firebase:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

3. Reinicie o servidor de desenvolvimento

## Passo 6: Sincronizar Dispositivos

### No primeiro dispositivo:
1. Abra as Configurações (ícone de engrenagem)
2. Vá em "Sincronização na Nuvem"
3. Clique em "Enviar dados para nuvem"
4. Copie seu "ID de Sincronização"

### No segundo dispositivo:
1. Abra as Configurações
2. Vá em "Sincronização na Nuvem"
3. Clique em "Conectar a outro dispositivo"
4. Cole o ID do primeiro dispositivo
5. Clique em "Conectar"

## Pronto! 🎉

Agora seus dados serão sincronizados em tempo real entre os dispositivos.

---

## Solução de Problemas

### "Sincronização Desativada"
- Verifique se as variáveis de ambiente estão corretas
- Reinicie o servidor de desenvolvimento
- Verifique o console do navegador para erros

### Dados não sincronizam
- Verifique se o Firestore está ativo
- Verifique as regras de segurança
- Verifique a conexão com a internet

### Erro de permissão
- Atualize as regras do Firestore
- Verifique se o projeto está correto
