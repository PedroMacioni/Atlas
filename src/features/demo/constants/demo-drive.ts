import type { NamedCoordinate } from '@/features/map/types/coordinate';
import type { SimulationOverrides } from '@/features/recommendation/types/recommendation';

/**
 * Viagem de demonstração: do Taquaral (Campinas) até a São Paulo Expo.
 *
 * Existe para a apresentação: ninguém vai dirigir 110 km no meio da aula. A
 * rota é real (vem da mesma API); o que é simulado é a posição, que "anda"
 * sobre a rota em vez de vir do GPS. Só vale com `?demo=1` na tela de viagem.
 */

export const DEMO_DRIVE_ORIGIN: NamedCoordinate = {
  latitude: -22.8747,
  longitude: -47.0535,
  name: 'Parque Taquaral, Campinas',
};

export const DEMO_DRIVE_DESTINATION: NamedCoordinate = {
  latitude: -23.6456839,
  longitude: -46.6293883,
  name: 'São Paulo Expo',
};

/** Nome da parada usada no modo apresentação. */
export const PRESENTATION_STOP_NAME = 'Graal Jaguariúna';

/** Onde o carro aparece quando a tela abre: na metade do caminho. */
export const DEMO_START_FRACTION = 0.5;

/** Velocidade da simulação: 27,8 m/s = 100 km/h. */
export const DEMO_SPEED_METERS_PER_SECOND = 27.8;

/**
 * Frequência do avanço: 10 passos por segundo, de ~3 m cada. Um passo por
 * segundo faria o carro "pular" 28 m no mapa.
 *
 * Obs.: o trajeto percorrido só guarda um ponto novo a cada 8 m (para ignorar
 * a oscilação do GPS), então vários passos pequenos se somam antes de contar.
 */
export const DEMO_TICK_MS = 100;

/**
 * Condições iniciais que o modelo vê no modo demonstração: uma hora de
 * estrada, sem parar, com cansaço na voz. Dá para mudar na tela de condições.
 */
export const DEMO_SCENARIO: Required<Omit<SimulationOverrides, 'emotionConfidence'>> = {
  hour: 15,
  tripMinutes: 60,
  distanceKm: 55,
  minutesSinceStop: 60,
  emotion: 'cansado',
  image: 'estrada',
};
