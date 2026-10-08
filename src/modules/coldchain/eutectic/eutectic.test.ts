/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-016 -- the pure helpers of the Eutectic Plates screen.
import { describe, expect, it } from 'vitest';
import { fits, holdMinutes, hoursText, stateTone } from './eutectic';

describe('eutectic plates', () => {
  it('shortens the hold time on a hot day only', () => {
    expect(holdMinutes(10, 32, 32, 2)).toBe(600);
    expect(holdMinutes(10, 40, 32, 2)).toBe(504);
    expect(holdMinutes(10, 20, 32, 2)).toBe(600);
    expect(holdMinutes(10, 90, 32, 2)).toBe(0);
  });
  it('checks a planned trip against the hold time', () => {
    expect(fits('2026-10-09T09:00:00+05:30', '2026-10-09T05:00:00+05:30', 30)).toEqual({ spare: -240, state: 'OVER' });
    expect(fits('2026-10-09T04:45:00+05:30', '2026-10-09T05:00:00+05:30', 30)).toEqual({ spare: 15, state: 'TIGHT' });
    expect(fits('2026-10-09T02:00:00+05:30', '2026-10-09T05:00:00+05:30', 30)?.state).toBe('OK');
    expect(fits(null, '2026-10-09T05:00:00+05:30', 30)).toBeNull();
  });
  it('writes minutes and colours states', () => {
    expect(hoursText(200)).toBe('3 h 20 min');
    expect(hoursText(45)).toBe('45 min');
    expect(hoursText(-90, true)).toBe('1 h 30 min ago');
    expect(hoursText(null)).toBe('-');
    expect(stateTone('OVER')).toBe('OVER');
    expect(stateTone('TIGHT')).toBe('DUE_SOON');
    expect(stateTone('SPENT')).toBe('INACTIVE');
  });
});
