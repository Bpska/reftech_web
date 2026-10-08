/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-016 -- what the Eutectic Plates screen needs besides React: the hold time a charge gives on a hot day (the
// same rule as EutecticRules on the backend), whether a planned trip fits inside it, the minutes left as text and
// the colour of a state. Pure functions (no React) so eutectic.test.ts can test them.

export const EU = '/api/coldchain/eutectic';

/** The hold time in minutes: holdHours, less deratePercentPerC per °C of ambient above the reference (never more). */
export function holdMinutes(holdHours: number, ambientC: number | null | undefined, referenceC: number | null | undefined, deratePercentPerC: number) {
  let m = holdHours * 60;
  if (ambientC !== null && ambientC !== undefined && referenceC !== null && referenceC !== undefined && ambientC > referenceC)
    m = m * Math.max(0, 1 - ((ambientC - referenceC) * deratePercentPerC) / 100);
  return Math.max(0, Math.floor(m));
}

/** OK, TIGHT (less than the margin to spare) or OVER (the planned arrival is after the plates run out). */
export function fits(plannedEnd: string | Date | null | undefined, holdUntil: string | Date | null | undefined, marginMinutes: number) {
  if (!plannedEnd || !holdUntil) return null;
  const spare = Math.floor((new Date(holdUntil).getTime() - new Date(plannedEnd).getTime()) / 60000);
  return { spare, state: spare < 0 ? 'OVER' : spare < marginMinutes ? 'TIGHT' : 'OK' };
}

/** 200 -> "3 h 20 min"; a negative number reads "... ago" when ago is true. */
export function hoursText(min?: number | null, ago = false) {
  if (min === null || min === undefined || Number.isNaN(Number(min))) return '-';
  const m = Math.abs(Math.round(Number(min)));
  const t = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return Number(min) < 0 && ago ? `${t} ago` : t;
}

/** The tone of a trip or charge state for the shared state pill. */
export function stateTone(state?: string | null) {
  switch (String(state || '')) {
    case 'OK': case 'CHARGED': return 'OK';
    case 'TIGHT': return 'DUE_SOON';
    case 'OVER': case 'NOT_QUALIFIED': case 'STARTS_BEFORE_CHARGE_ENDS': return 'OVER';
    case 'SPENT': case 'CANCELLED': return 'INACTIVE';
    default: return 'NOT_SET';
  }
}

/** Plain words for the trip states. */
export const STATE_TEXT: Record<string, string> = {
  OK: 'Fits', TIGHT: 'Tight', OVER: 'Runs out on the way', NOT_QUALIFIED: 'Charge not qualified', NO_CHARGE: 'No charge', STARTS_BEFORE_CHARGE_ENDS: 'Starts before charged',
};
