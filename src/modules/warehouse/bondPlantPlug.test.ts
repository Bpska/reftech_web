/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-020, REQ-WMS-022, REQ-WMS-023 -- the pure helpers of the Bonded Warehouse, Plant & Equipment and Reefer Plug Points screens.
import { describe, expect, it } from 'vitest';
import { billedHours, bondExpiry, downtime, dutyShare, everyText, nextSteps, plugCharge, releaseProblem, rupees, truckNumber, words } from './bondPlantPlug';

describe('REQ-WMS-020 bond', () => {
  it('shows rupees in lakhs', () => {
    expect(rupees(300000)).toBe('₹ 3,00,000.00');
    expect(rupees(-150.5)).toBe('-₹ 150.50');
    expect(rupees(null)).toBe('-');
    expect(words('HOME_CONSUMPTION')).toBe('Home consumption');
  });
  it('shares the duty in proportion and gives the rest to the last release', () => {
    expect(dutyShare(2000, 300000, 0, 0, 1000)).toBe(150000);
    expect(dutyShare(3, 100, 0, 0, 1)).toBe(33);
    expect(dutyShare(3, 100, 2, 66, 1)).toBe(34);
    expect(dutyShare(2000, 300000, 0, 0, 500, 'RE_EXPORT')).toBe(0);
    expect(dutyShare(2000, 300000, 0, 0, 0)).toBe(0);
  });
  it('colours the bond expiry', () => {
    expect(bondExpiry('EXPIRED', -3).text).toBe('expired 3 day(s) ago');
    expect(bondExpiry('DUE_SOON', 0).text).toBe('expires today');
    expect(bondExpiry('DUE_SOON', 12).style).toContain('amber');
    expect(bondExpiry(null, null).text).toBe('');
  });
  it('needs the duty paid document, the challan and the full duty for home consumption', () => {
    const base = { releaseType: 'HOME_CONSUMPTION', docNo: '8765432', quantity: 1000, balance: 2000, dutyDue: 150000, dutyPaid: 150000, challanNo: 'CH-1', hasDocument: true };
    expect(releaseProblem(base)).toBe('');
    expect(releaseProblem({ ...base, hasDocument: false })).toBe('Attach the duty paid document');
    expect(releaseProblem({ ...base, challanNo: '' })).toBe('Type the duty challan number');
    expect(releaseProblem({ ...base, dutyPaid: 149000 })).toContain('less than the duty due');
    expect(releaseProblem({ ...base, quantity: 2500 })).toBe('Only 2000 is left in bond');
    expect(releaseProblem({ releaseType: 'RE_EXPORT', docNo: '', quantity: 1 })).toBe('Type the shipping bill number');
    expect(releaseProblem({ releaseType: 'RE_EXPORT', docNo: 'SB-1', quantity: 1 })).toBe('');
  });
});

describe('REQ-WMS-022 plant', () => {
  it('offers the next steps of a ticket', () => {
    expect(nextSteps('OPEN').map(([s]) => s)).toEqual(['ASSIGNED', 'IN_PROGRESS', 'CANCELLED']);
    expect(nextSteps('RESOLVED').map(([s]) => s)).toEqual(['CLOSED', 'IN_PROGRESS']);
    expect(nextSteps('CLOSED')).toEqual([]);
  });
  it('writes downtime and schedules in words', () => {
    expect(downtime(45)).toBe('45 min');
    expect(downtime(190)).toBe('3 h 10 min');
    expect(downtime(3000)).toBe('2 d 2 h');
    expect(downtime(null)).toBe('-');
    expect(everyText(500, null)).toBe('500 h');
    expect(everyText(250, 90)).toBe('250 h or 90 days');
  });
});

describe('REQ-WMS-023 plug points', () => {
  it('rounds the time up to whole blocks, at least one', () => {
    expect(billedHours('2026-10-07T08:00:00Z', '2026-10-07T14:00:00Z', 30)).toBe(6);
    expect(billedHours('2026-10-07T08:00:00Z', '2026-10-07T08:31:00Z', 30)).toBe(1);
    expect(billedHours('2026-10-07T08:00:00Z', '2026-10-07T08:05:00Z', 60)).toBe(1);
    expect(billedHours('2026-10-07T08:00:00Z', '2026-10-07T07:00:00Z', 30)).toBe(0);
  });
  it('charges energy and time, at least the minimum', () => {
    expect(plugCharge(42, 6, 12, 20, 150)).toEqual({ energy: 504, time: 120, amount: 624, minimumApplied: false });
    expect(plugCharge(2, 1, 12, 20, 150)).toEqual({ energy: 24, time: 20, amount: 150, minimumApplied: true });
  });
  it('cleans the truck number', () => {
    expect(truckNumber('od 02 tg-2001')).toBe('OD02TG2001');
    expect(truckNumber('AB1')).toBe('');
  });
});
