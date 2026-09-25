import { useState } from 'react';

import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import { DEMO_ORIGIN } from '@/features/trip/constants/demo-route';

/**
 * Ponto de partida da viagem: fica fixo na primeira posição conhecida.
 *
 * A origem é diferente da posição atual: a posição muda o tempo todo, mas a
 * origem é uma só. Se a origem seguisse o GPS, a rota seria recalculada a
 * cada leitura.
 *
 * Enquanto a localização carrega, o valor é `null` (e a rota espera). Se o GPS
 * falhar, usa o ponto de partida de demonstração.
 */
export function useTripOrigin(
  position: Coordinate | null,
  isResolving: boolean,
): NamedCoordinate | null {
  const [origin, setOrigin] = useState<NamedCoordinate | null>(null);

  // Decide durante a renderização (e não num efeito) para não perder um ciclo.
  if (origin === null) {
    if (position) {
      setOrigin({ ...position, name: 'Sua localização' });
    } else if (!isResolving) {
      setOrigin(DEMO_ORIGIN);
    }
  }

  return origin;
}
