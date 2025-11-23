import { Transaction, TransactionType, Category, UserSettings } from '../types';
import { SavingsReview, RecommendationStatus } from './storageService';

export interface SavingsItem {
  id: string;
  title: string;
  amount: number;
  type: 'subscription' | 'duplicate' | 'fee' | 'expensive_category';
  description: string;
  status?: RecommendationStatus;
  originalAmount?: number;
}

export interface PotentialSavingsResult {
  totalPotential: number;
  items: SavingsItem[];
}

export const calculatePotentialSavings = (transactions: Transaction[], reviews: SavingsReview[] = []): PotentialSavingsResult => {
  const items: SavingsItem[] = [];
  const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);

  // Helper to check review status
  const getReview = (id: string) => reviews.find(r => r.id === id);

  // 1. Detect Duplicates (Same description and amount within 3 days)
  const sortedByDate = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  for (let i = 0; i < sortedByDate.length - 1; i++) {
    const current = sortedByDate[i];
    const next = sortedByDate[i + 1];
    
    const daysDiff = (new Date(next.date).getTime() - new Date(current.date).getTime()) / (1000 * 3600 * 24);
    
    if (daysDiff <= 3 && current.description === next.description && current.amount === next.amount) {
      // Ignore small duplicates
      // 1. General threshold to avoid noise
      if (current.amount < 10) continue;

      // 2. Higher threshold for Food/Transport where repeats are common (lunch, bus)
      if ((current.category === Category.FOOD || current.category === Category.TRANSPORT) && current.amount < 30) {
        continue;
      }

      const id = `dup-${current.id}`;
      const review = getReview(id);
      
      // Skip if dismissed or kept
      if (review?.status === 'dismissed' || review?.status === 'kept') continue;

      const amount = review?.status === 'adjusted' && review.adjustedAmount ? review.adjustedAmount : current.amount;

      items.push({
        id,
        title: 'Possível Duplicidade',
        amount,
        originalAmount: current.amount,
        type: 'duplicate',
        description: `${current.description} aparece duas vezes.`,
        status: review?.status || 'pending'
      });
    }
  }

  // 2. Detect Subscriptions (Category 'Assinaturas' or isRecurring)
  const subscriptions = expenses.filter(t => t.category === Category.SUBSCRIPTIONS || t.isRecurring);
  subscriptions.forEach(sub => {
    const id = `sub-${sub.id}`;
    const review = getReview(id);

    if (review?.status === 'dismissed' || review?.status === 'kept') return;

    const amount = review?.status === 'adjusted' && review.adjustedAmount ? review.adjustedAmount : sub.amount;

    items.push({
      id,
      title: 'Assinatura Recorrente',
      amount,
      originalAmount: sub.amount,
      type: 'subscription',
      description: `Revisar assinatura de ${sub.description}`,
      status: review?.status || 'pending'
    });
  });

  // 3. Detect Fees (Keywords like 'Tarifa', 'Anuidade', 'Juros')
  const fees = expenses.filter(t => {
    const desc = t.description.toLowerCase();
    return desc.includes('tarifa') || desc.includes('anuidade') || desc.includes('juros') || desc.includes('multa');
  });
  
  fees.forEach(fee => {
    const id = `fee-${fee.id}`;
    const review = getReview(id);

    if (review?.status === 'dismissed' || review?.status === 'kept') return;

    const amount = review?.status === 'adjusted' && review.adjustedAmount ? review.adjustedAmount : fee.amount;

    items.push({
      id,
      title: 'Tarifa Bancária/Juros',
      amount,
      originalAmount: fee.amount,
      type: 'fee',
      description: `Evite gastos com ${fee.description}`,
      status: review?.status || 'pending'
    });
  });

  // Deduplicate items (in case a subscription is also a duplicate, etc. though unlikely with current logic)
  // Also, we might have too many items. Let's prioritize.
  
  // Calculate total
  const totalPotential = items.reduce((sum, item) => sum + item.amount, 0);

  // Sort by amount desc
  items.sort((a, b) => b.amount - a.amount);

  return {
    totalPotential,
    items
  };
};

export interface SavingsPlanAction {
  id: string;
  title: string;
  description: string;
  impact: number;
  category: 'high' | 'medium' | 'low';
  status: RecommendationStatus;
  justification?: string;
  originalAmount?: number;
}

export interface SavingsPlan {
  executiveSummary: {
    minSavings: number;
    maxSavings: number;
    confirmedSavings: number;
    monthlyGoal: number;
    forecast: string;
    summaryText: string;
  };
  smartDiagnosis: string;
  monthlyStrategy: {
    adjustments: string;
    alerts: string;
    forecasts: string;
  };
  steps: {
    highImpact: SavingsPlanAction[];
    mediumImpact: SavingsPlanAction[];
    lowImpact: SavingsPlanAction[];
  };
  weeklyProgress: string;
}

