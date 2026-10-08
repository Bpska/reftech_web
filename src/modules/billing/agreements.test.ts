/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-011 -- the expiry bands, alert stages and renewal dates of the Agreement Vault screen.
import { describe, expect, it } from 'vitest';
import { band, daysLeft, expiryNote, nextStage, ratesLocked, renewalDates } from './agreements';

const TODAY = '2026-10-08';

describe('days left', () => {
  it('counts to the end date', () => {
    expect(daysLeft('2026-10-22', TODAY)).toBe(14);
    expect(daysLeft('2026-10-07', TODAY)).toBe(-1);
    expect(daysLeft(null, TODAY)).toBeNull();
  });
  it('puts the agreement in a band', () => {
    expect(band(null)).toBe('open-ended');
    expect(band(-1)).toBe('expired');
    expect(band(7)).toBe('expiring-7');
    expect(band(14)).toBe('expiring-15');
    expect(band(29)).toBe('expiring-30');
    expect(band(59)).toBe('expiring-60');
    expect(band(120)).toBe('ok');
  });
});

describe('alert stages', () => {
  it('names the next alert still to go out', () => {
    expect(nextStage(90)).toBeNull();
    expect(nextStage(60)).toBe(60);
    expect(nextStage(31)).toBe(60);
    expect(nextStage(30)).toBe(30);
    expect(nextStage(14)).toBe(15);
    expect(nextStage(7)).toBe(7);
    expect(nextStage(1)).toBe(7);
    expect(nextStage(-1)).toBeNull();
  });
  it('writes the line the screen shows', () => {
    expect(expiryNote(null)).toBe('No end date');
    expect(expiryNote(0)).toBe('Expires today');
    expect(expiryNote(14)).toContain('escalated to the manager');
    expect(expiryNote(25)).toContain('renewal prompt sent');
    expect(expiryNote(-1)).toBe('Expired 1 day ago - the rates are locked');
  });
});

describe('renewal and locks', () => {
  it('suggests the next term of the same length', () => {
    expect(renewalDates('2026-01-01', '2026-12-31')).toEqual({ from: '2027-01-01', to: '2027-12-31' });
    expect(renewalDates('2026-12-31', '2026-01-01')).toBeNull();
  });
  it('locks the rates of an agreement that has ended', () => {
    expect(ratesLocked('ACTIVE', 14)).toBe(false);
    expect(ratesLocked('ACTIVE', -1)).toBe(true);
    expect(ratesLocked('EXPIRED', null)).toBe(true);
    expect(ratesLocked('TERMINATED', 100)).toBe(true);
  });
});
