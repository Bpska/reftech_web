/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-013 -- the pure helpers of the Home Delivery screen and the customer's tracking page.
import { describe, expect, it } from 'vitest';
import { customerStatus, fullLink, lateRisk, orderActions, parseLines, plannable, slotText } from './homeDelivery';

describe('home delivery', () => {
  it('offers the actions the backend allows', () => {
    expect(orderActions('OUT_FOR_DELIVERY')).toEqual(['DELIVER', 'FAIL', 'RESEND']);
    expect(orderActions('FAILED')).toEqual(['RETRY', 'RETURN', 'RESEND']);
    expect(orderActions('DELIVERED')).toEqual([]);
    expect(orderActions('RECEIVED')).toContain('CANCEL');
  });
  it('writes the slot in India time', () => {
    expect(slotText('2026-10-09T10:00:00+05:30', '2026-10-09T12:00:00+05:30')).toBe('09 Oct 10:00-12:00');
    expect(slotText('2026-10-09T23:00:00+05:30', '2026-10-10T01:00:00+05:30')).toBe('09 Oct 23:00 - 10 Oct 01:00');
    expect(slotText(null, null)).toBe('-');
  });
  it('flags a slot at risk', () => {
    const end = '2026-10-09T12:00:00+05:30';
    expect(lateRisk({ status: 'PLANNED', slotEnd: end, etaAt: '2026-10-09T12:20:00+05:30' })).toBe(true);
    expect(lateRisk({ status: 'PLANNED', slotEnd: end, etaAt: '2026-10-09T11:00:00+05:30' })).toBe(false);
    expect(lateRisk({ status: 'DELIVERED', slotEnd: end, etaAt: '2026-10-09T13:00:00+05:30' })).toBe(false);
    expect(lateRisk({ status: 'RECEIVED', slotEnd: end }, new Date('2026-10-09T07:00:00Z'))).toBe(true);
  });
  it('makes the tracking link absolute and the words plain', () => {
    expect(fullLink('/track/order/abc', 'https://portal.example')).toBe('https://portal.example/track/order/abc');
    expect(fullLink('https://x.example/track/order/abc', 'https://portal.example')).toBe('https://x.example/track/order/abc');
    expect(fullLink(null)).toBe('');
    expect(customerStatus('OUT_FOR_DELIVERY')).toBe('On the way');
    expect(customerStatus('PLANNED')).toBe('Being prepared');
  });
  it('reads the order lines and the orders to plan', () => {
    expect(parseLines('ICE-500, Ice cream, 2, B1, 2027-04-06\n\nPEAS')).toEqual([
      { sku: 'ICE-500', description: 'Ice cream', quantity: 2, batchNo: 'B1', expiryDate: '2027-04-06' },
      { sku: 'PEAS', description: null, quantity: 1 }]);
    expect(plannable([{ id: 1, status: 'RECEIVED' }, { id: 2, status: 'PLANNED' }, { id: 3, status: 'RECEIVED' }], [1, 2])).toEqual([1]);
  });
});
