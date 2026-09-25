export type HapticStyle = 'light' | 'medium' | 'success' | 'none';

export type ActStep =
  | { type: 'wait'; ms: number }
  | { type: 'wait-for-stop' }
  | { type: 'caption'; text: string | null }
  | { type: 'spotlight'; target: string | null }
  | { type: 'haptic'; style: HapticStyle }
  | { type: 'simulate-tap'; target: string }
  | { type: 'press-element'; target: string | null }
  | { type: 'demo-pause' }
  | { type: 'demo-resume' }
  | { type: 'trigger-recommendation' }
  | { type: 'auto-type'; text: string; field: string }
  | { type: 'navigate'; to: string }
  | { type: 'complete-trip' }
  | { type: 'demo-voice' }
  | { type: 'show-listening'; visible: boolean }
  | { type: 'demo-voice-text'; text: string | null };

export type Act = {
  id: number;
  name: string;
  duration: number;
  caption: string | null;
  haptic: HapticStyle;
  sequence: ActStep[];
};

export const ACTS: Act[] = [
  // ATO 1: Introdução (logo do Atlas)
  {
    id: 1,
    name: 'Introdução',
    duration: 3500,
    caption: null,
    haptic: 'light',
    sequence: [
      { type: 'demo-pause' },
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 3500 },
    ],
  },

  // ATO 2: Destino definido
  {
    id: 2,
    name: 'Destino Definido',
    duration: 4500,
    caption: 'Rumo à São Paulo Expo.',
    haptic: 'light',
    sequence: [
      { type: 'caption', text: 'Rumo à São Paulo Expo.' },
      { type: 'haptic', style: 'light' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 4500 },
    ],
  },

  // ATO 3: Navegação em tempo real
  {
    id: 3,
    name: 'Navegação Ativa',
    duration: 6500,
    caption: 'O mapa acompanha a viagem e mostra a próxima manobra.',
    haptic: 'none',
    sequence: [
      { type: 'caption', text: 'O mapa acompanha a viagem e mostra a próxima manobra.' },
      { type: 'wait', ms: 6500 },
    ],
  },

  // ATO 4: a IA recomenda uma pausa (Random Forest)
  {
    id: 4,
    name: 'IA em Ação',
    duration: 8500,
    caption: 'Sinais de fadiga: o Atlas recomenda uma pausa.',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'trigger-recommendation' },
      { type: 'wait', ms: 800 },
      { type: 'caption', text: 'Sinais de fadiga: o Atlas recomenda uma pausa.' },
      { type: 'spotlight', target: 'recommendation-card' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 5200 },
      // Efeito de pressionar o botão Aceitar
      { type: 'press-element', target: 'accept-button' },
      { type: 'wait', ms: 250 },
      { type: 'simulate-tap', target: 'accept-button' },
      { type: 'press-element', target: null },
      { type: 'haptic', style: 'medium' },
      { type: 'wait', ms: 2000 },
    ],
  },

  // ATO 5: escolher onde parar
  {
    id: 5,
    name: 'Onde Parar',
    duration: 6500,
    caption: 'Escolha uma parada para incluir no trajeto.',
    haptic: 'medium',
    sequence: [
      { type: 'spotlight', target: 'nearby-options' },
      { type: 'caption', text: 'Escolha uma parada para incluir no trajeto.' },
      { type: 'wait', ms: 3200 },
      // Efeito de pressionar a primeira opção
      { type: 'press-element', target: 'place-row-0' },
      { type: 'wait', ms: 250 },
      { type: 'simulate-tap', target: 'place-row-0' },
      { type: 'press-element', target: null },
      { type: 'spotlight', target: null },
      { type: 'haptic', style: 'medium' },
      { type: 'wait', ms: 3000 },
    ],
  },

  // ATO 6: desvio (a rota passa pela parada)
  {
    id: 6,
    name: 'Desvio Inteligente',
    duration: 16000,
    caption: 'Rota ajustada até a parada. O destino continua o mesmo.',
    haptic: 'light',
    sequence: [
      { type: 'caption', text: 'Rota ajustada até a parada. O destino continua o mesmo.' },
      { type: 'demo-resume' },
      { type: 'wait-for-stop' },
    ],
  },

  // ATO 7: chegada na parada
  {
    id: 7,
    name: 'Chegada na Parada',
    duration: 5000,
    caption: null,
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'caption', text: null },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 5000 },
    ],
  },

  // ATO 8: ativar a escuta por voz no menu
  {
    id: 8,
    name: 'Interação por Voz',
    duration: 10000,
    caption: 'Ative a escuta no menu de ações.',
    haptic: 'light',
    sequence: [
      { type: 'caption', text: 'Ative a escuta no menu de ações.' },
      { type: 'haptic', style: 'light' },
      { type: 'wait', ms: 2000 },
      // Pressiona os 3 pontinhos
      { type: 'press-element', target: 'trip-actions-button' },
      { type: 'wait', ms: 300 },
      { type: 'navigate', to: '/trip-actions?watching=0' },
      { type: 'press-element', target: null },
      { type: 'wait', ms: 2000 },
      // Pressiona a opção de escuta
      { type: 'press-element', target: 'toggle-wake-option' },
      { type: 'wait', ms: 300 },
      { type: 'simulate-tap', target: 'toggle-wake' },
      { type: 'press-element', target: null },
      { type: 'wait', ms: 1500 },
      // Mostra o indicador de escuta com destaque
      { type: 'show-listening', visible: true },
      { type: 'haptic', style: 'success' },
      { type: 'caption', text: 'Escuta ativada! Diga "Atlas" para interagir.' },
      { type: 'spotlight', target: 'wake-status-card' },
      { type: 'wait', ms: 3500 },
      { type: 'spotlight', target: null },
    ],
  },

  // ATO 9: exemplo de comando de voz
  {
    id: 9,
    name: 'Atlas na Escuta',
    duration: 12000,
    caption: 'Você pode perguntar ao Atlas durante a viagem.',
    haptic: 'none',
    sequence: [
      { type: 'caption', text: 'Você pode perguntar ao Atlas durante a viagem.' },
      { type: 'demo-resume' },
      { type: 'wait', ms: 2000 },
      // Simula o usuário falando - texto aparece no card de voz
      { type: 'demo-voice-text', text: 'Atlas, quanto falta para chegar?' },
      { type: 'wait', ms: 2500 },
      // Limpa o card de voz e mostra a resposta
      { type: 'demo-voice-text', text: null },
      { type: 'demo-voice' },
      { type: 'wait', ms: 800 },
    ],
  },

  // ATO 10: concluir a viagem e abrir o resumo
  {
    id: 10,
    name: 'Trajeto Final',
    duration: 2000,
    caption: 'Vamos ver o trajeto completo e os registros da viagem.',
    haptic: 'success',
    sequence: [
      { type: 'demo-pause' },
      { type: 'show-listening', visible: false },
      { type: 'caption', text: 'Vamos ver o trajeto completo e os registros da viagem.' },
      { type: 'haptic', style: 'success' },
      { type: 'wait', ms: 2000 },
      { type: 'complete-trip' },
    ],
  },

];

export function getAct(id: number): Act | undefined {
  return ACTS.find((act) => act.id === id);
}
