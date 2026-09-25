import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import {
  consumeDetour,
  usePendingDetour,
  type DetourRequest,
} from '@/features/trip/state/detour-request';
import { distanceBetween } from '@/utils/geo';

/**
 * A que distância a parada conta como alcançada. Maior que o raio de chegada
 * ao destino (40 m), porque posto e hospital ocupam área e o ponto do lugar
 * costuma ficar no meio do terreno.
 */
const REACHED_METERS = 80;

type DetourState = {
  detour: DetourRequest | null;
  /**
   * De onde a rota parte enquanto há desvio: a posição no momento em que ele foi
   * aceito (recalcular a partir da origem mandaria o motorista voltar).
   */
  routeOrigin: NamedCoordinate | null;
  /** Pedido vindo da emergência já usado, para não usar duas vezes. */
  adopted: DetourRequest | null;
  /** A parada acabou de ser alcançada (o efeito registra no diário). */
  reached: DetourRequest | null;
};

const INITIAL: DetourState = { detour: null, routeOrigin: null, adopted: null, reached: null };

const NO_WAYPOINTS: Coordinate[] = [];

export type DetourControl = {
  detour: DetourRequest | null;
  reached: DetourRequest | null;
  /** Origem da rota a usar no lugar da origem da viagem, ou `null`. */
  routeOrigin: NamedCoordinate | null;
  /** Paradas para a rota — estável entre renderizações. */
  waypoints: Coordinate[];
  start: (detour: DetourRequest) => void;
  cancel: () => void;
};

/**
 * Uma parada no meio do caminho (RF-19, CA-10).
 *
 * Pode vir de uma recomendação aceita (o usuário escolhe um dos 3 lugares) ou
 * de um hospital escolhido na emergência (via `detour-request`). Nos dois
 * casos o destino continua o mesmo; a rota só passa pela parada antes.
 *
 * A menos de 80 m da parada ela é dada como feita: `onReached` registra no
 * diário e a rota volta a ir direto ao destino.
 */
export function useDetour(
  position: Coordinate | null,
  onReached: (detour: DetourRequest) => void,
): DetourControl {
  const [state, setState] = useState<DetourState>(INITIAL);
  const pending = usePendingDetour();

  const here: NamedCoordinate | null = position ? { ...position, name: 'Sua localização' } : null;

  // Pedido vindo da emergência: adotado durante a renderização. Limpá-lo fica no efeito abaixo.
  if (pending && pending !== state.adopted) {
    setState({ ...state, detour: pending, routeOrigin: here, adopted: pending });
  }

  // Chegou à parada.
  if (
    state.detour &&
    position &&
    distanceBetween(position, state.detour) <= REACHED_METERS
  ) {
    setState({ ...state, detour: null, routeOrigin: here, reached: state.detour });
  }

  useEffect(() => {
    if (pending) {
      consumeDetour();
    }
  }, [pending]);

  const reached = state.reached;

  useEffect(() => {
    if (reached) {
      onReached(reached);
    }
    // Só a chegada importa; `onReached` é lido na hora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached]);

  const start = useCallback(
    (detour: DetourRequest) => {
      setState((current) => ({ ...current, detour, routeOrigin: here, reached: null }));
    },
    // Vale a posição no momento do toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position?.latitude, position?.longitude],
  );

  const cancel = useCallback(() => {
    setState((current) => ({ ...current, detour: null, routeOrigin: here ?? current.routeOrigin }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  const detour = state.detour;
  const waypoints = useMemo(() => (detour ? [detour] : NO_WAYPOINTS), [detour]);

  return { detour, reached: state.reached, routeOrigin: state.routeOrigin, waypoints, start, cancel };
}
