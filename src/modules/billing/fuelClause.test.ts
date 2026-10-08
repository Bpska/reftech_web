/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-009 -- the fuel clause and surcharge sums of the screen.
import { describe, expect, it } from 'vitest';
import { cityApplies, movedRate, nextThresholds, percent, steps, surcharge } from './fuelClause';

describe('diesel price steps', () => {
  it('counts the whole steps crossed', () => {
    expect(steps(90, 2, 94.1)).toBe(2);
    expect(steps(90, 2, 91.9)).toBe(0);
    expect(steps(90, 2, 86)).toBe(-2);
    expect(steps(90, 0, 94)).toBe(0);
  });
  it('turns the steps into a %', () => {
    expect(percent(90, 2, 1.5, 94.1, false)).toBe(3);
    expect(percent(90, 2, 1.5, 86, false)).toBe(-3);
    expect(percent(90, 2, 1.5, 86, true)).toBe(0);
  });
  it('moves the rate', () => {
    expect(movedRate(18000, 3)).toBe(18540);
    expect(movedRate(42.5, -3)).toBe(41.23);
    expect(movedRate(18000, 0)).toBe(18000);
  });
  it('says the next prices that move the rate', () => {
    expect(nextThresholds(90, 2, 94.1)).toEqual({ up: 96, down: 94 });
    expect(nextThresholds(90, 0, 94)).toBeNull();
  });
});

describe('surcharges', () => {
  it('charges a flat amount per docket', () => {
    expect(surcharge({ basis: 'FLAT', rate: 100 }, { dockets: 3 })).toBe(300);
  });
  it('charges per km beyond the served area with a minimum', () => {
    expect(surcharge({ basis: 'PER_KM_BEYOND', rate: 25, freeUnits: 10, minCharge: 500 }, { odaKm: 35 })).toBe(625);
    expect(surcharge({ basis: 'PER_KM_BEYOND', rate: 25, freeUnits: 10, minCharge: 500 }, { odaKm: 15 })).toBe(500);
    expect(surcharge({ basis: 'PER_KM_BEYOND', rate: 25, freeUnits: 10, minCharge: 500 }, { odaKm: 5 })).toBe(0);
  });
  it('charges a % of the goods value and keeps the ceiling', () => {
    expect(surcharge({ basis: 'PERCENT_GOODS_VALUE', rate: 0.2, minCharge: 250 }, { goodsValue: 500000 })).toBe(1000);
    expect(surcharge({ basis: 'PERCENT_GOODS_VALUE', rate: 0.2, minCharge: 250, maxCharge: 750 }, { goodsValue: 500000 })).toBe(750);
  });
  it('charges a % of the freight and per kg', () => {
    expect(surcharge({ basis: 'PERCENT_FREIGHT', rate: 2 }, { freight: 18540 })).toBe(370.8);
    expect(surcharge({ basis: 'PER_KG', rate: 0.5, freeUnits: 1000 }, { weightKg: 9000 })).toBe(4000);
  });
  it('charges a city rule only in that city', () => {
    const green = { basis: 'FLAT', rate: 1500, cities: 'Delhi, Gurugram' };
    expect(surcharge(green, { city: 'delhi' })).toBe(1500);
    expect(surcharge(green, { city: 'Kolkata' })).toBe(0);
    expect(cityApplies(null, 'Kolkata')).toBe(true);
    expect(cityApplies('', undefined)).toBe(true);
  });
});
