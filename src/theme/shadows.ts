import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevação. O design usa sombras muito suaves e difusas — o objetivo é
 * separar camadas, não criar profundidade dramática.
 */
function elevation(opacity: number, radius: number, offsetY: number, android: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F1F3D',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation: android },
    default: {},
  });
}

export const shadows = {
  /** Cards e superfícies em repouso. */
  card: elevation(0.06, 18, 6, 2),
  /** Botões primários e elementos flutuantes sobre o mapa. */
  raised: elevation(0.18, 14, 6, 6),
} as const;
