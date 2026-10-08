/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-012 -- the month's working the Dedicated Vehicles screen shows. Pure functions, no network and no React.
// The server (DedicatedRules) is what the bill is built from; this shows the same sum while the user types.

/** The statuses a day of the truck calendar can have. */
export const STATUSES = ['AVAILABLE', 'ON_TRIP', 'CUSTOMER_IDLE', 'BREAKDOWN', 'MAINTENANCE', 'NO_DRIVER', 'OFF_HIRE'] as const;
/** The days that are deducted: the truck was not there for the customer. */
export const UNAVAILABLE = ['BREAKDOWN', 'MAINTENANCE', 'NO_DRIVER', 'OFF_HIRE'];

export type Terms = {
  fixedMonthlyAmount: number; fixedBasisDays: number; includedKmPerMonth?: number | null; extraKmRate?: number | null;
  includedDaysPerMonth?: number | null; extraDayRate?: number | null; deductionBasis: string; deductionPerDay?: number | null;
  freeDowntimeDays?: number | null; gstRate?: number | null;
};

export type Working = {
  fixed: number; perDay: number; deductedDays: number; deduction: number;
  extraKm: number; extraKmAmount: number; extraDays: number; extraDayAmount: number;
  taxable: number; tax: number; total: number;
};

/** Days of the month 'YYYY-MM' (28 to 31), 0 when the month is not a month. */
export function daysInMonth(month: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return 0;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) return 0;
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** The per-day rate shown on the bill: the monthly charge over the basis days, or the typed rate, or nothing. */
export function perDayRate(t: Terms): number {
  if (t.deductionBasis === 'NONE') return 0;
  if (t.deductionBasis === 'PER_DAY') return round2(t.deductionPerDay || 0);
  return t.fixedBasisDays > 0 ? round2((t.fixedMonthlyAmount || 0) / t.fixedBasisDays) : 0;
}

/** The whole month's working: fixed charge, deduction, extra km and extra days, GST on top. */
export function working(t: Terms, periodDays: number, monthDays: number, unavailableDays: number, totalKm: number, usedDays: number): Working {
  const basis = t.fixedBasisDays > 0 ? t.fixedBasisDays : 30;
  const fixed = round2(((t.fixedMonthlyAmount || 0) * periodDays) / basis);
  const deductedDays = Math.max(0, unavailableDays - (t.freeDowntimeDays || 0));
  const perDay = perDayRate(t);
  // Pro-rata in one step, so the rounding of the per-day rate does not creep into the total (same as the server).
  const raw = t.deductionBasis === 'PRORATA' ? ((t.fixedMonthlyAmount || 0) * deductedDays) / basis : perDay * deductedDays;
  const deduction = round2(Math.min(raw, fixed));
  const full = periodDays === monthDays;
  const inclKm = t.includedKmPerMonth == null ? 0 : full || monthDays < 1 ? t.includedKmPerMonth : round1((t.includedKmPerMonth * periodDays) / monthDays);
  const extraKm = round1(Math.max(0, (totalKm || 0) - inclKm));
  const extraKmAmount = round2(extraKm * (t.extraKmRate || 0));
  const inclDays = t.includedDaysPerMonth == null ? null : full || monthDays < 1 ? t.includedDaysPerMonth : Math.floor((t.includedDaysPerMonth * periodDays) / monthDays);
  const extraDays = inclDays == null ? 0 : Math.max(0, (usedDays || 0) - inclDays);
  const extraDayAmount = round2(extraDays * (t.extraDayRate || 0));
  const taxable = round2(Math.max(0, fixed - deduction + extraKmAmount + extraDayAmount));
  const tax = round2((taxable * (t.gstRate || 0)) / 100);
  return { fixed, perDay, deductedDays, deduction, extraKm, extraKmAmount, extraDays, extraDayAmount, taxable, tax, total: round2(taxable + tax) };
}

/** Counts the calendar: days not available, days the truck ran and days the customer kept it idle. */
export function countDays(days: { status: string }[]): { unavailable: number; used: number; idle: number } {
  let unavailable = 0, used = 0, idle = 0;
  for (const d of days) {
    if (UNAVAILABLE.includes(d.status)) unavailable++;
    else if (d.status === 'ON_TRIP') used++;
    else if (d.status === 'CUSTOMER_IDLE') idle++;
  }
  return { unavailable, used, idle };
}

/** The km of a trip: the odometer when both readings look right, else the planned distance. */
export function tripKm(startOdo: number | null | undefined, endOdo: number | null | undefined, plannedKm: number | null | undefined): number {
  if (startOdo != null && endOdo != null) {
    const d = Number(endOdo) - Number(startOdo);
    if (d >= 1 && d <= 5000) return round1(d);
  }
  return round1(Number(plannedKm || 0));
}

export function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
export function round1(n: number): number { return Math.round((n + Number.EPSILON) * 10) / 10; }
