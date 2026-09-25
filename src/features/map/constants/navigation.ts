import { colors } from '@/theme/colors';

/** Configurações da câmera no modo navegação (visão 3D). */
export const NAVIGATION_CONFIG = {
  /** Inclinação da câmera em graus (visão 3D) */
  PITCH: 60,
  /** Zoom aproximado para navegação (18-19 é o padrão do Waze) */
  ZOOM: 18.5,
  /** Duração das animações de câmera em ms */
  ANIMATION_MS: 450,
  /**
   * Quantos metros a câmera fica "à frente" do usuário. Assim o carro aparece
   * na parte de baixo da tela e a estrada à frente fica visível.
   */
  CAMERA_AHEAD_OFFSET: 80,
} as const;

/** Cores das polylines de rota progressiva */
export const ROUTE_COLORS = {
  /** Trecho já percorrido - mais transparente (RGBA) */
  completed: `${colors.primary}4D`, // 30% opacity
  /** Trecho pendente - vibrante */
  pending: colors.primary,
  /**
   * Trecho até a parada aceita, na mesma cor laranja do pino da parada.
   * Depois da parada a rota volta a ser azul.
   */
  detour: colors.categoryFood,
} as const;
