import { describe, expect, it } from 'vitest';

import { navigationSegments } from './navigation-segments';

const route = [0, 1, 2, 3].map((longitude) => ({ latitude: 0, longitude }));
const car = { latitude: 0, longitude: 1.4 };

describe('navigationSegments', () => {
  it('starts the active route at the car rather than the preceding vertex', () => {
    const result = navigationSegments(route, 1, car, null);
    expect(result.completed.at(-1)).toEqual(car);
    expect(result.pending[0]).toEqual(car);
    expect(result.pending[1]).toEqual(route[2]);
  });

  it('keeps the detour and destination connected at the stop', () => {
    const result = navigationSegments(route, 1, car, 2);
    expect(result.detour).toEqual([car, route[2]]);
    expect(result.pending).toEqual([route[2], route[3]]);
  });
});
