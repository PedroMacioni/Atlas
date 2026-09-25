import { describe, expect, it } from 'vitest';

import {
  buildRouteGeometry,
  computeTripProgress,
} from '@/features/trip/utils/trip-progress';
import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Uma reta de oeste para leste em Campinas, com 4 pontos. Coordenadas reais:
 * a distância entre graus depende da latitude.
 */
const ROUTE: Coordinate[] = [
  { latitude: -22.9, longitude: -47.1 },
  { latitude: -22.9, longitude: -47.08 },
  { latitude: -22.9, longitude: -47.06 },
  { latitude: -22.9, longitude: -47.04 },
];

const GEOMETRY = buildRouteGeometry(ROUTE);
const TOTAL_SECONDS = 600;

function progressAt(position: Coordinate, fromIndex = 0) {
  return computeTripProgress({
    geometry: GEOMETRY,
    totalDurationSeconds: TOTAL_SECONDS,
    position,
    fromIndex,
  });
}

describe('buildRouteGeometry', () => {
  it('soma a distância acumulada ponto a ponto', () => {
    expect(GEOMETRY.cumulative[0]).toBe(0);
    expect(GEOMETRY.cumulative.at(-1)).toBeCloseTo(GEOMETRY.totalMeters, 6);
    // Três trechos iguais de ~2 km: o total fica perto de 6 km.
    expect(GEOMETRY.totalMeters).toBeGreaterThan(6_000);
    expect(GEOMETRY.totalMeters).toBeLessThan(6_200);
  });

  it('uma rota com um ponto só não tem progresso a calcular', () => {
    const single = buildRouteGeometry([ROUTE[0]]);
    expect(
      computeTripProgress({
        geometry: single,
        totalDurationSeconds: 60,
        position: ROUTE[0],
        fromIndex: 0,
      }),
    ).toBeNull();
  });
});

describe('computeTripProgress', () => {
  it('no começo da rota nada foi percorrido', () => {
    const progress = progressAt(ROUTE[0]);

    expect(progress?.traveledMeters).toBeCloseTo(0, 1);
    expect(progress?.fraction).toBeCloseTo(0, 3);
    expect(progress?.remainingSeconds).toBeCloseTo(TOTAL_SECONDS, 1);
    expect(progress?.hasArrived).toBe(false);
  });

  it('no meio do segundo trecho, metade do caminho', () => {
    const progress = progressAt({ latitude: -22.9, longitude: -47.07 });

    expect(progress?.fraction).toBeCloseTo(0.5, 2);
    expect(progress?.remainingSeconds).toBeCloseTo(TOTAL_SECONDS / 2, 0);
    expect(progress?.nearestIndex).toBe(1);
  });

  it('o tempo restante cai junto com a distância', () => {
    const early = progressAt({ latitude: -22.9, longitude: -47.09 });
    const late = progressAt({ latitude: -22.9, longitude: -47.05 });

    expect(late!.remainingMeters).toBeLessThan(early!.remainingMeters);
    expect(late!.remainingSeconds).toBeLessThan(early!.remainingSeconds);
  });

  it('projeta quem está ao lado da rota, sem passar do total', () => {
    // ~27 m ao norte do último ponto — dentro dos 60 m que ainda contam como
    // "na rota". A distância percorrida não pode ultrapassar o trajeto.
    const progress = progressAt({ latitude: -22.89975, longitude: -47.04 });

    expect(progress!.traveledMeters).toBeLessThanOrEqual(GEOMETRY.totalMeters);
    expect(progress!.fraction).toBeLessThanOrEqual(1);
    expect(progress!.isOffRoute).toBe(false);
  });

  it('reconhece a chegada ao destino', () => {
    const progress = progressAt(ROUTE[3], 2);

    expect(progress?.hasArrived).toBe(true);
    expect(progress?.remainingMeters).toBeCloseTo(0, 1);
  });

  it('acusa quem saiu da rota', () => {
    // ~2 km ao sul do trajeto.
    const progress = progressAt({ latitude: -22.92, longitude: -47.07 });

    expect(progress?.isOffRoute).toBe(true);
    expect(progress?.offRouteMeters).toBeGreaterThan(1_000);
  });

  it('acha o trecho certo mesmo com a janela à frente apontando errado', () => {
    // O aparelho ficou sem sinal e reapareceu atrás do índice informado: a
    // busca global tem que corrigir, em vez de declarar desvio.
    const progress = progressAt({ latitude: -22.9, longitude: -47.095 }, 2);

    expect(progress?.isOffRoute).toBe(false);
    expect(progress?.nearestIndex).toBe(0);
  });
  it('devolve o rumo da rua, e não o do aparelho', () => {
    // O trajeto corre para o leste: a seta tem que apontar para 90°.
    const progress = progressAt({ latitude: -22.9, longitude: -47.07 });

    expect(progress?.courseDegrees).toBeCloseTo(90, 0);
  });

  it('gruda a posição na rota, para a seta não cair na calçada', () => {
    // 20 m ao sul do trajeto: dentro da tolerância, ainda em rota.
    const progress = progressAt({ latitude: -22.90018, longitude: -47.07 });

    expect(progress?.isOffRoute).toBe(false);
    expect(progress?.snappedPoint.latitude).toBeCloseTo(-22.9, 5);
    expect(progress?.snappedPoint.longitude).toBeCloseTo(-47.07, 5);
  });
});