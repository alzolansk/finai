// Dados mockados para demonstração - baseados em estrutura real mas com valores fictícios
import { Transaction, TransactionType, Category, WishlistItem, WishlistItemType, WishlistPriority, UserSettings } from '../types';

export const DEMO_SETTINGS: UserSettings = {
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

export const DEMO_TRANSACTIONS: Transaction[] = [
  // Dezembro 2024 - Receitas
  { id: '1', description: 'Salário', amount: 8500, date: '2024-12-05', paymentDate: '2024-12-05', category: Category.SALARY, type: TransactionType.INCOME, isRecurring: true, createdAt: 1733443200000 },
  { id: '2', description: '13º Salário', amount: 8500, date: '2024-12-20', paymentDate: '2024-12-20', category: Category.SALARY, type: TransactionType.INCOME, createdAt: 1734739200000 },
  { id: '3', description: 'Freelance - Design de Logo', amount: 1200, date: '2024-12-15', paymentDate: '2024-12-15', category: Category.SALARY, type: TransactionType.INCOME, createdAt: 1734220800000 },
  
  // Moradia
  { id: '4', description: 'Aluguel Apartamento', amount: 1800, date: '2024-12-10', paymentDate: '2024-12-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733875200000 },
  { id: '5', description: 'Condomínio', amount: 450, date: '2024-12-10', paymentDate: '2024-12-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733875200000 },
  
  // Contas
  { id: '6', description: 'Conta de Luz - Enel', amount: 234.67, date: '2024-12-15', paymentDate: '2024-12-15', category: Category.UTILITIES, type: TransactionType.EXPENSE, createdAt: 1734220800000 },
  { id: '7', description: 'Internet Vivo Fibra', amount: 119.99, date: '2024-12-08', paymentDate: '2024-12-08', category: Category.UTILITIES, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733702400000 },
  { id: '8', description: 'Conta de Água - Sabesp', amount: 87.45, date: '2024-12-12', paymentDate: '2024-12-12', category: Category.UTILITIES, type: TransactionType.EXPENSE, createdAt: 1734048000000 },
  
  // Alimentação
  { id: '9', description: 'Supermercado Extra', amount: 687.90, date: '2024-12-22', paymentDate: '2024-12-22', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: 1734912000000 },
  { id: '10', description: 'iFood - Jantar', amount: 67.90, date: '2024-12-18', paymentDate: '2024-12-18', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: 1734566400000 },
  { id: '11', description: 'Padaria Dona Maria', amount: 45.80, date: '2024-12-20', paymentDate: '2024-12-20', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: 1734739200000 },
  { id: '12', description: 'Restaurante Outback', amount: 187.50, date: '2024-12-23', paymentDate: '2024-12-23', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: 1734998400000 },
  
  // Transporte
  { id: '13', description: 'Uber - Trabalho', amount: 34.50, date: '2024-12-22', paymentDate: '2024-12-22', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: 1734912000000 },
  { id: '14', description: 'Gasolina Shell', amount: 250, date: '2024-12-14', paymentDate: '2024-12-14', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: 1734134400000 },
  { id: '15', description: 'IPVA 2025 - Cota 1', amount: 456.78, date: '2024-12-30', paymentDate: '2024-12-30', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: 1735603200000 },
  { id: '16', description: '99 - Centro', amount: 28.90, date: '2024-12-19', paymentDate: '2024-12-19', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: 1734652800000 },
  
  // Assinaturas
  { id: '17', description: 'Spotify Premium', amount: 21.90, date: '2024-12-01', paymentDate: '2024-12-01', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733011200000 },
  { id: '18', description: 'Netflix', amount: 55.90, date: '2024-12-01', paymentDate: '2024-12-01', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733011200000 },
  { id: '19', description: 'Amazon Prime', amount: 14.90, date: '2024-12-01', paymentDate: '2024-12-01', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733011200000 },
  { id: '20', description: 'ChatGPT Plus', amount: 97, date: '2024-12-05', paymentDate: '2024-12-05', category: Category.SUBSCRIPTIONS, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733443200000 },
  
  // Lazer
  { id: '21', description: 'Cinema - Gladiador 2', amount: 89.00, date: '2024-12-24', paymentDate: '2024-12-24', category: Category.ENTERTAINMENT, type: TransactionType.EXPENSE, createdAt: 1735084800000 },
  { id: '22', description: 'Viagem Réveillon - Hotel', amount: 890, date: '2024-12-28', paymentDate: '2024-12-28', category: Category.ENTERTAINMENT, type: TransactionType.EXPENSE, createdAt: 1735430400000 },
  { id: '23', description: 'Show Rock in Rio', amount: 450, date: '2024-12-15', paymentDate: '2024-12-15', category: Category.ENTERTAINMENT, type: TransactionType.EXPENSE, createdAt: 1734220800000 },
  
  // Saúde
  { id: '24', description: 'Smart Fit', amount: 99.90, date: '2024-12-05', paymentDate: '2024-12-05', category: Category.HEALTH, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733443200000 },
  { id: '25', description: 'Farmácia - Vitaminas', amount: 156.00, date: '2024-12-16', paymentDate: '2024-12-16', category: Category.HEALTH, type: TransactionType.EXPENSE, createdAt: 1734307200000 },
  { id: '26', description: 'Consulta Dentista', amount: 280, date: '2024-12-11', paymentDate: '2024-12-11', category: Category.HEALTH, type: TransactionType.EXPENSE, createdAt: 1733961600000 },
  
  // Compras
  { id: '27', description: 'Presentes de Natal', amount: 1250, date: '2024-12-18', paymentDate: '2024-12-18', category: Category.SHOPPING, type: TransactionType.EXPENSE, createdAt: 1734566400000 },
  { id: '28', description: 'Roupas - Zara', amount: 350, date: '2024-12-25', paymentDate: '2024-12-25', category: Category.SHOPPING, type: TransactionType.EXPENSE, createdAt: 1735171200000 },
  { id: '29', description: 'Presente Aniversário Mãe', amount: 350, date: '2024-12-25', paymentDate: '2024-12-25', category: Category.SHOPPING, type: TransactionType.EXPENSE, createdAt: 1735171200000 },
  
  // Educação
  { id: '30', description: 'Curso Udemy - React Avançado', amount: 27.90, date: '2024-12-10', paymentDate: '2024-12-10', category: Category.EDUCATION, type: TransactionType.EXPENSE, createdAt: 1733875200000 },
  { id: '31', description: 'Alura - Assinatura', amount: 109, date: '2024-12-02', paymentDate: '2024-12-02', category: Category.EDUCATION, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1733097600000 },
  
  // Investimentos
  { id: '32', description: 'Investimento CDB Nubank', amount: 2000, date: '2024-12-21', paymentDate: '2024-12-21', category: Category.SAVINGS, type: TransactionType.EXPENSE, createdAt: 1734825600000 },
  { id: '33', description: 'Tesouro Direto', amount: 500, date: '2024-12-06', paymentDate: '2024-12-06', category: Category.SAVINGS, type: TransactionType.EXPENSE, createdAt: 1733529600000 },
  
  // Novembro 2024
  { id: '34', description: 'Salário', amount: 8500, date: '2024-11-05', paymentDate: '2024-11-05', category: Category.SALARY, type: TransactionType.INCOME, isRecurring: true, createdAt: 1730764800000 },
  { id: '35', description: 'Aluguel Apartamento', amount: 1800, date: '2024-11-10', paymentDate: '2024-11-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1731196800000 },
  { id: '36', description: 'Condomínio', amount: 450, date: '2024-11-10', paymentDate: '2024-11-10', category: Category.HOUSING, type: TransactionType.EXPENSE, isRecurring: true, createdAt: 1731196800000 },
  { id: '37', description: 'Conta de Luz - Enel', amount: 187.45, date: '2024-11-15', paymentDate: '2024-11-15', category: Category.UTILITIES, type: TransactionType.EXPENSE, createdAt: 1731628800000 },
  { id: '38', description: 'Supermercado Extra', amount: 423.87, date: '2024-11-20', paymentDate: '2024-11-20', category: Category.FOOD, type: TransactionType.EXPENSE, createdAt: 1732060800000 },
  { id: '39', description: 'Gasolina Shell', amount: 250, date: '2024-11-14', paymentDate: '2024-11-14', category: Category.TRANSPORT, type: TransactionType.EXPENSE, createdAt: 1731542400000 },
  { id: '40', description: 'Investimento Nubank', amount: 500, date: '2024-11-06', paymentDate: '2024-11-06', category: Category.SAVINGS, type: TransactionType.EXPENSE, createdAt: 1730851200000 },
];

export const DEMO_WISHLIST: WishlistItem[] = [
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
