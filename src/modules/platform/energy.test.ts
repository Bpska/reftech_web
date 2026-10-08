/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-018 -- Energy & Carbon screen helpers.
import { describe, expect, it } from 'vitest';
import { co2Text, energyTabs, flagTone, lastMonthStart, periods } from './energy';

describe('energy helpers', () => {
  it('shows a partner only its carbon and reports', () => {
    expect(energyTabs(true).map(([k]) => k)).toEqual(['carbon', 'reports']);
    expect(energyTabs(false)).toHaveLength(5);
  });
  it('works out the quick periods', () => {
    const p = periods(new Date(2026, 9, 8));
    expect(p.find(x => x.key === 'this')).toMatchObject({ from: '2026-10-01', to: '2026-10-08' });
    expect(p.find(x => x.key === 'last')).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    expect(p.find(x => x.key === 'three')).toMatchObject({ from: '2026-08-01' });
    expect(p.find(x => x.key === 'fy')).toMatchObject({ from: '2026-04-01' });
    expect(periods(new Date(2027, 1, 5)).find(x => x.key === 'fy')?.from).toBe('2026-04-01');
    expect(lastMonthStart(new Date(2026, 0, 15))).toBe('2025-12-01');
  });
  it('formats flags and carbon', () => {
    expect(flagTone('HIGH')).toContain('red');
    expect(flagTone(null)).toContain('slate');
    expect(co2Text(950)).toBe('950 kg CO2');
    expect(co2Text(9081.34)).toBe('9.08 t CO2');
    expect(co2Text(null)).toBe('-');
  });
});
