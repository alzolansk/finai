import React from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Coffee, 
  Utensils, 
  Pizza,
  Bus, 
  Car, 
  Fuel,
  Home, 
  Zap, 
  Droplet,
  Wifi,
  Smartphone,
  Tv,
  Music,
  Film,
  Gamepad2,
  Dumbbell,
  Heart,
  Pill,
  Stethoscope,
  GraduationCap,
  BookOpen,
  Briefcase,
  Wallet,
  CreditCard,
  Building2,
  Store,
  Package,
  Gift,
  Shirt,
  Watch,
  Glasses,
  Scissors,
  Sparkles,
  Dog,
  Cat,
  Plane,
  Hotel,
  Ticket,
  Popcorn,
  Wine,
  Beer,
  IceCream,
  Sandwich,
  Apple,
  Salad,
  Soup,
  CookingPot,
  UtensilsCrossed,
  CircleDollarSign,
  TrendingUp,
  Banknote,
  Receipt,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Navigation,
  Percent,
  Tag,
  Barcode
} from 'lucide-react';

export interface IconConfig {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  bgColor: string;
  iconColor: string;
}

const iconMappings: { keywords: string[]; config: IconConfig }[] = [
  // Compras e E-commerce
  {
    keywords: ['mercado livre', 'mercadolivre', 'ml', 'marketplace', 'loja online', 'amazon', 'shopee', 'magalu', 'magazine luiza'],
    config: { icon: ShoppingCart, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600' }
  },
  {
    keywords: ['shopping', 'compras', 'loja', 'varejo', 'renner', 'riachuelo', 'c&a', 'zara', 'h&m'],
    config: { icon: ShoppingBag, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' }
  },
  {
    keywords: ['shein', 'roupa', 'vestuário', 'moda', 'fashion'],
    config: { icon: Shirt, bgColor: 'bg-pink-100', iconColor: 'text-pink-600' }
  },
  {
    keywords: ['presente', 'gift', 'brinde'],
    config: { icon: Gift, bgColor: 'bg-rose-100', iconColor: 'text-rose-600' }
  },
  
  // Alimentação
  {
    keywords: ['ifood', 'rappi', 'uber eats', 'delivery', 'entrega'],
    config: { icon: Utensils, bgColor: 'bg-red-100', iconColor: 'text-red-600' }
  },
  {
    keywords: ['restaurante', 'jantar', 'almoço', 'refeição', 'comida'],
    config: { icon: UtensilsCrossed, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' }
  },
  {
    keywords: ['pizza', 'pizzaria'],
    config: { icon: Pizza, bgColor: 'bg-red-100', iconColor: 'text-red-600' }
  },
  {
    keywords: ['café', 'cafeteria', 'starbucks', 'coffee'],
    config: { icon: Coffee, bgColor: 'bg-amber-100', iconColor: 'text-amber-700' }
  },
  {
    keywords: ['lanche', 'hamburger', 'burguer', 'mcdonalds', 'bobs', 'subway'],
    config: { icon: Sandwich, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-700' }
  },
  {
    keywords: ['sorvete', 'ice cream', 'açai'],
    config: { icon: IceCream, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' }
  },
  {
    keywords: ['bar', 'cerveja', 'beer', 'chopp', 'pub'],
    config: { icon: Beer, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' }
  },
  {
    keywords: ['vinho', 'wine', 'adega'],
    config: { icon: Wine, bgColor: 'bg-purple-100', iconColor: 'text-purple-700' }
  },
  {
    keywords: ['supermercado', 'mercado', 'pão de açúcar', 'carrefour', 'extra'],
    config: { icon: ShoppingCart, bgColor: 'bg-green-100', iconColor: 'text-green-600' }
  },
  
  // Transporte
  {
    keywords: ['uber', 'cabify', '99', 'taxi', 'corrida'],
    config: { icon: Car, bgColor: 'bg-slate-100', iconColor: 'text-slate-700' }
  },
  {
    keywords: ['gasolina', 'combustível', 'posto', 'etanol', 'diesel', 'shell', 'ipiranga'],
    config: { icon: Fuel, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' }
  },
  {
    keywords: ['ônibus', 'metrô', 'metro', 'trem', 'transporte público', 'bilhete único'],
    config: { icon: Bus, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' }
  },
  {
    keywords: ['estacionamento', 'parking', 'zona azul'],
    config: { icon: MapPin, bgColor: 'bg-sky-100', iconColor: 'text-sky-600' }
  },
  
  // Moradia e Utilidades
  {
    keywords: ['aluguel', 'rent', 'condomínio', 'imobiliária'],
    config: { icon: Home, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' }
  },
  {
    keywords: ['luz', 'energia', 'eletricidade', 'cemig', 'enel', 'cpfl'],
    config: { icon: Zap, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600' }
  },
  {
    keywords: ['água', 'saneamento', 'sabesp', 'copasa'],
    config: { icon: Droplet, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' }
  },
  {
    keywords: ['internet', 'wifi', 'banda larga', 'vivo fibra', 'claro', 'oi', 'tim'],
    config: { icon: Wifi, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' }
  },
  {
    keywords: ['celular', 'telefone', 'mobile', 'recarga'],
    config: { icon: Smartphone, bgColor: 'bg-violet-100', iconColor: 'text-violet-600' }
  },
  
  // Entretenimento
  {
    keywords: ['netflix', 'streaming', 'prime video', 'disney+', 'hbo', 'star+', 'paramount'],
    config: { icon: Tv, bgColor: 'bg-red-100', iconColor: 'text-red-600' }
  },
  {
    keywords: ['spotify', 'deezer', 'youtube music', 'apple music', 'música'],
    config: { icon: Music, bgColor: 'bg-green-100', iconColor: 'text-green-600' }
  },
  {
    keywords: ['cinema', 'filme', 'ingresso', 'cinemark', 'kinoplex'],
    config: { icon: Film, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' }
  },
  {
    keywords: ['ticketmaster', 'ingresso.com', 'eventim', 'show', 'evento', 'concerto'],
    config: { icon: Ticket, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' }
  },
  {
    keywords: ['game', 'jogo', 'steam', 'playstation', 'xbox', 'nintendo', 'epic games'],
    config: { icon: Gamepad2, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' }
  },
  
  // Saúde e Bem-estar
  {
    keywords: ['farmácia', 'drogaria', 'remédio', 'medicamento', 'drogasil', 'pacheco'],
    config: { icon: Pill, bgColor: 'bg-teal-100', iconColor: 'text-teal-600' }
  },
  {
    keywords: ['médico', 'consulta', 'clínica', 'hospital', 'saúde'],
    config: { icon: Stethoscope, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-700' }
  },
  {
    keywords: ['academia', 'gym', 'smartfit', 'fitness', 'personal'],
    config: { icon: Dumbbell, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' }
  },
  {
    keywords: ['pet', 'veterinário', 'ração', 'petshop'],
    config: { icon: Dog, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' }
  },
  {
    keywords: ['salão', 'cabelo', 'beleza', 'manicure', 'spa'],
    config: { icon: Sparkles, bgColor: 'bg-pink-100', iconColor: 'text-pink-600' }
  },
  {
    keywords: ['barbeiro', 'barbearia', 'corte'],
    config: { icon: Scissors, bgColor: 'bg-slate-100', iconColor: 'text-slate-600' }
  },
  
  // Educação
  {
    keywords: ['curso', 'faculdade', 'universidade', 'mensalidade', 'escola'],
    config: { icon: GraduationCap, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' }
  },
  {
    keywords: ['livro', 'livraria', 'amazon books'],
    config: { icon: BookOpen, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' }
  },
  
  // Finanças e Bancos
  {
    keywords: ['empréstimo', 'financiamento', 'parcela', 'crédito'],
    config: { icon: CircleDollarSign, bgColor: 'bg-green-100', iconColor: 'text-green-700' }
  },
  {
    keywords: ['investimento', 'ação', 'fundo', 'bolsa'],
    config: { icon: TrendingUp, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' }
  },
  {
    keywords: ['salário', 'pagamento', 'receita', 'renda'],
    config: { icon: Banknote, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' }
  },
  {
    keywords: ['nubank', 'inter', 'c6', 'banco', 'bradesco', 'itaú', 'santander', 'caixa'],
    config: { icon: Building2, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' }
  },
  {
    keywords: ['cartão', 'fatura', 'anuidade'],
    config: { icon: CreditCard, bgColor: 'bg-slate-100', iconColor: 'text-slate-600' }
  },
  {
    keywords: ['taxa', 'tarifa', 'juros'],
    config: { icon: Receipt, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' }
  },
  
  // Viagem
  {
    keywords: ['passagem', 'voo', 'avião', 'aéreo', 'gol', 'latam', 'azul'],
    config: { icon: Plane, bgColor: 'bg-sky-100', iconColor: 'text-sky-600' }
  },
  {
    keywords: ['hotel', 'hospedagem', 'airbnb', 'booking'],
    config: { icon: Hotel, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' }
  },
  
  // Outros
  {
    keywords: ['assinatura', 'subscription', 'mensalidade'],
    config: { icon: Calendar, bgColor: 'bg-violet-100', iconColor: 'text-violet-600' }
  },
  {
    keywords: ['seguro', 'insurance'],
    config: { icon: FileText, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' }
  },
  {
    keywords: ['desconto', 'promoção', 'oferta', 'cupom'],
    config: { icon: Percent, bgColor: 'bg-green-100', iconColor: 'text-green-600' }
  }
];

// Fallback icons by category
const categoryIcons: Record<string, IconConfig> = {
  'Alimentação': { icon: Utensils, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
  'Transporte': { icon: Car, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  'Moradia': { icon: Home, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
  'Contas': { icon: Receipt, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' },
  'Lazer': { icon: Film, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  'Saúde': { icon: Heart, bgColor: 'bg-red-100', iconColor: 'text-red-600' },
  'Compras': { icon: ShoppingBag, bgColor: 'bg-pink-100', iconColor: 'text-pink-600' },
  'Assinaturas': { icon: Calendar, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  'Educação': { icon: GraduationCap, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  'Investimentos': { icon: TrendingUp, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  'Salário': { icon: Banknote, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  'Outros': { icon: Wallet, bgColor: 'bg-zinc-100', iconColor: 'text-zinc-600' }
};

export function getIconForTransaction(description: string, category?: string): IconConfig {
  const searchText = description.toLowerCase();
  
  // Try to find matching keywords in description
  for (const mapping of iconMappings) {
    if (mapping.keywords.some(keyword => searchText.includes(keyword))) {
      return mapping.config;
    }
  }
  
  // Fallback to category icon
  if (category && categoryIcons[category]) {
    return categoryIcons[category];
  }
  
  // Final fallback
  return { icon: Wallet, bgColor: 'bg-zinc-100', iconColor: 'text-zinc-500' };
}

// Component for rendering transaction icon
interface TransactionIconProps {
  description: string;
  category?: string;
  size?: number;
  className?: string;
}

export const TransactionIcon: React.FC<TransactionIconProps> = ({ 
  description, 
  category, 
  size = 20,
  className = '' 
}) => {
  const { icon: Icon } = getIconForTransaction(description, category);
  return <Icon size={size} className={className} />;
};
