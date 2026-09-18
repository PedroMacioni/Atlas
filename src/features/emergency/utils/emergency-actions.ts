import { Linking, Platform } from 'react-native';

import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Ações de emergência (escopo §11).
 *
 * O Atlas não substitui os serviços oficiais: só encurta o caminho até eles.
 * SAMU e Polícia abrem o discador já com o número; Hospital abre o aplicativo
 * de mapas do aparelho buscando hospitais em volta.
 *
 * O Hospital é provisório. O escopo pede **3 hospitais próximos** listados no
 * próprio Atlas, com distância, tempo e nota (RF-24) — isso depende da busca
 * de lugares por proximidade (Google Places), que ainda não existe. Até lá, o
 * mapa do sistema é o caminho mais curto e mais honesto.
 */

export type EmergencyAction = 'hospital' | 'samu' | 'policia';

export const EMERGENCY_NUMBERS = {
  samu: '192',
  policia: '190',
} as const;

/** Rótulo gravado no diário de bordo quando a ação é acionada. */
export const EMERGENCY_LABELS: Record<EmergencyAction, string> = {
  hospital: 'Emergência: Hospital',
  samu: 'Emergência: SAMU 192',
  policia: 'Emergência: Polícia 190',
};

export function hospitalSearchUrl(near: Coordinate | null): string {
  if (Platform.OS === 'ios') {
    const around = near ? `&sll=${near.latitude},${near.longitude}` : '';
    return `maps://?q=hospital${around}`;
  }

  const center = near ? `${near.latitude},${near.longitude}` : '0,0';
  return `geo:${center}?q=hospital`;
}

/**
 * Executa a ação. Devolve `false` se o aparelho não conseguiu abrir — um
 * tablet sem telefonia, por exemplo —, para a tela mostrar o número por
 * escrito em vez de falhar calada.
 */
export async function runEmergencyAction(
  action: EmergencyAction,
  near: Coordinate | null,
): Promise<boolean> {
  const url =
    action === 'hospital' ? hospitalSearchUrl(near) : `tel:${EMERGENCY_NUMBERS[action]}`;

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
