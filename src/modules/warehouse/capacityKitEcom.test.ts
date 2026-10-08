/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-018, REQ-WMS-019, REQ-WMS-021 -- the pure helpers of the reserved space, kitting and e-commerce screens.
import { describe, expect, it } from 'vitest';
import { componentNeed, courierLabelHtml, daysBetween, freeStyle, gradeBalance, invoiceHtml, matchScan, maxCommitted, occupancyBar, packTally } from './capacityKitEcom';

describe('reserved space (REQ-WMS-018)', () => {
  it('splits the occupancy bar', () => {
    expect(occupancyBar(100, 60, 20)).toEqual({ used: 60, held: 20, free: 20, over: false });
    expect(occupancyBar(10, 9, 5)).toEqual({ used: 90, held: 10, free: 0, over: true });
    expect(occupancyBar(0, 3, 0).over).toBe(true);
  });
  it('colours the forecast', () => {
    expect(freeStyle(0, 50)).toContain('red');
    expect(freeStyle(4, 50)).toContain('amber');
    expect(freeStyle(20, 50)).toContain('emerald');
  });
  it('counts the days and the most a season commits', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysBetween('2026-10-05', '2026-10-01')).toBe(0);
    expect(maxCommitted(10, '2026-10-01', '2026-10-10', 25)).toBe(2500);
    expect(maxCommitted(10, '2026-10-01', '2026-10-10', null)).toBeNull();
  });
});

describe('kitting and grading (REQ-WMS-019)', () => {
  it('rounds the component need up', () => {
    expect(componentNeed(2, 1, 50)).toBe(100);
    expect(componentNeed(1, 6, 20)).toBe(3.334);
    expect(componentNeed(1, 0, 20)).toBe(0);
  });
  it('checks the sorting balance', () => {
    const b = gradeBalance(1000, [{ weightKg: 600 }, { weightKg: '340' }], 40, 3);
    expect(b).toEqual({ out: 940, accounted: 980, diffPct: 2, ok: true });
    expect(gradeBalance(1000, [{ weightKg: 900 }], 40, 3).ok).toBe(false);
    expect(gradeBalance(0, [], 0, 3).ok).toBe(true);
  });
});

describe('e-commerce (REQ-WMS-021)', () => {
  const lines = [{ productCode: 'ICE-1', barcode: '8901234567890', sku: 'AMZ-ICE', pickedQty: 2 }, { productCode: 'CUP-9', pickedQty: 1 }];
  it('matches a scan by barcode, SKU or code', () => {
    expect(matchScan(lines, '8901234567890')).toBe('ICE-1');
    expect(matchScan(lines, 'amz-ice')).toBe('ICE-1');
    expect(matchScan(lines, 'CUP-9')).toBe('CUP-9');
    expect(matchScan(lines, 'XYZ')).toBeNull();
  });
  it('tallies the pack station', () => {
    expect(packTally(lines, { 'ICE-1': 2, 'CUP-9': 1 }).done).toBe(true);
    const t = packTally(lines, { 'ICE-1': 1, XYZ: 1 });
    expect(t.done).toBe(false);
    expect(t.rows.map(r => r.left)).toEqual([1, 1]);
    expect(t.unknown).toEqual(['XYZ']);
  });
  it('prints the label and the invoice', () => {
    const doc = {
      order: { orderNo: 'EC-1', courier: 'Delhivery', awbNo: 'DLV123456', customerName: 'Asha <A>', shipAddress: '12 MG Road', shipCity: 'Pune', shipState: 'Maharashtra',
        shipPincode: '411001', channel: 'AMAZON', channelOrderRef: '402-1', invoiceNo: 'ECI-1', parcels: [{ parcelNo: 'EC-1-1', weightKg: 1.2 }, { parcelNo: 'EC-1-2' }] },
      seller: { name: 'Brand' }, shipFrom: { name: 'Pune WH', city: 'Pune' }, sameState: true, codToCollect: 398,
      invoiceLines: [{ productName: 'Cup', productCode: 'ICE-1', quantity: 2, unitPrice: 118, taxable: 200, gstRate: 18, cgst: 18, sgst: 18, total: 236 }], taxable: 200, cgst: 18, sgst: 18, total: 236,
    };
    const label = courierLabelHtml(doc);
    expect(label.match(/class="label"/g)).toHaveLength(2);
    expect(label).toContain('1 of 2');
    expect(label).toContain('COD');
    expect(label).toContain('Asha &lt;A&gt;');
    const inv = invoiceHtml(doc);
    expect(inv).toContain('CGST + SGST');
    expect(inv).toContain('ECI-1');
    expect(invoiceHtml({ ...doc, sameState: false })).toContain('IGST');
  });
});
