/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-012 -- the month's working of the Dedicated Vehicles screen.
import { describe, expect, it } from 'vitest';
import { countDays, daysInMonth, perDayRate, tripKm, working } from './dedicated';

const TERMS = {
  fixedMonthlyAmount: 155000, fixedBasisDays: 30, includedKmPerMonth: 2000, extraKmRate: 22,
  includedDaysPerMonth: null, extraDayRate: null, deductionBasis: 'PRORATA', deductionPerDay: null,
  freeDowntimeDays: 0, gstRate: 18,
};

describe('the month', () => {
  it('counts its days', () => {
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('bad')).toBe(0);
  });
  it('gives the per-day rate', () => {
    expect(perDayRate(TERMS)).toBe(5166.67);
    expect(perDayRate({ ...TERMS, deductionBasis: 'PER_DAY', deductionPerDay: 4000 })).toBe(4000);
    expect(perDayRate({ ...TERMS, deductionBasis: 'NONE' })).toBe(0);
  });
});

describe('the working of a full month', () => {
  it('charges the fixed amount with no extras', () => {
    const w = working(TERMS, 30, 30, 0, 1800, 20);
    expect(w.fixed).toBe(155000);
    expect(w.deduction).toBe(0);
    expect(w.extraKm).toBe(0);
    expect(w.taxable).toBe(155000);
    expect(w.tax).toBe(27900);
    expect(w.total).toBe(182900);
  });
  it('deducts the days the truck was not available, pro-rata, without carrying the rounding', () => {
    const w = working(TERMS, 30, 30, 3, 2460, 20);
    expect(w.deductedDays).toBe(3);
    expect(w.perDay).toBe(5166.67);
    expect(w.deduction).toBe(15500);
    expect(w.extraKm).toBe(460);
    expect(w.extraKmAmount).toBe(10120);
    expect(w.taxable).toBe(149620);
    expect(w.total).toBe(176551.6);
  });
  it('keeps the free downtime days', () => {
    const w = working({ ...TERMS, freeDowntimeDays: 2 }, 30, 30, 3, 0, 0);
    expect(w.deductedDays).toBe(1);
    expect(w.deduction).toBe(5166.67);
  });
  it('charges a typed rate per day when the contract says PER_DAY', () => {
    const w = working({ ...TERMS, deductionBasis: 'PER_DAY', deductionPerDay: 4000 }, 30, 30, 2, 0, 0);
    expect(w.deduction).toBe(8000);
  });
  it('charges nothing when the contract deducts nothing', () => {
    expect(working({ ...TERMS, deductionBasis: 'NONE' }, 30, 30, 5, 0, 0).deduction).toBe(0);
  });
});

describe('part of a month and included days', () => {
  it('shares the fixed charge and the included km over the days in force', () => {
    const w = working(TERMS, 16, 31, 0, 3500, 10);
    expect(w.fixed).toBe(82666.67);
    expect(w.extraKm).toBe(2467.7);   // included 1032.3 km of 2000
  });
  it('charges the days used beyond the included days', () => {
    const w = working({ ...TERMS, includedDaysPerMonth: 24, extraDayRate: 4000 }, 30, 30, 0, 0, 26);
    expect(w.extraDays).toBe(2);
    expect(w.extraDayAmount).toBe(8000);
  });
});

describe('the calendar and the trips', () => {
  it('counts the days by status', () => {
    expect(countDays([{ status: 'ON_TRIP' }, { status: 'ON_TRIP' }, { status: 'BREAKDOWN' }, { status: 'CUSTOMER_IDLE' }, { status: 'AVAILABLE' }]))
      .toEqual({ unavailable: 1, used: 2, idle: 1 });
  });
  it('takes the km from the odometer when it looks right', () => {
    expect(tripKm(120000, 120452, 445)).toBe(452);
    expect(tripKm(null, null, 545)).toBe(545);
    expect(tripKm(120000, 120000, 445)).toBe(445);     // no movement read
    expect(tripKm(120000, 130000, 445)).toBe(445);     // 10000 km is not believable
  });
});
