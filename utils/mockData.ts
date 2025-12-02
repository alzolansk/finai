import { Transaction, TransactionType, Category, WishlistItem, WishlistItemType, WishlistPriority, UserSettings, ChatMessage, BudgetAlert, CategoryBudget } from '../types';

// Dados mockados realistas para demonstração no LinkedIn

export const mockUserSettings: UserSettings = {
  monthlyIncome: 8500,
  savingsGoal: 1500,
  onboardingCompleted: true,
  fixedExpenses: [
    { description: 'Aluguel', amount: 1800 },
    { description: 'Condomínio', amount: 450 },
    { description: 'Internet', amount: 120 },
    { description: 'Academia', amount: 99 },
  ],
};

// Transações dos últimos 3 meses - bem variadas e realistas
export const mockTransactions: Transaction[] = [
  // Novembro 2024
  { id: '1', description: 'Salário', amount: 8500, date: '2024-11-05', paymentDate: '2024-11-05', category: Category.SALARY, type: TransactionType.INCOME, isRecurring: true, createdAt: Date.now() },
  { id: '2', description: 'Freelance - Logo Design', amount: 1200, date: '2024-11-12', paymentDate: '2024-11-12', category: Category.SALARY, type: TransactionType.INCOME, createdAt: Date.now() },
  { id: '3', description: 'Aluguel Apartamento', amount: 1800, date: '2024-11-10', paymentDate: '2024-11-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '4', description: 'Condomínio', amount: 450, date: '2024-11-10', paymentDate: '2024-11-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '5', description: 'Conta de Luz - Enel', amount: 187.45, date: '2024-11-15', paymentDate: '2024-11-15', category: Category.UTILITIES, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '6', description: 'Internet Vivo Fibra', amount: 119.99, date: '2024-11-08', paymentDate: '2024-11-08', category: Category.UTILITIES, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '7', description: 'iFood - Jantar', amount: 67.90, date: '2024-11-18', paymentDate: '2024-11-18', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '8', description: 'Supermercado Extra', amount: 423.87, date: '2024-11-20', paymentDate: '2024-11-20', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '9', description: 'Uber - Trabalho', amount: 34.50, date: '2024-11-22', paymentDate: '2024-11-22', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '10', description: 'Spotify Premium', amount: 21.90, date: '2024-11-01', paymentDate: '2024-11-01', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '11', description: 'Netflix', amount: 55.90, date: '2024-11-01', paymentDate: '2024-11-01', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '12', description: 'Amazon Prime', amount: 14.90, date: '2024-11-01', paymentDate: '2024-11-01', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '13', description: 'Cinema - Gladiador 2', amount: 89.00, date: '2024-11-24', paymentDate: '2024-11-24', category: Category.ENTERTAINMENT, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '14', description: 'Smart Fit', amount: 99.90, date: '2024-11-05', paymentDate: '2024-11-05', category: Category.HEALTH, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '15', description: 'Farmácia - Vitaminas', amount: 156.00, date: '2024-11-16', paymentDate: '2024-11-16', category: Category.HEALTH, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '16', description: 'Curso Udemy - React', amount: 27.90, date: '2024-11-10', paymentDate: '2024-11-10', category: Category.EDUCATION, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '17', description: 'Investimento Nubank', amount: 500, date: '2024-11-06', paymentDate: '2024-11-06', category: Category.SAVINGS, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '18', description: 'Gasolina Shell', amount: 250, date: '2024-11-14', paymentDate: '2024-11-14', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '19', description: 'Restaurante Outback', amount: 187.50, date: '2024-11-23', paymentDate: '2024-11-23', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '20', description: 'Presente Aniversário Mãe', amount: 350, date: '2024-11-25', paymentDate: '2024-11-25', category: Category.SHOPPING, type: TransactionType.EXPENSE, createdAt: Date.now() },

  // Dezembro 2024
  { id: '21', description: 'Salário', amount: 8500, date: '2024-12-05', paymentDate: '2024-12-05', category: Category.SALARY, type: TransactionType.INCOME, isRecurring: true, createdAt: Date.now() },
  { id: '22', description: '13º Salário', amount: 8500, date: '2024-12-20', paymentDate: '2024-12-20', category: Category.SALARY, type: TransactionType.INCOME, createdAt: Date.now() },
  { id: '23', description: 'Aluguel Apartamento', amount: 1800, date: '2024-12-10', paymentDate: '2024-12-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '24', description: 'Condomínio', amount: 450, date: '2024-12-10', paymentDate: '2024-12-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: Date.now() },
  { id: '25', description: 'Conta de Luz - Enel', amount: 234.67, date: '2024-12-15', paymentDate: '2024-12-15', category: Category.UTILITIES, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '26', description: 'Ceia de Natal - Supermercado', amount: 687.90, date: '2024-12-22', paymentDate: '2024-12-22', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '27', description: 'Presentes de Natal', amount: 1250, date: '2024-12-18', paymentDate: '2024-12-18', category: Category.SHOPPING, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '28', description: 'Viagem Réveillon - Hotel', amount: 890, date: '2024-12-28', paymentDate: '2024-12-28', category: Category.ENTERTAINMENT, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '29', description: 'Investimento CDB', amount: 2000, date: '2024-12-21', paymentDate: '2024-12-21', category: Category.SAVINGS, type: TransactionType.EXPENSE, createdAt: Date.now() },
  { id: '30', description: 'IPVA 2025 - Cota 1', amount: 456.78, date: '2024-12-30', paymentDate: '2024-12-30', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: Date.now() },
];

