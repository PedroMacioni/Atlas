import type { IconName } from '@/components/ui/icon-badge';
import type {
  Decision,
  Emotion,
  EventKind,
  ImageClass,
} from '@/features/trip-session/types/trip';
import type { ColorToken } from '@/theme/colors';

/**
 * Textos em português do diário de bordo e do resumo.
 *
 * O backend guarda códigos (`cansado`, `registrar_ponto_turistico`); aqui eles
 * viram texto para a tela.
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
    scene: { title: 'Leitura da câmera', icon: 'camera-outline', color: 'textSecondary' },
  };