export const generateSavingsPlan = (transactions: Transaction[], settings: UserSettings | null, reviews: SavingsReview[] = []): SavingsPlan => {
  // We need ALL items for the plan, even dismissed ones, to show them in the list (maybe?)
  // The prompt says: "A transação continua igual, mas essa sugestão não deve aparecer mais no plano atual." for dismissed.
  // "Se “Dispensar”: mostrar Dispensado e remover esse item das economias do mês."
  // "Itens revisados aparecem de forma diferente na lista, refletindo o que o usuário decidiu."
  
  // So calculatePotentialSavings filters them out from the TOTAL, but we might want to retrieve them to show in the list as "Dismissed".
  // Let's modify calculatePotentialSavings to return ALL items but with status, and handle the total calculation separately?
  // Or just call it twice? Or modify it to include dismissed items in the list but not in the total.
  
  // Let's stick to the prompt: "Ignorar recomendações com status dispensado ou mantido... não deve contar como economia potencial".
  // But for the LIST, we want to show them.
  
  // I'll manually fetch all potential items first (ignoring reviews for the list generation) and then apply reviews.
  const rawPotential = calculatePotentialSavings(transactions, []); // Get everything raw
  
  // Apply reviews to items
  const itemsWithStatus = rawPotential.items.map(item => {
      const review = reviews.find(r => r.id === item.id);
      if (review) {
          return {
              ...item,
              status: review.status,
              amount: review.status === 'adjusted' && review.adjustedAmount ? review.adjustedAmount : item.amount,
              originalAmount: item.amount,
              justification: review.justification
          };
      }
      return { ...item, status: 'pending' as RecommendationStatus };
  });

  // Calculate total potential (only pending or adjusted)
  const totalPotential = itemsWithStatus
    .filter(i => i.status === 'pending' || i.status === 'adjusted')
    .reduce((sum, i) => sum + i.amount, 0);
  
  // 1. Executive Summary
  const minSavings = itemsWithStatus
    .filter(i => (i.type === 'duplicate' || i.type === 'fee') && (i.status === 'pending' || i.status === 'adjusted'))
    .reduce((sum, i) => sum + i.amount, 0);
    
  const maxSavings = totalPotential;
  const monthlyGoal = settings?.savingsGoal || 0;
  const confirmedSavings = itemsWithStatus.filter(i => i.status === 'kept' || i.status === 'dismissed').length; // Just a count for now, or maybe sum of kept? No, kept means "I spent it".
  // "Economia confirmada até agora" -> Maybe items that were "adjusted" down? Or items that were "dismissed" (meaning I won't save)?
  // Actually, "Economia confirmada" usually means "I took action to save this".
  // If I "Dismiss", I am NOT saving. If I "Keep", I am NOT saving.
  // If I "Adjust", I might be saving the difference?
  // Let's leave confirmedSavings as 0 for now or implement logic later.
  
  const summaryText = `Com base nos seus padrões de gastos, você tem potencial de economizar entre R$ ${minSavings.toLocaleString('pt-BR')} e R$ ${maxSavings.toLocaleString('pt-BR')} neste mês. Para atingir sua meta de guardar R$ ${monthlyGoal.toLocaleString('pt-BR')}, sugerimos o plano abaixo.`;

  // 2. Smart Diagnosis
  // Find top expense category
  const expensesByCategory: Record<string, number> = {};
  transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .forEach(t => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    });
    
  const topCategory = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0];
  const topCategoryName = topCategory ? topCategory[0] : 'Geral';
  
  const diagnosisText = `Identificamos que a categoria **${topCategoryName}** representa sua maior saída de recursos. Além disso, detectamos **${itemsWithStatus.filter(i => i.type === 'subscription').length} assinaturas** que podem estar subutilizadas e **${itemsWithStatus.filter(i => i.type === 'fee').length} taxas** evitáveis.`;

  // 3. Monthly Strategy
  const strategy = {
    adjustments: `Reduzir gastos em **${topCategoryName}** em 15% e cancelar assinaturas não essenciais.`,
    alerts: `Ativar alertas de consumo para **${topCategoryName}** e monitorar gastos noturnos.`,
    forecasts: `Se nada mudar, você pode exceder seu orçamento em R$ ${(maxSavings * 0.5).toLocaleString('pt-BR')} até o dia 25.`
  };

  // 4. Steps (Checklist)
  const highImpact: SavingsPlanAction[] = [];
  const mediumImpact: SavingsPlanAction[] = [];
  const lowImpact: SavingsPlanAction[] = [];

  itemsWithStatus.forEach(item => {
    const action: SavingsPlanAction = {
        id: item.id,
        title: item.title,
        description: item.description,
        impact: item.amount,
        category: 'low',
        status: item.status || 'pending',
        justification: (item as any).justification,
        originalAmount: item.originalAmount
    };

    if (item.amount > 100) {
        action.category = 'high';
        highImpact.push(action);
    } else if (item.amount > 30) {
        action.category = 'medium';
        mediumImpact.push(action);
    } else {
        action.category = 'low';
        lowImpact.push(action);
    }
  });

  // Add generic actions if lists are empty
  if (highImpact.length === 0 && mediumImpact.length === 0 && lowImpact.length === 0) {
      highImpact.push({
          id: 'gen-1',
          title: 'Renegociar Aluguel/Internet',
          description: 'Tente obter um desconto de 10% em contas fixas.',
          impact: 150,
          category: 'high',
          status: 'pending'
      });
  }

  return {
    executiveSummary: {
        minSavings,
        maxSavings,
        confirmedSavings: 0, 
        monthlyGoal,
        forecast: 'Estável',
        summaryText
    },
    smartDiagnosis: diagnosisText,
    monthlyStrategy: strategy,
    steps: {
        highImpact,
        mediumImpact,
        lowImpact
    },
    weeklyProgress: 'Você está na Semana 1. Nenhuma economia confirmada ainda.'
  };
};
