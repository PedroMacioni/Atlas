import { colors } from '@/theme/colors';

/** Configurações da câmera e thresholds para modo navegação */
export const NAVIGATION_CONFIG = {
  /** Inclinação da câmera em graus (visão 3D) */
  PITCH: 60,
  /** Zoom aproximado para navegação (18-19 é o padrão do Waze) */
  ZOOM: 18.5,
  /** Duração das animações de câmera em ms */
  ANIMATION_MS: 450,
  /**
   * Limites da animação que acompanha a posição.
   *
   * A duração não é fixa: ela acompanha o intervalo real entre duas leituras,
   * para que a câmera esteja chegando ao ponto quando o próximo chega. Fixá-la
   * em 450 ms deixa a câmera parada entre uma leitura do GPS e a seguinte — o
   * movimento aos trancos que se vê em vez do deslizar contínuo.
   */
  FOLLOW_MIN_MS: 200,
  FOLLOW_MAX_MS: 2_000,
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
  /**
   * Trecho até a parada aceita.
   *
   * O mesmo laranja do pino da parada: o olho liga as duas coisas sem
   * legenda, e fica claro que aquele pedaço de rota existe por causa dela —
   * dali em diante o trajeto volta ao azul do destino.
   */
  detour: colors.categoryFood,
} as const;
