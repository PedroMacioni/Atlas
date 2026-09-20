import { describe, expect, it } from 'vitest';

import { recentDestinations } from '@/features/destination/utils/recent-destinations';
import { filterPlaces } from '@/features/destination/utils/filter-places';
import type { Place } from '@/features/destination/types/place';
import type { TripCard } from '@/features/trip-session/types/trip';

const ANHANGUERA = { latitude: -22.8616, longitude: -47.0452 };

function trip(overrides: Partial<TripCard> & { id: string }): TripCard {
  return {
    originName: 'Sua localização',
    destinationName: 'Faculdade Anhanguera',
    destination: ANHANGUERA,
    startedAt: '2026-09-20T12:00:00Z',
    endedAt: null,
    endReason: null,
    distanceMeters: null,
    durationSeconds: null,
    stopCount: 0,
    predominantEmotion: null,
    ...overrides,
  };
}

describe('recentDestinations', () => {
  it('o mesmo lugar aparece uma vez só, na viagem mais recente', () => {
    const places = recentDestinations([
      trip({ id: '1', startedAt: '2026-09-20T12:00:00Z' }),
      trip({ id: '2', startedAt: '2026-09-19T12:00:00Z' }),
      trip({
        id: '3',
        destinationName: 'Aeroporto de Viracopos',
        destination: { latitude: -23.0074, longitude: -47.1345 },
      }),
    ]);

    expect(places.map((place) => place.name)).toEqual([
      'Faculdade Anhanguera',
      'Aeroporto de Viracopos',
    ]);
    expect(places[0].id).toBe('recent:1');
  });

  it('mesmo nome longe é outro lugar', () => {
    // Duas unidades da mesma faculdade, a quilômetros uma da outra.
    const places = recentDestinations([
      trip({ id: '1' }),
      trip({ id: '2', destination: { latitude: -22.95, longitude: -47.1 } }),
    ]);

    expect(places).toHaveLength(2);
  });

  it('nome igual a poucos metros é o mesmo lugar', () => {
    // A entrada do estacionamento e a portaria principal, a ~30 m.
    const places = recentDestinations([
      trip({ id: '1' }),
      trip({ id: '2', destination: { latitude: -22.86188, longitude: -47.0452 } }),
    ]);

    expect(places).toHaveLength(1);
  });

  it('respeita o limite da lista', () => {
    const many = Array.from({ length: 15 }, (_, index) =>
      trip({
        id: String(index),
        destinationName: `Destino ${index}`,
        destination: { latitude: -22.8 - index / 100, longitude: -47 },
      }),
    );

    expect(recentDestinations(many)).toHaveLength(10);
    expect(recentDestinations(many, 3)).toHaveLength(3);
  });

  it('descreve quando foi a viagem', () => {
    const [hoje] = recentDestinations([
      trip({ id: '1', startedAt: new Date().toISOString() }),
    ]);
    const [ontem] = recentDestinations([
      trip({ id: '2', startedAt: new Date(Date.now() - 86_400_000).toISOString() }),
    ]);
    const [antes] = recentDestinations([trip({ id: '3', startedAt: '2026-01-18T10:00:00Z' })]);

    expect(hoje.address).toBe('Hoje');
    expect(ontem.address).toBe('Ontem');
    expect(antes.address).toBe('Em 18/01');
  });

  it('ignora viagem sem nome de destino e data inválida não quebra a lista', () => {
    const places = recentDestinations([
      trip({ id: '1', destinationName: '   ' }),
      trip({ id: '2', destinationName: 'Posto Shell', startedAt: 'não é data' }),
    ]);

    expect(places.map((place) => place.name)).toEqual(['Posto Shell']);
    expect(places[0].address).toBe('Viagem anterior');
  });
});

describe('filterPlaces', () => {
  const places: Place[] = [
    {
      id: 'viracopos',
      name: 'Aeroporto de Viracopos',
      address: 'Campinas, SP',
      category: 'saved',
      saved: true,
      ...ANHANGUERA,
    },
    {
      id: 'posto',
      name: 'Posto São José',
      address: 'Rod. Dom Pedro I',
      category: 'fuel',
      saved: true,
      ...ANHANGUERA,
    },
    {
      id: 'cantina',
      name: 'Cantina da Esquina',
      address: 'São Paulo, SP',
      category: 'food',
      ...ANHANGUERA,
    },
  ];

  it('ignora acento e caixa, no nome e no endereço', () => {
    expect(filterPlaces({ places, query: 'sao paulo', category: null })).toHaveLength(1);
    expect(filterPlaces({ places, query: 'VIRACOPOS', category: null })).toHaveLength(1);
  });

  it('"salvos" filtra pela marcação, e não pela categoria', () => {
    const saved = filterPlaces({ places, query: '', category: 'saved' });

    expect(saved.map((place) => place.id)).toEqual(['viracopos', 'posto']);
  });

  it('categoria e texto se somam', () => {
    expect(filterPlaces({ places, query: 'posto', category: 'fuel' })).toHaveLength(1);
    expect(filterPlaces({ places, query: 'cantina', category: 'fuel' })).toHaveLength(0);
  });
});
