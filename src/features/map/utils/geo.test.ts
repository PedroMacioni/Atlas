import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateHeading } from './geo';
import type { Coordinate } from '../types/coordinate';

describe('geo utils', () => {
  describe('haversineDistance', () => {
    it('returns 0 for same point', () => {
      const point: Coordinate = { latitude: -23.5505, longitude: -46.6333 };
      expect(haversineDistance(point, point)).toBe(0);
    });

    it('calculates distance between São Paulo and Rio (~357km)', () => {
      const sp: Coordinate = { latitude: -23.5505, longitude: -46.6333 };
      const rj: Coordinate = { latitude: -22.9068, longitude: -43.1729 };
      const distance = haversineDistance(sp, rj);
      expect(distance).toBeGreaterThan(350000);
      expect(distance).toBeLessThan(365000);
    });

    it('calculates short distance accurately (~100m)', () => {
      const p1: Coordinate = { latitude: -23.5505, longitude: -46.6333 };
      const p2: Coordinate = { latitude: -23.5505, longitude: -46.6323 }; // ~100m east
      const distance = haversineDistance(p1, p2);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(120);
    });
  });

  describe('calculateHeading', () => {
    it('returns 0 for movement due north', () => {
      const from: Coordinate = { latitude: 0, longitude: 0 };
      const to: Coordinate = { latitude: 1, longitude: 0 };
      expect(calculateHeading(from, to)).toBeCloseTo(0, 0);
    });

    it('returns 90 for movement due east', () => {
      const from: Coordinate = { latitude: 0, longitude: 0 };
      const to: Coordinate = { latitude: 0, longitude: 1 };
      expect(calculateHeading(from, to)).toBeCloseTo(90, 0);
    });

    it('returns 180 for movement due south', () => {
      const from: Coordinate = { latitude: 1, longitude: 0 };
      const to: Coordinate = { latitude: 0, longitude: 0 };
      expect(calculateHeading(from, to)).toBeCloseTo(180, 0);
    });

    it('returns 270 for movement due west', () => {
      const from: Coordinate = { latitude: 0, longitude: 1 };
      const to: Coordinate = { latitude: 0, longitude: 0 };
      expect(calculateHeading(from, to)).toBeCloseTo(270, 0);
    });

    it('returns null for movement less than minDistance', () => {
      const from: Coordinate = { latitude: -23.5505, longitude: -46.6333 };
      const to: Coordinate = { latitude: -23.55051, longitude: -46.6333 }; // ~1m
      expect(calculateHeading(from, to)).toBeNull();
    });

    it('returns null for same point', () => {
      const point: Coordinate = { latitude: -23.5505, longitude: -46.6333 };
      expect(calculateHeading(point, point)).toBeNull();
    });
  });
});
