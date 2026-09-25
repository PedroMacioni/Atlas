import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import {
  consumeDetour,
  usePendingDetour,
  type DetourRequest,
} from '@/features/trip/state/detour-request';
import { distanceBetween } from '@/utils/geo';

/**
 * A partir de quantos metros da parada ela conta como alcançada.
 *
 * Maior que o raio de chegada ao destino (40 m): um posto ou um hospital
 * ocupam área, e o ponto do Google fica no meio do terreno, não na entrada.
 */
const REACHED_METERS = 80;

type DetourState = {
  detour: DetourRequest | null;
  /**
   * De onde a rota parte enquanto há desvio — a posição no momento em que ele
   * foi aceito. A origem da viagem ficou para trás; recalcular a partir dela
   * mandaria o motorista voltar.
   */
  routeOrigin: NamedCoordinate | null;
  /** O pedido vindo da emergência já adotado, para não adotá-lo duas vezes. */
  adopted: DetourRequest | null;
  /** A parada acabou de ser alcançada — o efeito registra no diário. */
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
 * Nasce de duas formas: o usuário aceita uma recomendação e escolhe um dos 3
 * locais, ou escolhe um hospital na emergência — que, aberta por cima da
 * viagem, publica o pedido em `detour-request`. Nos dois casos o destino da
 * viagem continua o mesmo; a rota passa pela parada antes.
 *
 * Ao chegar a menos de 80 m da parada, ela é dada como feita: `onReached`
 * registra no diário, e a rota volta a ir direto ao destino, a partir dali.
 */
export function useDetour(
  position: Coordinate | null,
  onReached: (detour: DetourRequest) => void,
): DetourControl {
  const [state, setState] = useState<DetourState>(INITIAL);
  const pending = usePendingDetour();

  const here: NamedCoordinate | null = position ? { ...position, name: 'Sua localização' } : null;

  // Pedido vindo da emergência: adotado durante a renderização, como estado
  // derivado. Limpá-lo do canal é efeito, e fica no efeito abaixo.
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
    // Só a chegada importa; `onReached` é lido no momento dela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached]);

  const start = useCallback(
    (detour: DetourRequest) => {
      setState((current) => ({ ...current, detour, routeOrigin: here, reached: null }));
    },
    // `here` muda a cada leitura; o que vale é a posição no toque.
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
