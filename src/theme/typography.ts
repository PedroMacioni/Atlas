import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import type { TextStyle } from 'react-native';

/** Fonte do app: Plus Jakarta Sans, carregada em vários pesos. */
export const fontAssets = {
  'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
  'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
  'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
  'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
  'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
} as const;

export const fontFamily = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extrabold: 'PlusJakartaSans-ExtraBold',
} as const;

/** Tamanhos de texto do app. Todo texto usa uma destas variantes. */
export const textVariants = {
  /** Wordmark do cabeçalho. */
  wordmark: {
    fontFamily: fontFamily.extrabold,
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: 3.2,
  },
  /** Número grande de destaque (ex.: horário de chegada na viagem). */
  display: {
    fontFamily: fontFamily.extrabold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
  },
  /** Título de tela. */
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  /** Título de seção dentro de uma tela. */
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  /** Valor destacado de uma métrica. */
  metric: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  /** Texto de corpo e títulos de item de lista. */
  body: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  /** Texto corrido secundário. */
  bodySoft: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Rótulo curto acima de um valor. */
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Texto de ação, dentro de botões. */
  action: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
