/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-009 -- the sums the Fuel & Surcharges screen shows. Pure functions, no network and no React.
// The backend decides the rate that is billed (FuelRules, SurchargeRules); these only show the working.

/** Steps the diesel price has moved from the base: Rs 90 base, Rs 2 step, price Rs 94.10 -> 2 steps. */
export function steps(base: number, step: number, price: number): number {
  if (!(step > 0) || !(base > 0) || !(price > 0)) return 0;
  return Math.trunc((price - base) / step);
}

/** The % the rate moves: steps x % per step, 0 when the clause only moves up and the price fell. */
export function percent(base: number, step: number, pctPerStep: number, price: number, upOnly: boolean): number {
  const n = steps(base, step, price);
  if (upOnly && n < 0) return 0;
  return round(n * (pctPerStep || 0), 3);
}

/** The rate after the fuel %, to paise. */
export function movedRate(rate: number, pct: number): number {
  return round((rate || 0) * (1 + (pct || 0) / 100), 2);
}

/** The next price up and the next price down that would move the rate again. */
export function nextThresholds(base: number, step: number, price: number): { up: number; down: number } | null {
  if (!(step > 0) || !(base > 0)) return null;
  const n = steps(base, step, price);
  return { up: round(base + (n + 1) * step, 2), down: round(base + n * step, 2) };
}

/** What a surcharge rule comes to for one consignment; mirrors SurchargeRules on the server. */
export function surcharge(rule: { basis: string; rate: number; minCharge?: number | null; maxCharge?: number | null; freeUnits?: number | null; cities?: string | null },
                          s: { freight?: number; weightKg?: number; goodsValue?: number; odaKm?: number; city?: string; dockets?: number }): number {
  if (!cityApplies(rule.cities, s.city)) return 0;
  const free = rule.freeUnits || 0, rate = rule.rate || 0;
  let amount = 0;
  switch (rule.basis) {
    case 'FLAT': amount = rate * Math.max(1, s.dockets || 1); break;
    case 'PER_KG': amount = rate * Math.max(0, (s.weightKg || 0) - free); break;
    case 'PERCENT_FREIGHT': amount = (rate / 100) * (s.freight || 0); break;
    case 'PERCENT_GOODS_VALUE': amount = (rate / 100) * (s.goodsValue || 0); break;
    case 'PER_KM_BEYOND': amount = rate * Math.max(0, (s.odaKm || 0) - free); break;
    case 'PER_KG_PER_KM_BEYOND': amount = rate * (s.weightKg || 0) * Math.max(0, (s.odaKm || 0) - free); break;
    default: amount = 0;
  }
  if (amount > 0 && rule.minCharge && amount < rule.minCharge) amount = rule.minCharge;
  if (rule.maxCharge && amount > rule.maxCharge) amount = rule.maxCharge;
  return round(amount, 2);
}

/** A rule with no city list applies everywhere; otherwise only to the cities named (case does not matter). */
export function cityApplies(cities: string | null | undefined, city: string | null | undefined): boolean {
  const list = String(cities || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(String(city || '').trim().toLowerCase());
}

/** Rupees, rounded to the given places (2 for money). */
export function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round((n + Number.EPSILON) * f) / f;
}
