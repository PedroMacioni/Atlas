/**
 * Paleta única do Atlas, extraída do design de referência.
 * Nenhum valor hexadecimal deve ser escrito fora deste arquivo.
 */
export const colors = {
  /** Fundo geral — quase branco, levemente azulado. */
  background: '#F7F9FC',
  /** Superfícies elevadas: cards e painéis. */
  surface: '#FFFFFF',
  /** Fundo interno de blocos dentro de um card branco. */
  surfaceMuted: '#EEF3FD',

  /** Azul de marca — rota, ações primárias, destaques. */
  primary: '#2C6FF6',
  /** Extremo escuro do gradiente dos botões primários. */
  primaryDeep: '#1D53D4',
  /** Azul suave para fundos de realce e ícones circulares. */
  primarySoft: '#E4EDFE',

  /** Texto principal — azul-marinho muito escuro. */
  text: '#0F1F3D',
  /** Texto de apoio — cinza azulado. */
  textSecondary: '#7A8CA6',
  /** Texto sobre superfícies primárias. */
  textOnPrimary: '#FFFFFF',

  /** Linhas divisórias e contornos discretos. */
  border: '#E5EBF5',

  /** Estado saudável e confirmações. */
  success: '#12B76A',
  /** Fundo do chip de estado saudável. */
  successSoft: '#E4F7EE',
  /** Falhas e estados bloqueantes. */
  danger: '#E2473D',
  /** Extremo escuro do gradiente vermelho, para a ação destrutiva. */
  dangerDeep: '#B62F27',
  /** Fundo do chip de erro. */
  dangerSoft: '#FDECEA',

  /**
   * Cores de categoria. Cada tipo de lugar tem um tom próprio — é o que dá a
   * leitura imediata das fileiras de ícones no design.
   */
  categoryFuel: '#2F80ED',
  categoryFood: '#F2994A',
  categoryLodging: '#9B51E0',
  categoryHealth: '#EB5757',
  categoryNature: '#27AE60',
} as const;

export type ColorToken = keyof typeof colors;

/** Gradiente dos botões e superfícies primárias, do claro para o escuro. */
export const primaryGradient = [colors.primary, colors.primaryDeep] as const;

/**
 * Gradiente da ação destrutiva.
 *
 * Existe para que "Parar" tenha o mesmo peso visual de "Continuar" quando os
 * dois dividem uma linha: um botão chapado claro ao lado de um com gradiente e
 * sombra não se lê como par, se lê como um botão e um aviso.
 */
export const dangerGradient = [colors.danger, colors.dangerDeep] as const;