// Wishlist com itens variados e análises da IA
export const mockWishlistItems: WishlistItem[] = [
  {
    id: 'w1',
    name: 'iPhone 15 Pro Max 256GB',
    description: 'Smartphone Apple com chip A17 Pro, câmera de 48MP e tela Super Retina XDR de 6.7"',
    targetAmount: 9499,
    savedAmount: 3200,
    type: WishlistItemType.PURCHASE,
    priority: WishlistPriority.HIGH,
    isViable: true,
    viabilityDate: '2025-04-15',
    aiAnalysis: 'Com sua capacidade de economia atual de R$ 1.847/mês, você consegue alcançar esse objetivo em aproximadamente 3.4 meses. Recomendo aguardar a Black Friday para possível desconto de 10-15%.',
    aiRecommendation: 'Viável! Continue economizando R$ 1.850/mês e você terá o valor completo em Abril/2025.',
    paymentOption: 'cash',
    priceResearchConfidence: 'high',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'w2',
    name: 'Viagem para Portugal - 10 dias',
    description: 'Roteiro Lisboa, Porto e Sintra com passagens, hospedagem e passeios inclusos',
    targetAmount: 15000,
    savedAmount: 5500,
    type: WishlistItemType.TRAVEL,
    priority: WishlistPriority.MEDIUM,
    targetDate: '2025-07-01',
    isViable: true,
    viabilityDate: '2025-06-20',
    aiAnalysis: 'Excelente planejamento! Com 6 meses de antecedência, você tem tempo suficiente para economizar. Dica: compre as passagens com 3-4 meses de antecedência para melhores preços.',
    aiRecommendation: 'Meta alcançável! Economize R$ 1.583/mês até Junho. Considere usar milhas para reduzir custos.',
    paymentOption: 'cash',
    priceResearchConfidence: 'medium',
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'w3',
    name: 'MacBook Air M3 15"',
    description: 'Notebook Apple com chip M3, 16GB RAM, 512GB SSD, tela Liquid Retina',
    targetAmount: 17999,
    savedAmount: 0,
    type: WishlistItemType.PURCHASE,
    priority: WishlistPriority.LOW,
    isViable: false,
    aiAnalysis: 'Este é um investimento significativo. Com sua renda atual, levaria aproximadamente 10 meses para juntar o valor total. Considere o parcelamento em 12x sem juros.',
    aiRecommendation: 'Considere parcelar em 12x de R$ 1.499,92 ou aguardar promoções na Amazon/Apple.',
    paymentOption: 'installments',
    installmentCount: 12,
    installmentAmount: 1499.92,
    priceResearchConfidence: 'high',
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'w4',
    name: 'Curso MBA em Data Science - USP',
    description: 'Pós-graduação em Ciência de Dados com duração de 18 meses',
    targetAmount: 32000,
    savedAmount: 8000,
    type: WishlistItemType.INVESTMENT,
    priority: WishlistPriority.HIGH,
    targetDate: '2025-03-01',
    isViable: true,
    aiAnalysis: 'Investimento em educação com alto retorno. O mercado de Data Science tem salários médios 40% maiores. Você pode parcelar diretamente com a instituição.',
    aiRecommendation: 'Excelente investimento na carreira! Considere financiamento estudantil ou parcelamento direto.',
    paymentOption: 'installments',
    installmentCount: 18,
    installmentAmount: 1777.78,
    priceResearchConfidence: 'high',
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
];

// Mensagens do chat com a IA
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'c1',
    role: 'user',
    text: 'Como estão meus gastos esse mês?',
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'c2',
    role: 'assistant',
    text: 'Analisei suas finanças de Dezembro! 📊\n\n**Resumo do mês:**\n- Receita total: R$ 17.000 (incluindo 13º)\n- Gastos: R$ 7.769,35\n- Saldo positivo: R$ 9.230,65 🎉\n\n**Destaques:**\n✅ Você investiu R$ 2.000 - ótimo!\n⚠️ Gastos com presentes de Natal acima da média\n💡 Dica: Reserve parte do 13º para a reserva de emergência\n\nQuer que eu detalhe alguma categoria específica?',
    timestamp: Date.now() - 3500000,
  },
  {
    id: 'c3',
    role: 'user',
    text: 'Consigo comprar o iPhone 15 Pro Max em quanto tempo?',
    timestamp: Date.now() - 1800000,
  },
  {
    id: 'c4',
    role: 'assistant',
    text: 'Vamos calcular! 📱\n\n**iPhone 15 Pro Max 256GB**\n- Preço: R$ 9.499\n- Já economizado: R$ 3.200\n- Falta: R$ 6.299\n\n**Com sua capacidade de economia atual (R$ 1.847/mês):**\n⏱️ Tempo estimado: **3.4 meses** (meados de Abril/2025)\n\n**Dicas para acelerar:**\n1. 🏷️ Aguarde a próxima promoção (pode cair 10-15%)\n2. 💳 Considere cashback de cartões\n3. 📱 Venda seu celular atual como entrada\n\nQuer que eu adicione à sua lista de desejos com acompanhamento automático?',
    timestamp: Date.now() - 1700000,
    cta: {
      type: 'wishlist_add',
      name: 'iPhone 15 Pro Max 256GB',
      suggestedPrice: 9499,
      rationale: 'Baseado na sua capacidade de economia, é viável em 3-4 meses',
    },
  },
];

