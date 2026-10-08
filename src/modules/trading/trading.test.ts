/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-009 -- trading screen helpers.
import { describe, expect, it } from 'vitest';
import { ageingTotals, lineValue, linesToSend, marginTone, preview, tabOf } from './trading';

describe('trading helpers', () => {
  it('works out line values and the order preview', () => {
    expect(lineValue({ productId: '1', quantity: '10', price: '150', discountPct: '10', gstRate: '18' })).toBe(1350);
    expect(preview([{ productId: '1', quantity: '100', price: '150', gstRate: '18' }, { productId: '2', quantity: '2', price: '5.5', gstRate: '5' }]))
      .toEqual({ taxable: 15011, gst: 2700.55, total: 17711.55 });
    expect(preview([])).toEqual({ taxable: 0, gst: 0, total: 0 });
  });
  it('sends only complete lines with the right price field', () => {
    const lines = [{ productId: '11', quantity: '120', price: '90', gstRate: '18' }, { productId: '', quantity: '5', price: '1', gstRate: '0' }, { productId: '3', quantity: '0', price: '1', gstRate: '0' }];
    expect(linesToSend(lines, 'PO')).toEqual([{ productId: 11, quantity: 120, unitCost: 90, gstRate: 18 }]);
    expect(linesToSend(lines, 'SO')).toEqual([{ productId: 11, quantity: 120, unitPrice: 90, discountPct: 0, gstRate: 18 }]);
  });
  it('colours the margin and adds the ageing', () => {
    expect(marginTone(-1, 5)).toContain('red');
    expect(marginTone(3, 5)).toContain('amber');
    expect(marginTone(36.7, 5)).toContain('emerald');
    expect(marginTone(null, 5)).toContain('slate');
    expect(ageingTotals([{ NOT_DUE: 100, '0-30': 50, total: 150 }, { '90+': 20, total: 20 }])).toEqual({ total: 170, NOT_DUE: 100, '0-30': 50, '31-60': 0, '61-90': 0, '90+': 20 });
    expect(tabOf('stock')).toBe('stock');
    expect(tabOf('nonsense')).toBe('buy');
  });
});
