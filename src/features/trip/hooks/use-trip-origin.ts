import { useState } from 'react';

import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import { DEMO_ORIGIN } from '@/features/trip/constants/demo-route';

/**
 * Ponto de partida da viagem, fixado na primeira posição conhecida.
 *
 * `origin` e a posição atual são conceitos distintos, e na viagem em andamento
 * isso deixa de ser teoria: a posição muda a cada dez metros — é dela que vive
 * o acompanhamento — enquanto a origem é uma só. Se a origem seguisse o
 * aparelho, a rota seria recalculada a cada leitura do GPS e o trajeto nunca
 * se estabilizaria.
 *
 * Enquanto a localização está sendo resolvida o valor é `null`, e quem calcula
 * a rota espera: melhor esperar do que gastar uma consulta com uma origem
 * provisória e refazê-la um instante depois.
 *
 * Se o GPS falhar ou a permissão for negada, cai no ponto de partida de
 * demonstração — a tela continua funcionando, com a rota visível.
 */
export function useTripOrigin(
  position: Coordinate | null,
  isResolving: boolean,
): NamedCoordinate | null {
  const [origin, setOrigin] = useState<NamedCoordinate | null>(null);

  // Decidir durante a renderização, e não em um efeito, evita um quadro com a
  // origem nula depois de a posição já ser conhecida — que dispararia o
  // cálculo da rota um ciclo mais tarde do que o necessário. É o padrão que o
  // React recomenda para derivar estado de props que mudaram, e o mesmo que
  // `use-trip-route` usa para invalidar a rota anterior.
  if (origin === null) {
    if (position) {
      setOrigin({ ...position, name: 'Sua localização' });
    } else if (!isResolving) {
      setOrigin(DEMO_ORIGIN);
    }
  }

  return origin;
}
