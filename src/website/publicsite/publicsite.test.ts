/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-004 -- the checks of the public website forms and tracking.
import { describe, expect, it } from 'vitest';
import { addDays, body, distanceText, normaliseLr, problems, stageIndex } from './publicsite';

const TODAY = '2026-10-08';
const pickup = { kind: 'PICKUP', fullName: 'Asha', phone: '98765 43210', pickupCity: 'Pune', deliveryCity: 'Mumbai', goods: 'Ice cream', temperatureClass: 'FROZEN', weightTons: '4', pickupDate: '2026-10-09', consent: true };

describe('public website helpers', () => {
  it('reads an LR number like the server', () => {
    expect(normaliseLr(' cn/26-27/000123 ')).toBe('CN/26-27/000123');
    expect(normaliseLr('x')).toBeNull();
    expect(normaliseLr("'; drop table")).toBeNull();
  });
  it('checks a pickup request', () => {
    expect(problems(pickup, TODAY)).toEqual([]);
    expect(problems({ ...pickup, phone: '12345', consent: false }, TODAY)).toEqual(['Please give a mobile number we can call (10 digits).', 'Please agree that we may contact you about this request.']);
    expect(problems({ ...pickup, pickupDate: '2026-10-01' }, TODAY)).toEqual(['The pickup date is in the past.']);
    expect(problems({ ...pickup, pickupDate: addDays(TODAY, 91) }, TODAY)).toEqual(['We take pickup requests up to 90 days ahead.']);
    expect(problems({ ...pickup, weightTons: '', pallets: '' }, TODAY)).toEqual(['Give the weight or the number of pallets.']);
    expect(problems({ ...pickup, weightTons: '61' }, TODAY)).toEqual(['The weight must be more than 0 and at most 60 tons.']);
  });
  it('checks a quote and a message', () => {
    expect(problems({ kind: 'QUOTE', fullName: 'A', phone: '+91 9876543210', pickupCity: 'Pune', consent: true }, TODAY))
      .toEqual(['Give the cities from and to, so we can price the lane.', 'Choose the temperature of the goods.']);
    expect(problems({ kind: 'CONTACT', fullName: 'A', phone: '9876543210', consent: true }, TODAY)).toEqual(['Please write your message.']);
    expect(problems({ kind: 'OTHER' }, TODAY)).toEqual(['Choose pickup, quote or message.']);
  });
  it('builds the body and the texts', () => {
    expect(body({ kind: 'PICKUP', weightTons: '4.5', pallets: '', consent: true, email: undefined })).toEqual({ kind: 'PICKUP', weightTons: 4.5, consent: true });
    expect(distanceText(3.24)).toBe('3.2 km away');
    expect(distanceText(118.6)).toBe('119 km away');
    expect(distanceText(null)).toBe('');
    expect(stageIndex('IN_TRANSIT')).toBe(2);
    expect(stageIndex('CANCELLED')).toBe(-1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
