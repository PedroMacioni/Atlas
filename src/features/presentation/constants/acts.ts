export type HapticStyle = 'light' | 'medium' | 'success' | 'none';

export type ActStep =
  | { type: 'wait'; ms: number }
  | { type: 'caption'; text: string | null }
  | { type: 'spotlight'; target: string | null }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'simulate-tap'; target: string }
  | { type: 'demo-pause' }
  | { type: 'demo-resume' }
  | { type: 'trigger-recommendation' }
  | { type: 'auto-type'; text: string; field: string }
  | { type: 'navigate'; to: string }
  | { type: 'complete-trip' };

export type Act = {
  id: number;
  name: string;
  duration: number;
  caption: string | null;
  haptic: HapticStyle;
  sequence: ActStep[];
};

export const ACTS: Act[] = [
  {
    id: 1,
    name: 'Introdução',
    duration: 5000,
    caption: null,
    haptic: 'light',
    sequence: [
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 5000 },
    ],
  },
  {
    id: 2,
    name: 'Definir Destino',
    duration: 8000,
    caption: 'Busque por voz ou texto — o Atlas encontra qualquer lugar',
    haptic: 'light',
    sequence: [
      { type: 'navigate', to: '/destination' },
      { type: 'wait', ms: 500 },
      { type: 'caption', text: 'Busque por voz ou texto — o Atlas encontra qualquer lugar' },
      { type: 'auto-type', text: 'São Paulo Expo', field: 'search' },
      { type: 'wait', ms: 500 },
      { type: 'spotlight', target: 'search-result-0' },
      { type: 'wait', ms: 1500 },
      { type: 'haptic', style: 'light' },
      { type: 'simulate-tap', target: 'search-result-0' },
      { type: 'wait', ms: 1000 },
    ],
  },
  {
    id: 3,
    name: 'Navegação Ativa',
    duration: 15000,
    caption: 'Navegação 3D em tempo real com instruções de manobra',
    haptic: 'none',
    sequence: [
      { type: 'wait', ms: 1000 },
      { type: 'caption', text: 'Navegação 3D em tempo real com instruções de manobra' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 14000 },
    ],
  },
  {
    id: 4,
    name: 'IA em Ação',
    duration: 10000,
    caption: 'A IA analisou: 4h de viagem, sinais de fadiga — hora de parar',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'trigger-recommendation' },
      { type: 'wait', ms: 500 },
      { type: 'caption', text: 'A IA analisou: 4h de viagem, sinais de fadiga — hora de parar' },
      { type: 'spotlight', target: 'recommendation-card' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 9000 },
    ],
  },
  {
    id: 5,
    name: 'Desvio Inteligente',
    duration: 12000,
    caption: 'O Atlas ajusta a rota automaticamente — seu destino final não muda',
    haptic: 'medium',
    sequence: [
      { type: 'simulate-tap', target: 'accept-button' },
      { type: 'haptic', style: 'medium' },
      { type: 'wait', ms: 500 },
      { type: 'spotlight', target: 'place-row-0' },
      { type: 'caption', text: 'O Atlas ajusta a rota automaticamente — seu destino final não muda' },
      { type: 'wait', ms: 2000 },
      { type: 'simulate-tap', target: 'place-row-0' },
      { type: 'spotlight', target: null },
      { type: 'wait', ms: 1000 },
      { type: 'demo-resume' },
      { type: 'wait', ms: 7000 },
    ],
  },
  {
    id: 6,
    name: 'Interação por Voz',
    duration: 8000,
    caption: 'Controle por voz — mãos no volante, olhos na estrada',
    haptic: 'light',
    sequence: [
      { type: 'demo-pause' },
      { type: 'caption', text: 'Controle por voz — mãos no volante, olhos na estrada' },
      { type: 'spotlight', target: 'voice-indicator' },
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 7500 },
    ],
  },
  {
    id: 7,
    name: 'Resumo da Viagem',
    duration: 10000,
    caption: 'Relatório completo da viagem — pronto para compartilhar',
    haptic: 'success',
    sequence: [
      { type: 'spotlight', target: null },
      { type: 'complete-trip' },
      { type: 'wait', ms: 500 },
      { type: 'caption', text: 'Relatório completo da viagem — pronto para compartilhar' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 9000 },
    ],
  },
];

export function getAct(id: number): Act | undefined {
  return ACTS.find((act) => act.id === id);
}
