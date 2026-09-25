export type HapticStyle = 'light' | 'medium' | 'success' | 'none';

export type ActStep =
  | { type: 'wait'; ms: number }
  | { type: 'caption'; text: string | null }
  | { type: 'spotlight'; target: string | null }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'simulate-tap'; target: string }
  | { type: 'tap-effect'; x: number; y: number }
  | { type: 'demo-pause' }
  | { type: 'demo-resume' }
  | { type: 'trigger-recommendation' }
  | { type: 'auto-type'; text: string; field: string }
  | { type: 'navigate'; to: string }
  | { type: 'complete-trip' }
  | { type: 'show-listening'; visible: boolean };

export type Act = {
  id: number;
  name: string;
  duration: number;
  caption: string | null;
  haptic: HapticStyle;
  sequence: ActStep[];
};

export const ACTS: Act[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 1: Introdução — Logo do Atlas
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 1,
    name: 'Introdução',
    duration: 4000,
    caption: null,
    haptic: 'light',
    sequence: [
      { type: 'demo-pause' },
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 4000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 2: Destino — Mostra o destino definido
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 2,
    name: 'Destino Definido',
    duration: 5000,
    caption: 'Destino: São Paulo Expo — 116 km de viagem',
    haptic: 'light',
    sequence: [
      { type: 'caption', text: 'Destino: São Paulo Expo — 116 km de viagem' },
      { type: 'haptic', style: 'light' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 5000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 3: Navegação — Direção em tempo real
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 3,
    name: 'Navegação Ativa',
    duration: 8000,
    caption: 'Navegação 3D em tempo real com instruções de manobra',
    haptic: 'none',
    sequence: [
      { type: 'caption', text: 'Navegação 3D em tempo real com instruções de manobra' },
      { type: 'wait', ms: 8000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 4: IA Recomenda — Random Forest sugere parar
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 4,
    name: 'IA em Ação',
    duration: 12000,
    caption: 'A IA analisou: 4h de viagem, sinais de fadiga — hora de parar',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'trigger-recommendation' },
      { type: 'wait', ms: 1000 },
      { type: 'caption', text: 'A IA analisou: 4h de viagem, sinais de fadiga — hora de parar' },
      { type: 'spotlight', target: 'recommendation-card' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 6000 },
      // Efeito de clique no botão Aceitar
      { type: 'tap-effect', x: 280, y: 420 },
      { type: 'wait', ms: 300 },
      { type: 'simulate-tap', target: 'accept-button' },
      { type: 'haptic', style: 'medium' },
      { type: 'wait', ms: 3000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 5: Escolher Parada — Seleciona onde parar
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 5,
    name: 'Onde Parar',
    duration: 8000,
    caption: 'Escolha entre as opções de parada próximas',
    haptic: 'medium',
    sequence: [
      { type: 'spotlight', target: 'nearby-options' },
      { type: 'caption', text: 'Escolha entre as opções de parada próximas' },
      { type: 'wait', ms: 4000 },
      // Efeito de clique na primeira opção
      { type: 'tap-effect', x: 200, y: 350 },
      { type: 'wait', ms: 300 },
      { type: 'simulate-tap', target: 'place-row-0' },
      { type: 'spotlight', target: null },
      { type: 'haptic', style: 'medium' },
      { type: 'wait', ms: 3000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 6: Desvio — Rota ajustada automaticamente
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 6,
    name: 'Desvio Inteligente',
    duration: 10000,
    caption: 'O Atlas ajusta a rota automaticamente — seu destino final não muda',
    haptic: 'light',
    sequence: [
      { type: 'caption', text: 'O Atlas ajusta a rota automaticamente — seu destino final não muda' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 10000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 7: Chegada na Parada — Feedback visual
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 7,
    name: 'Chegada na Parada',
    duration: 6000,
    caption: 'Você chegou à parada — descanse e recarregue as energias',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'caption', text: 'Você chegou à parada — descanse e recarregue as energias' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 6000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 8: Controle por Voz — Abre menu e ativa escuta
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 8,
    name: 'Interação por Voz',
    duration: 12000,
    caption: 'Controle por voz — mãos no volante, olhos na estrada',
    haptic: 'light',
    sequence: [
      { type: 'caption', text: 'Controle por voz — mãos no volante, olhos na estrada' },
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 2000 },
      // Efeito de clique nos 3 pontinhos
      { type: 'tap-effect', x: 350, y: 300 },
      { type: 'wait', ms: 300 },
      { type: 'navigate', to: '/trip-actions?watching=0' },
      { type: 'wait', ms: 3000 },
      // Efeito de clique na opção de escuta
      { type: 'tap-effect', x: 200, y: 200 },
      { type: 'wait', ms: 300 },
      { type: 'simulate-tap', target: 'toggle-wake' },
      { type: 'wait', ms: 2000 },
      // Mostra o indicador de escuta
      { type: 'show-listening', visible: true },
      { type: 'wait', ms: 3000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 9: Atlas na Escuta — Mostra que está atento
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 9,
    name: 'Atlas na Escuta',
    duration: 6000,
    caption: 'Diga "Atlas" a qualquer momento para pedir ajuda',
    haptic: 'none',
    sequence: [
      { type: 'caption', text: 'Diga "Atlas" a qualquer momento para pedir ajuda' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 6000 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 10: Chegada ao Destino — Fim da viagem
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 10,
    name: 'Chegada ao Destino',
    duration: 8000,
    caption: 'Você chegou ao destino — viagem concluída com segurança',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'show-listening', visible: false },
      { type: 'caption', text: 'Você chegou ao destino — viagem concluída com segurança' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 5000 },
      { type: 'complete-trip' },
      { type: 'wait', ms: 2500 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATO 11: Resumo — Relatório da viagem
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 11,
    name: 'Resumo da Viagem',
    duration: 8000,
    caption: 'Relatório completo da viagem — pronto para compartilhar',
    haptic: 'success',
    sequence: [
      { type: 'caption', text: 'Relatório completo da viagem — pronto para compartilhar' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 8000 },
    ],
  },
];

export function getAct(id: number): Act | undefined {
  return ACTS.find((act) => act.id === id);
}