// Alertas de orçamento
export const mockBudgetAlerts: BudgetAlert[] = [
  {
    id: 'a1',
    type: 'limit_80',
    title: 'Alimentação próximo do limite',
    message: 'Você já gastou 82% do orçamento de Alimentação este mês (R$ 820 de R$ 1.000)',
    severity: 'warning',
    relatedCategory: Category.FOOD,
    amount: 820,
    threshold: 1000,
    createdAt: Date.now() - 86400000,
    isRead: false,
    isDismissed: false,
  },
  {
    id: 'a2',
    type: 'unusual_spending',
    title: 'Gasto atípico detectado',
    message: 'Seus gastos com Compras este mês (R$ 1.600) estão 180% acima da média dos últimos 3 meses',
    severity: 'info',
    relatedCategory: Category.SHOPPING,
    amount: 1600,
    createdAt: Date.now() - 172800000,
    isRead: true,
    isDismissed: false,
  },
  {
    id: 'a3',
    type: 'overspend_projection',
    title: 'Projeção de gastos',
    message: 'Se continuar nesse ritmo, você pode ultrapassar seu orçamento mensal em R$ 450',
    severity: 'warning',
    amount: 450,
    createdAt: Date.now() - 43200000,
    isRead: false,
    isDismissed: false,
  },
];

// Orçamentos por categoria
export const mockCategoryBudgets: CategoryBudget[] = [
  { category: Category.FOOD, limit: 1000, spent: 820, month: '2024-12' },
  { category: Category.TRANSPORT, limit: 600, spent: 456.78, month: '2024-12' },
  { category: Category.ENTERTAINMENT, limit: 500, spent: 890, month: '2024-12' },
  { category: Category.SHOPPING, limit: 800, spent: 1600, month: '2024-12' },
  { category: Category.SUBSCRIPTIONS, limit: 150, spent: 92.70, month: '2024-12' },
  { category: Category.HEALTH, limit: 300, spent: 99.90, month: '2024-12' },
];

// Função para ativar modo demo
export const enableDemoMode = () => {
  localStorage.setItem('finai_demo_mode', 'true');
  console.log('🎬 Modo Demo ativado! Recarregue a página.');
};

// Função para desativar modo demo
export const disableDemoMode = () => {
  localStorage.removeItem('finai_demo_mode');
  console.log('🔄 Modo Demo desativado! Recarregue a página.');
};

// Verifica se está em modo demo
export const isDemoMode = () => localStorage.getItem('finai_demo_mode') === 'true';
