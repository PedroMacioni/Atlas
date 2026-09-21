import { colors } from '@/theme/colors';

/** Configurações da câmera e thresholds para modo navegação */
export const NAVIGATION_CONFIG = {
  /** Inclinação da câmera em graus (visão 3D) */
  PITCH: 60,
  /** Zoom aproximado para navegação (18-19 é o padrão do Waze) */
  ZOOM: 18.5,
  /** Duração das animações de câmera em ms */
  ANIMATION_MS: 450,
  /** Distância em metros para considerar "fora da rota" */
  OFF_ROUTE_THRESHOLD: 50,
  /** Distância em metros para considerar "chegou ao destino" */
  ARRIVED_THRESHOLD: 30,
  /** Movimento mínimo em metros para calcular heading */
  MIN_MOVEMENT_FOR_HEADING: 5,
  /**
   * Distância em metros que a câmera fica "à frente" do usuário.
   * Isso cria o efeito de terceira pessoa, com o usuário na parte
   * inferior da tela e a estrada visível à frente.
   */
  CAMERA_AHEAD_OFFSET: 80,
} as const;

/** Cores das polylines de rota progressiva */
export const ROUTE_COLORS = {
  /** Trecho já percorrido - mais transparente (RGBA) */
  completed: `${colors.primary}4D`, // 30% opacity
  /** Trecho pendente - vibrante */
  pending: colors.primary,
} as const;
