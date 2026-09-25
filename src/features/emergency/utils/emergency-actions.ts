import { Linking, Platform } from 'react-native';

import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Ações de emergência (escopo §11).
 *
 * O Atlas não substitui os serviços oficiais, só encurta o caminho. SAMU e
 * Polícia abrem o discador com o número; "Hospital" abre o app de mapas do
 * celular buscando hospitais (reserva para quando a lista da API não carrega).
 */

export type EmergencyAction = 'hospital' | 'samu' | 'policia';

export const EMERGENCY_NUMBERS = {
  samu: '192',
  policia: '190',
} as const;

/** Texto gravado no diário de bordo quando a ação é usada. */
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
 * Executa a ação. Devolve `false` se o celular não conseguiu abrir (ex.:
 * tablet sem telefone), para a tela mostrar o número escrito.
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
