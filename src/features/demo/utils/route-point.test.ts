import { describe, expect, it } from 'vitest';

import { pointAlongRoute } from '@/features/demo/utils/route-point';
import { buildCumulativeDistances, distanceBetween } from '@/utils/geo';

/**
 * Uma reta de três vértices subindo em latitude — trecho curto o bastante
 * para a distância entre vértices ser da ordem de centenas de metros, como a
 * geometria de uma rota de verdade.
 */
const ROUTE = [
  { latitude: -22.9, longitude: -47.06 },
  { latitude: -22.895, longitude: -47.06 },
  { latitude: -22.89, longitude: -47.06 },
];

const CUMULATIVE = buildCumulativeDistances(ROUTE);
const TOTAL = CUMULATIVE[CUMULATIVE.length - 1];

describe('pointAlongRoute', () => {
  it('devolve o início da rota no metro zero', () => {
    const point = pointAlongRoute(ROUTE, CUMULATIVE, 0);

    expect(point?.coordinate).toEqual(ROUTE[0]);
    expect(point?.traveledMeters).toBe(0);
  });

  it('interpola dentro do segmento, e não salta de vértice em vértice', () => {
    const quarter = pointAlongRoute(ROUTE, CUMULATIVE, TOTAL / 4);

    expect(quarter).not.toBeNull();
    // A um quarto do caminho o ponto está entre os dois primeiros vértices.
    expect(quarter!.coordinate.latitude).toBeGreaterThan(ROUTE[0].latitude);
    expect(quarter!.coordinate.latitude).toBeLessThan(ROUTE[1].latitude);
    expect(distanceBetween(ROUTE[0], quarter!.coordinate)).toBeCloseTo(TOTAL / 4, 0);
  });

  it('aponta para o norte numa rota que sobe em latitude', () => {
    const middle = pointAlongRoute(ROUTE, CUMULATIVE, TOTAL / 2);

    expect(middle?.heading).toBeCloseTo(0, 1);
  });

  it('nunca passa do fim da rota', () => {
    const beyond = pointAlongRoute(ROUTE, CUMULATIVE, TOTAL * 10);

    expect(beyond?.coordinate).toEqual(ROUTE[ROUTE.length - 1]);
    expect(beyond?.traveledMeters).toBeCloseTo(TOTAL, 5);
  });

  it('não inventa ponto sem geometria', () => {
    expect(pointAlongRoute([], [], 100)).toBeNull();
  });
});
