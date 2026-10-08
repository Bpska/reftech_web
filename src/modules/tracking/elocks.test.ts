/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-010 -- the pure helpers of the Electronic Locks screen.
import { describe, expect, it } from 'vitest';
import { batteryStyle, codeFormProblem, distance, eventName, eventStyle, placeText } from './elocks';

describe('REQ-TRK-010 electronic locks', () => {
  it('names the events', () => {
    expect(eventName('TAMPER')).toBe('Tamper');
    expect(eventName('UNLOCK_REFUSED')).toBe('Unlock refused');
    expect(eventName('SOMETHING')).toBe('SOMETHING');
  });
  it('writes distances as ElockRules does', () => {
    expect(distance(850)).toBe('850 m');
    expect(distance(19440)).toBe('19.4 km');
    expect(distance(null)).toBe('-');
  });
  it('says where it happened', () => {
    expect(placeText({ lockKind: 'TRUCK_DOOR', atPlannedStop: true, stopName: 'Cuttack' })).toBe('At Cuttack');
    expect(placeText({ lockKind: 'TRUCK_DOOR', atPlannedStop: false, distanceM: 8269, stopName: 'Cuttack' })).toBe('8.3 km from Cuttack');
    expect(placeText({ lockKind: 'TRUCK_DOOR', atPlannedStop: null })).toBe('Position not known');
    expect(placeText({ lockKind: 'CHAMBER_DOOR', chamberName: 'Frozen' })).toBe('Frozen');
  });
  it('marks tamper and alerts', () => {
    expect(eventStyle({ eventType: 'TAMPER' })).toContain('red');
    expect(eventStyle({ eventType: 'OPEN', alertId: 5 })).toContain('amber');
    expect(eventStyle({ eventType: 'OPEN', alertId: null })).toBe('');
    expect(batteryStyle(10)).toContain('red');
    expect(batteryStyle(80)).toContain('emerald');
  });
  it('checks the code form', () => {
    expect(codeFormProblem('TRUCK_DOOR', { issuedToName: 'Ravi', tripId: '' })).toContain('Choose the trip');
    expect(codeFormProblem('TRUCK_DOOR', { issuedToName: 'Ravi', tripId: 3 }, 0)).toBe('The trip has no planned stop');
    expect(codeFormProblem('TRUCK_DOOR', { issuedToName: 'Ravi', tripId: 3 }, 2)).toBe('');
    expect(codeFormProblem('CHAMBER_DOOR', { issuedToName: 'Store keeper', validHours: 200 })).toBe('A code is valid for 1 to 168 hours');
    expect(codeFormProblem('CHAMBER_DOOR', { issuedToName: '' })).toBe('Type who gets the code');
  });
});
