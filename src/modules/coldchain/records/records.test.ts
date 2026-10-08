/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-008, 010, 011, 012, 013, 014 -- the pure helpers of the cold chain record screens.
import { describe, expect, it } from 'vitest';
import { clean, custodyQuery, duration, notReady, nowIndia, qs, temp, tone, words } from './records';

describe('cold chain record helpers', () => {
  it('sees the "run script 66" answer', () => {
    expect(notReady({ ready: false, script: 'database_v2/66_cold_chain_records.sql' })).toBe(true);
    expect(notReady({ ready: true })).toBe(false);
    expect(notReady(null)).toBe(false);
    expect(notReady({ items: [] })).toBe(false);
  });

  it('sends empty text as null and trims the rest', () => {
    expect(clean({ a: '', b: '  x ', c: 5, d: null, e: true })).toEqual({ a: null, b: 'x', c: 5, d: null, e: true });
  });

  it('writes codes, temperatures and durations in plain words', () => {
    expect(words('CAL_OVERDUE')).toBe('Cal overdue');
    expect(words(null)).toBe('-');
    expect(temp('-18.456')).toBe('-18.46 °C');
    expect(temp(null)).toBe('-');
    expect(duration(45)).toBe('45 min');
    expect(duration(130)).toBe('2 h 10 min');
    expect(duration(120)).toBe('2 h');
  });

  it('gives the time in India as the backend reads it', () => {
    expect(nowIndia(new Date('2026-10-07T05:00:00Z'))).toBe('2026-10-07 10:30');
    expect(nowIndia(new Date('2026-10-07T18:45:00Z'))).toBe('2026-10-08 00:15');
  });

  it('builds the address of a custody record from the set values only', () => {
    expect(custodyQuery({ partnerId: 1, productId: 2, batchNo: 'IC 26/01' })).toBe('?partnerId=1&productId=2&batchNo=IC+26%2F01');
    expect(custodyQuery({ palletCode: 'TP0001' })).toBe('?palletCode=TP0001');
    expect(qs({ a: '', b: null, c: 0 })).toBe('?c=0');
    expect(qs({})).toBe('');
  });

  it('colours a state', () => {
    expect(tone('OVERDUE')).toContain('red');
    expect(tone('due_soon')).toContain('amber');
    expect(tone('PASS')).toContain('emerald');
    expect(tone('SOMETHING')).toContain('slate');
  });
});
