/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-001 .. 007 -- the pure helpers of the C&F screens: rupees, quantities, months, the tabs a login sees, CSV count.
import { describe, expect, it } from 'vitest';
import { csvRows, inr, lastMonth, principalNumberPending, principalReturnLines, principalReturnValue, qty, statusColour, tabsFor, yesterday } from './cnf';

describe('inr', () => {
  it('groups in lakhs and crores', () => {
    expect(inr(123456.5)).toBe('₹ 1,23,456.50');
    expect(inr(29580)).toBe('₹ 29,580.00');
    expect(inr(12345678)).toBe('₹ 1,23,45,678.00');
    expect(inr(999)).toBe('₹ 999.00');
    expect(inr(-1180)).toBe('-₹ 1,180.00');
  });
  it('is empty for nothing', () => {
    expect(inr(null)).toBe('');
    expect(inr(undefined)).toBe('');
    expect(inr('')).toBe('');
  });
});

describe('qty', () => {
  it('drops trailing zeros and rounds to 3 places', () => {
    expect(qty('12.500')).toBe('12.5');
    expect(qty(3)).toBe('3');
    expect(qty(1.23456)).toBe('1.235');
    expect(qty(null)).toBe('');
  });
});

describe('months and days', () => {
  it('last month crosses the year', () => {
    expect(lastMonth(new Date(2026, 9, 7))).toBe('2026-09');
    expect(lastMonth(new Date(2027, 0, 15))).toBe('2026-12');
  });
  it('yesterday crosses the month', () => {
    expect(yesterday(new Date(2026, 9, 7))).toBe('2026-10-06');
    expect(yesterday(new Date(2026, 9, 1))).toBe('2026-09-30');
    expect(yesterday(new Date(2026, 0, 1))).toBe('2025-12-31');
  });
});

describe('tabsFor', () => {
  it('staff see every tab', () => {
    expect(tabsFor(false, null).map(([k]) => k)).toEqual(['contracts', 'orders', 'stock', 'returns', 'documents', 'settlement']);
  });
  it('a principal without a contract sees only its contract', () => {
    expect(tabsFor(true, null).map(([k]) => k)).toEqual(['contracts']);
  });
  it('a principal sees what its contract shows', () => {
    const c = { showOrders: true, showStock: false, showInvoices: true, showSettlement: false };
    expect(tabsFor(true, c).map(([k]) => k)).toEqual(['contracts', 'orders', 'returns', 'documents']);
  });
});

describe('csvRows', () => {
  it('counts lines that end with a number, not the heading or blanks', () => {
    expect(csvRows('product_code,batch_no,quantity\nPANEER,B1,120\n\nICE1L,B2,4.5\n')).toBe(2);
    expect(csvRows('ICE1L;B2;10\r\nMILK500\tM1\t3')).toBe(2);
    expect(csvRows('')).toBe(0);
  });
});

describe('statusColour', () => {
  it('green for done, red for refused, grey for unknown', () => {
    expect(statusColour('settled')).toContain('emerald');
    expect(statusColour('DISPUTED')).toContain('red');
    expect(statusColour('whatever')).toContain('slate');
  });
});

describe('returns against the principal\'s invoice (REQ-CNF-007)', () => {
  it('knows a credit note still waiting for the principal\'s number', () => {
    expect(principalNumberPending('BY-PRINCIPAL/CLM-0004')).toBe(true);
    expect(principalNumberPending('by-principal/x')).toBe(true);
    expect(principalNumberPending('PCN/24-25/17')).toBe(false);
    expect(principalNumberPending(null)).toBe(false);
  });
  it('sends only lines with a quantity and drops empty fields', () => {
    expect(principalReturnLines([
      { challanLineId: 5, quantity: '2' },
      { productId: '9', batchNo: '', quantity: '0' },
      { productId: '7', batchNo: 'B1', quantity: '3', unitPrice: '10', gstRate: '' },
    ])).toEqual([{ challanLineId: 5, quantity: '2' }, { productId: '7', batchNo: 'B1', quantity: '3', unitPrice: '10' }]);
  });
  it('values the typed lines with GST', () => {
    expect(principalReturnValue([{ quantity: '3', unitPrice: '100', gstRate: '12' }, { quantity: '1', unitPrice: '50' }])).toBe(386);
  });
});
