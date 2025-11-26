<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/11Hp7QkaqVf8aWi0Ol2pEwEayfWA7yVgV

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (Vite only exposes variables prefixed with `VITE_`). If you prefer storing it in the browser, you can also set `localStorage.setItem('finai_gemini_api_key', '<sua-chave>')` in the devtools console.
3. Run the app:
   `npm run dev`

---

## 📥 Nova Funcionalidade: Importação de Extratos Bancários

### Visão Geral

O FinAI agora suporta **importação de extratos bancários** além de faturas de cartão de crédito. O sistema identifica automaticamente o tipo de documento e aplica filtros inteligentes para garantir que apenas transações relevantes sejam registradas.

### Como Funciona

Ao importar um arquivo (PDF, CSV, ou imagem), a IA:

1. **Detecta automaticamente** se é uma **fatura de cartão** ou **extrato bancário**
2. **Identifica o emissor** (banco ou cartão)
3. **Extrai transações** linha a linha
4. **Aplica filtros inteligentes** para evitar duplicações e lançamentos irrelevantes

### Filtros Inteligentes

#### 🔄 Transferências Internas
**Não cria transação** quando detecta:
- Transferências entre contas do mesmo titular
- PIX para conta própria
- Aplicações e resgates (investimentos/poupança)
- Exemplos de padrões detectados:
  - "Transferência para João Vitor" (quando João é o titular)
  - "PIX enviado João Vitor" → "PIX recebido João Vitor"
  - "Aplicação Poupança", "Resgate Investimento"

**Motivo:** Movimentações internas não representam receita ou despesa real.

#### 💳 Pagamentos de Faturas
**Não cria transação** quando detecta:
- Pagamento de fatura de cartão de crédito
- Débito automático de fatura
- Exemplos de padrões detectados:
  - "Pagamento Fatura Cartão"
  - "PGTO CARTÃO CRÉDITO"
  - "DÉBITO AUTOMÁTICO FATURA NUBANK"
  - "Fatura Bradesco", "Pagamento C6 Bank"

**Motivo:** Evita dupla contagem, já que os itens da fatura já foram importados pelo módulo de faturas.

#### 📊 Linhas de Saldo
**Não cria transação** quando detecta:
- "Saldo Anterior", "Saldo Atual"
- "Saldo Disponível"
- Linhas informativas de balanço

### Tipos de Documentos Suportados

| Tipo | Descrição | Filtros Aplicados |
|------|-----------|-------------------|
| **Fatura de Cartão** | Faturas mensais de cartão de crédito | ✅ Detecta data de vencimento<br>✅ Evita duplicação de assinaturas<br>✅ Ignora linhas de pagamento/total |
| **Extrato Bancário** | Extratos de conta corrente/poupança | ✅ Filtra transferências internas<br>✅ Filtra pagamentos de faturas<br>✅ Filtra linhas de saldo |

### Formatos Aceitos
- **PDF** - Faturas e extratos em PDF
- **Imagens** - JPG, PNG (screenshots de apps bancários)
- **CSV** - Exportações de planilhas

### Como Usar

1. Vá em **"Adicionar"** → **"Importar"**
2. Faça upload do arquivo (fatura ou extrato)
3. Aguarde a análise da IA
4. O sistema identificará o tipo e aplicará os filtros automaticamente
5. Somente transações relevantes serão adicionadas

### Auditoria e Transparência

Todas as transações filtradas são registradas no console para auditoria:
```
⚠️ Skipping internal transfer: "PIX para João Vitor (próprio)"
⚠️ Skipping invoice payment: "PAGAMENTO FATURA NUBANK"
```

### Configuração Técnica

#### Tipos Adicionados (`types.ts`)
```typescript
movementType?: 'regular' | 'internal_transfer' | 'invoice_payment';
ignoredReason?: string;
```

#### Funções Utilitárias (`importUtils.ts`)
- `isPagamentoFaturaDescription()` - Detecta pagamentos de fatura
- `isLikelyInternalTransfer()` - Detecta transferências internas

#### API de Importação (`geminiService.ts`)
A função `parseImportFile()` agora aceita um parâmetro opcional:
```typescript
ownerName?: string // Nome do titular para detectar transferências internas
```

### Benefícios

✅ **Zero duplicação** - Evita lançar a mesma despesa duas vezes  
✅ **Visão financeira real** - Só conta o que realmente impacta o orçamento  
✅ **Economia de tempo** - Processamento automático e inteligente  
✅ **Transparência** - Log de tudo que foi filtrado para auditoria
