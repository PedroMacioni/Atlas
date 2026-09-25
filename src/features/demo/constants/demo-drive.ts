import type { NamedCoordinate } from '@/features/map/types/coordinate';
import type { SimulationOverrides } from '@/features/recommendation/types/recommendation';

/**
 * A viagem de demonstração: Taquaral, em Campinas, até a São Paulo Expo.
 *
 * Existe para a apresentação. Ninguém vai dirigir 110 km no meio de um slide,
 * e a tela de viagem só tem o que mostrar — mapa, manobra, tempo restante e,
 * principalmente, a recomendação do Random Forest — quando há um trajeto real
 * em andamento. Aqui o trajeto é real (a rota vem da mesma API), o que é
 * fingido é o aparelho: a posição não vem do GPS, e sim de um ponto que
 * caminha sobre a rota.
 *
 * Nada disto entra no caminho de quem usa o aplicativo de verdade: só vale
 * com `?demo=1` na tela de viagem.
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

/** Nome exibido em todas as etapas da parada criada para a apresentação. */
export const PRESENTATION_STOP_NAME = 'Graal Jaguariúna';

/** Onde o carro aparece quando a tela abre: metade do caminho andado. */
export const DEMO_START_FRACTION = 0.5;

/** Velocidade da simulação, em m/s — 100 km/h, de rodovia. */
export const DEMO_SPEED_METERS_PER_SECOND = 27.8;

/**
 * Cadência do avanço.
 *
 * Dez passos por segundo, de pouco menos de três metros cada. Um passo por
 * segundo faria o carro pular 28 m de cada vez, e é essa distância — não a
 * velocidade — que se vê como tranco no mapa.
 *
 * O passo não pode encolher à vontade: o trajeto percorrido descarta
 * deslocamentos menores que 8 m, porque num GPS parado eles são só oscilação.
 * Com passos menores que isso, a viagem simulada terminaria com distância
 * zero e nenhum caminho no resumo.
 */
export const DEMO_TICK_MS = 100;

/**
 * As condições que o modelo vê quando a recomendação é pedida no modo de
 * demonstração: uma hora de estrada, sem parar, com cansaço na voz.
 *
 * É o ponto de partida — a tela de condições deixa trocar cada variável antes
 * de perguntar ao Random Forest.
 */
export const DEMO_SCENARIO: Required<Omit<SimulationOverrides, 'emotionConfidence'>> = {
  hour: 15,
  tripMinutes: 60,
  distanceKm: 55,
  minutesSinceStop: 60,
  emotion: 'cansado',
  image: 'estrada',
};
