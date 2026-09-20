import { describe, expect, it } from 'vitest';

import { formatArrivalTime, formatShortDuration } from '@/utils/arrival';
import { formatDistance } from '@/utils/distance';
import { distanceBetween } from '@/utils/geo';
import { formatSpeed, toKilometersPerHour } from '@/utils/speed';
import { formatManeuverDistance } from '@/features/trip/utils/maneuver-text';

/**
 * Os números que aparecem na tela durante a viagem.
 *
 * Erram em silêncio: uma conversão trocada não quebra nada, só mostra a
 * informação errada para quem está dirigindo.
 */
describe('distância', () => {
  it('abaixo de 1 km arredonda para dezenas de metros', () => {
    expect(formatDistance(847)).toBe('850 m');
    expect(formatDistance(0)).toBe('0 m');
  });

  it('a partir de 1 km usa vírgula decimal', () => {
    expect(formatDistance(18_430)).toBe('18,4 km');
    expect(formatDistance(1000)).toBe('1,0 km');
  });

  it('valor impossível vira traço, e não "NaN"', () => {
    expect(formatDistance(Number.NaN)).toBe('--');
    expect(formatDistance(-5)).toBe('--');
  });
});

describe('velocidade', () => {
  it('converte metros por segundo em km/h', () => {
    expect(toKilometersPerHour(10)).toBeCloseTo(36, 6);
    expect(toKilometersPerHour(0)).toBe(0);
  });

  it('recusa a leitura que o iOS usa para "não sei"', () => {
    expect(toKilometersPerHour(-1)).toBeNull();
    expect(toKilometersPerHour(null)).toBeNull();
    expect(toKilometersPerHour(Number.NaN)).toBeNull();
  });

  it('o mostrador é inteiro', () => {
    expect(formatSpeed(47.3)).toBe('47');
    expect(formatSpeed(Number.NaN)).toBe('0');
  });
});

describe('chegada', () => {
  it('soma o tempo restante ao relógio', () => {
    const agora = new Date('2026-09-20T14:00:00');

    expect(formatArrivalTime(11 * 60, agora)).toBe('14:11');
    expect(formatArrivalTime(0, agora)).toBe('14:00');
  });

  it('vira o dia sem quebrar', () => {
    expect(formatArrivalTime(2 * 3600, new Date('2026-09-20T23:30:00'))).toBe('01:30');
  });

  it('duração curta sai em minutos; longa, em horas', () => {
    expect(formatShortDuration(90)).toBe('2 min');
    expect(formatShortDuration(3 * 3600 + 25 * 60)).toBe('3h25');
  });
});

describe('distância de manobra', () => {
  it('usa degraus grossos, para não piscar em movimento', () => {
    expect(formatManeuverDistance(320)).toBe('Em 300 m');
    expect(formatManeuverDistance(340)).toBe('Em 350 m');
  });

  it('bem perto, é "agora"', () => {
    expect(formatManeuverDistance(12)).toBe('Agora');
  });

  it('longe, em quilômetros', () => {
    expect(formatManeuverDistance(2_480)).toBe('Em 2,5 km');
  });
});

describe('distanceBetween', () => {
  it('mede a distância real entre dois pontos de Campinas', () => {
    // Faculdade Anhanguera (Taquaral) → Aeroporto de Viracopos: ~18 km.
    const meters = distanceBetween(
      { latitude: -22.8616, longitude: -47.0452 },
      { latitude: -23.0074, longitude: -47.1345 },
    );

    expect(meters).toBeGreaterThan(17_000);
    expect(meters).toBeLessThan(19_000);
  });

  it('o mesmo ponto tem distância zero', () => {
    const ponto = { latitude: -22.8616, longitude: -47.0452 };

    expect(distanceBetween(ponto, ponto)).toBeCloseTo(0, 6);
  });

  it('a mesma diferença de longitude vale menos longe do equador', () => {
    const noEquador = distanceBetween(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );
    const emCampinas = distanceBetween(
      { latitude: -22.9, longitude: -47 },
      { latitude: -22.9, longitude: -46 },
    );

    expect(emCampinas).toBeLessThan(noEquador);
  });
});
