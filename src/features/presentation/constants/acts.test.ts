import { describe, it, expect } from 'vitest';
import { ACTS, getAct } from './acts';

describe('acts', () => {
  it('has exactly 10 acts', () => {
    expect(ACTS).toHaveLength(10);
  });

  it('acts are numbered 1 through 10', () => {
    const ids = ACTS.map((act) => act.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('each act has a name and duration', () => {
    for (const act of ACTS) {
      expect(act.name).toBeTruthy();
      expect(typeof act.duration).toBe('number');
      expect(act.sequence.filter((step) => step.type === 'wait').reduce((total, step) => total + step.ms, 0)).toBeLessThanOrEqual(act.duration);
    }
  });

  it('getAct returns the correct act', () => {
    const act3 = getAct(3);
    expect(act3?.id).toBe(3);
    expect(act3?.name).toBe('Navegação Ativa');
  });

  it('getAct returns undefined for invalid id', () => {
    expect(getAct(0)).toBeUndefined();
    expect(getAct(11)).toBeUndefined();
  });

  it('ends by opening the completed trip after the voice example', () => {
    expect(getAct(9)?.sequence.some((step) => step.type === 'demo-voice')).toBe(true);
    expect(ACTS.at(-1)?.sequence.at(-1)?.type).toBe('complete-trip');
  });
});
