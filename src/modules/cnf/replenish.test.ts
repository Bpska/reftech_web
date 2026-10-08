/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-008 -- replenishment screen helpers.
import { describe, expect, it } from 'vitest';
import { bandColour, decisionProblem, stepsOf, weeklyChart } from './replenish';

describe('replenishment helpers', () => {
  it('puts history and forecast on one time line', () => {
    const c = weeklyChart([10, 20, 30], [25, 25]);
    expect(c.labels).toEqual(['W-3', 'W-2', 'W-1', 'W+1', 'W+2']);
    expect(c.series[0].values).toEqual([10, 20, 30, null, null]);
    expect(c.series[1].values).toEqual([null, null, null, 25, 25]);
    expect(weeklyChart(null, undefined).labels).toEqual([]);
  });
  it('splits the steps', () => {
    expect(stepsOf('a\n\n b \r\nc')).toEqual(['a', 'b', 'c']);
    expect(stepsOf(['x', ' '])).toEqual(['x']);
    expect(stepsOf(null)).toEqual([]);
  });
  it('checks an answer', () => {
    expect(decisionProblem('ACCEPT', '', '')).toBe('');
    expect(decisionProblem('ACCEPT', '0', '')).toContain('more than 0');
    expect(decisionProblem('ACCEPT', 'abc', '')).toContain('more than 0');
    expect(decisionProblem('REJECT', '', 'no')).toContain('why');
    expect(decisionProblem('REJECT', '', 'too much stock')).toBe('');
  });
  it('colours the stock against the band', () => {
    expect(bandColour(5, 10, 20)).toBe('text-red-700');
    expect(bandColour(25, 10, 20)).toBe('text-amber-700');
    expect(bandColour(15, 10, 20)).toBe('text-emerald-700');
    expect(bandColour(null, 10, 20)).toBe('text-slate-700');
  });
});
