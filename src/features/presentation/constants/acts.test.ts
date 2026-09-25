import { describe, it, expect } from 'vitest';
import { ACTS, getAct } from './acts';

describe('acts', () => {
  it('has exactly 7 acts', () => {
    expect(ACTS).toHaveLength(7);
  });

  it('acts are numbered 1 through 7', () => {
    const ids = ACTS.map((act) => act.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('each act has a name and duration', () => {
    for (const act of ACTS) {
      expect(act.name).toBeTruthy();
      expect(typeof act.duration).toBe('number');
    }
  });

  it('getAct returns the correct act', () => {
    const act3 = getAct(3);
    expect(act3?.id).toBe(3);
    expect(act3?.name).toBe('Navegação Ativa');
  });

  it('getAct returns undefined for invalid id', () => {
    expect(getAct(0)).toBeUndefined();
    expect(getAct(8)).toBeUndefined();
  });
});
