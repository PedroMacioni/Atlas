import { useMemo, useRef } from 'react';
import type { Coordinate } from '../types/coordinate';
import { NAVIGATION_CONFIG } from '../constants/navigation';
import { haversineDistance } from '../utils/geo';
import { findNearestPointOnRoute, calculateDistanceToEnd } from '../utils/route-progress';

export type NavigationProgressState = {
  /** Índice do ponto atual na rota (só avança, nunca regride) */
  progressIndex: number;
  /** Se o usuário está dentro do threshold da rota */
  isOnRoute: boolean;
  /** Se o usuário chegou ao destino */
  hasArrived: boolean;
  /** Distância restante até o destino em metros */
  distanceToDestination: number;
};

/**
 * Calcula o progresso do usuário na rota.
 *
 * O `progressIndex` só avança - nunca regride mesmo que o usuário
 * volte para trás na rota. Isso evita que o trecho "percorrido"
 * pisque ou diminua durante a navegação.
 */
export function useNavigationProgress(
  userLocation: Coordinate | null,
  routeCoordinates: Coordinate[]
): NavigationProgressState {
  const maxProgressRef = useRef(0);

  return useMemo(() => {
    if (routeCoordinates.length === 0) {
      return {
        progressIndex: 0,
        isOnRoute: false,
        hasArrived: false,
        distanceToDestination: 0,
      };
    }

    if (!userLocation) {
      return {
        progressIndex: 0,
        isOnRoute: false,
        hasArrived: false,
        distanceToDestination: calculateDistanceToEnd(routeCoordinates, 0),
      };
    }

    const { index, distance } = findNearestPointOnRoute(userLocation, routeCoordinates);

    // Progresso só avança
    const progressIndex = Math.max(maxProgressRef.current, index);
    maxProgressRef.current = progressIndex;

    // Verifica se chegou ao destino
    const lastPoint = routeCoordinates[routeCoordinates.length - 1];
    const distanceToEnd = haversineDistance(userLocation, lastPoint);
    const hasArrived = distanceToEnd <= NAVIGATION_CONFIG.ARRIVED_THRESHOLD;

    return {
      progressIndex,
      isOnRoute: distance <= NAVIGATION_CONFIG.OFF_ROUTE_THRESHOLD,
      hasArrived,
      distanceToDestination: calculateDistanceToEnd(routeCoordinates, progressIndex),
    };
  }, [userLocation, routeCoordinates]);
}
