/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-007 / REQ-PLT-015 -- units, numbers, money and dates (the same numbers as UnitsTest.java).
import { afterEach, describe, expect, it } from 'vitest';
import { fmtTemp, fmtWeight, formatDate, formatDateTime, formatDistance, formatMoney, formatNumber, formatTemp, formatWeight, roundHalfUp } from './format';
import { DEFAULT_PREFS, normalizePrefs, Prefs, setCurrentPrefs } from './prefs';

const P = (x: Partial<Prefs> = {}): Prefs => ({ ...DEFAULT_PREFS, ...x });

describe('numbers', () => {
  it('Indian and international grouping', () => {
    expect(formatNumber(123456789, P(), 0)).toBe('12,34,56,789');
    expect(formatNumber(123456789, P({ numberGrouping: 'INTERNATIONAL' }), 0)).toBe('123,456,789');
    expect(formatNumber(999, P(), 2, false)).toBe('999.00');
    expect(formatNumber(1000.5, P(), 3)).toBe('1,000.5');
    expect(formatNumber(-1000, P(), 0)).toBe('-1,000');
    expect(formatNumber('1,23,456.5', P(), 2)).toBe('1,23,456.5');
    expect(formatNumber(null, P())).toBe('-');
    expect(formatNumber('abc', P())).toBe('-');
    expect(formatNumber(0, P())).toBe('0');
  });
  it('rounds half away from zero', () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(-2.5, 0)).toBe(-3);
    expect(roundHalfUp(1e-9, 2)).toBe(0);
  });
});

describe('units', () => {
  it('weight', () => {
    expect(formatWeight(12.5, P())).toBe('12.5 t');
    expect(formatWeight(125.25, P({ weightUnit: 'KG' }))).toBe('1,25,250 kg');
    expect(formatWeight(125.25, P({ weightUnit: 'KG', numberGrouping: 'INTERNATIONAL' }))).toBe('125,250 kg');
    expect(formatWeight(undefined, P())).toBe('-');
  });
  it('temperature', () => {
    expect(formatTemp(-18, P())).toBe('-18.0 °C');
    expect(formatTemp(-18, P({ temperatureUnit: 'F' }))).toBe('-0.4 °F');
    expect(formatTemp(100, P({ temperatureUnit: 'F' }))).toBe('212.0 °F');
  });
  it('distance', () => {
    expect(formatDistance(1234.56, P())).toBe('1,234.6 km');
    expect(formatDistance(100, P({ distanceUnit: 'MI' }))).toBe('62.1 mi');
  });
  it('money is never converted', () => {
    expect(formatMoney(100000, P())).toBe('₹ 1,00,000.00');
    expect(formatMoney(1234567.891, P({ currencyDisplay: 'CODE', numberGrouping: 'INTERNATIONAL' }))).toBe('INR 1,234,567.89');
    expect(formatMoney(-50, P())).toBe('-₹ 50.00');
  });
});

describe('dates', () => {
  it('a day is shown as it is in every format', () => {
    expect(formatDate('2026-10-07', P())).toBe('07-10-2026');
    expect(formatDate('2026-10-07', P({ dateFormat: 'YYYY-MM-DD' }))).toBe('2026-10-07');
    expect(formatDate('2026-10-07', P({ dateFormat: 'DD MMM YYYY', timeZone: 'America/Los_Angeles' }))).toBe('07 Oct 2026');
  });
  it('a moment is moved into the time zone', () => {
    expect(formatDateTime('2026-10-07T20:00:00Z', P())).toBe('08-10-2026 01:30');
    expect(formatDateTime('2026-10-07T20:00:00Z', P({ timeZone: 'UTC', dateFormat: 'YYYY-MM-DD' }))).toBe('2026-10-07 20:00');
    expect(formatDate('2026-10-07T20:00:00Z', P())).toBe('08-10-2026');
    expect(formatDate(null, P())).toBe('-');
    expect(formatDate('not a date', P())).toBe('not a date');
  });
});

describe('choices in use', () => {
  afterEach(() => { setCurrentPrefs(DEFAULT_PREFS, false); });
  it('fmt functions follow the current choices', () => {
    expect(fmtWeight(2)).toBe('2 t');
    setCurrentPrefs({ weightUnit: 'KG', temperatureUnit: 'F' }, false);
    expect(fmtWeight(2)).toBe('2,000 kg');
    expect(fmtTemp(0)).toBe('32.0 °F');
  });
  it('bad values from the server or the cache become the default', () => {
    const p = normalizePrefs({ language: 'HI', timeZone: 'Mars/Base', weightUnit: 'stone', highContrast: 'true', textSize: 125 });
    expect(p.language).toBe('hi');
    expect(p.timeZone).toBe('Asia/Kolkata');
    expect(p.weightUnit).toBe('TON');
    expect(p.highContrast).toBe(true);
    expect(p.textSize).toBe('125');
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
  });
});
