/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-012 -- the pure helpers of the Scheduled Routes screen.
import { describe, expect, it } from 'vitest';
import { canCancel, daysText, departureState, hubsText, nextMoves, parseHubs, parsePincodes, quoteLines, routeBody, rupees } from './schedule';

describe('scheduled routes', () => {
  it('writes the days in week order', () => {
    expect(daysText('FRI,TUE')).toBe('Tue, Fri');
    expect(daysText('')).toBe('-');
    expect(daysText('xyz, mon')).toBe('Mon');
  });
  it('colours a departure by the space used', () => {
    expect(departureState({ status: 'OPEN', palletsLeft: 0, kgLeft: 100, percentUsed: 100 })).toBe('FULL');
    expect(departureState({ status: 'OPEN', palletsLeft: 3, kgLeft: 900, percentUsed: 85 })).toBe('FILLING');
    expect(departureState({ status: 'OPEN', palletsLeft: 15, kgLeft: 5900, percentUsed: 26 })).toBe('OPEN');
    expect(departureState({ status: 'DEPARTED', palletsLeft: 15 })).toBe('DEPARTED');
  });
  it('offers the same moves as the backend', () => {
    expect(nextMoves('BOOKED')).toEqual(['LOADED']);
    expect(nextMoves('LOADED')).toEqual(['IN_TRANSIT', 'BOOKED']);
    expect(nextMoves('IN_TRANSIT')).toEqual(['AT_HUB', 'DELIVERED']);
    expect(nextMoves('AT_HUB')).toEqual(['IN_TRANSIT']);
    expect(nextMoves('DELIVERED')).toEqual([]);
    expect(canCancel('BOOKED')).toBe(true);
    expect(canCancel('LOADED')).toBe(false);
  });
  it('reads the hubs and pincodes typed in the route form', () => {
    expect(parseHubs('Nagpur:45, Pune')).toEqual([{ hubCity: 'Nagpur', maxTransferMinutes: 45 }, { hubCity: 'Pune' }]);
    expect(hubsText([{ hubCity: 'Nagpur', maxTransferMinutes: 45 }, { hubCity: 'Pune' }])).toBe('Nagpur:45, Pune');
    expect(parsePincodes('400, 401 400 abc 4110001')).toEqual(['400', '401']);
    const b = routeBody({ code: 'X', dayTUE: true, dayFRI: true, dayMON: false, hubsText: 'Nagpur', pincodesText: '400' });
    expect(b).toEqual({ code: 'X', daysOfWeek: 'TUE,FRI', hubs: [{ hubCity: 'Nagpur' }], servedPincodes: ['400'] });
  });
  it('shows the price with the ODA charge', () => {
    expect(rupees(6350)).toBe('Rs 6,350.00');
    expect(rupees(null)).toBe('-');
    expect(quoteLines({ freight: 5000, oda: true, odaCharge: 1350, total: 6350 })).toEqual([['Freight', 'Rs 5,000.00'], ['ODA (outside the served area)', 'Rs 1,350.00'], ['Total', 'Rs 6,350.00']]);
    expect(quoteLines({ freight: 5000, oda: false, odaCharge: 0, total: 5000 })).toHaveLength(2);
  });
});
