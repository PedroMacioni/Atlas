import type { IconName } from '@/components/ui/icon-badge';
import type {
  Decision,
  Emotion,
  EventKind,
  ImageClass,
} from '@/features/trip-session/types/trip';
import type { ColorToken } from '@/theme/colors';

/**
 * As palavras do diário de bordo e do resumo, em português.
 *
 * O backend guarda códigos (`cansado`, `registrar_ponto_turistico`); é aqui
 * que eles viram texto de tela. As emoções, classes e decisões são as do
 * escopo (§4), e já estão aqui para quando os modelos passarem a escrevê-las.
 */

export const EMOTION_LABELS: Record<Emotion, string> = {
  cansado: 'Cansado',
  neutro: 'Neutro',
  animado: 'Animado',
  tenso: 'Tenso',
  bravo: 'Bravo',
};

export const IMAGE_CLASS_LABELS: Record<ImageClass, string> = {
  estrada: 'Estrada / Rodovia',
  posto: 'Posto de combustível',
  restaurante: 'Restaurante / Alimentação',
  ponto_turistico: 'Ponto turístico / Natureza',
};

export const DECISION_LABELS: Record<Decision, string> = {
  continuar: 'CONTINUAR',
  descansar: 'DESCANSAR',
  abastecer: 'ABASTECER',
  alimentar: 'ALIMENTAR-SE',
  registrar_ponto_turistico: 'REGISTRAR PONTO TURÍSTICO',
  fazer_parada: 'FAZER UMA PARADA',
};

export const EVENT_VISUALS: Record<EventKind, { title: string; icon: IconName; color: ColorToken }> =
  {
    trip_started: { title: 'Início da viagem', icon: 'flag-outline', color: 'primary' },
    trip_ended: { title: 'Fim da viagem', icon: 'flag-checkered', color: 'primary' },
    stop: { title: 'Parada', icon: 'map-marker-plus', color: 'categoryFood' },
    command: { title: 'Comando', icon: 'microphone', color: 'primary' },
    recommendation: { title: 'Recomendação', icon: 'lightbulb-on-outline', color: 'categoryLodging' },
    tourist_spot: { title: 'Ponto turístico', icon: 'camera', color: 'categoryNature' },
    emergency: { title: 'Emergência', icon: 'alarm-light', color: 'danger' },
  };
