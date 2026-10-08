/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-011 -- the expiry bands of the Agreement Vault screen. Pure functions, no network and no React.

/** The alert days the company uses: 60, 30, 15 and 7 days before the end date. */
export const STAGES = [60, 30, 15, 7] as const;

/** Days left: 14 = expires in a fortnight, -1 = expired yesterday, null = no end date (open-ended). */
export function daysLeft(validTo: string | null | undefined, today: string): number | null {
  if (!validTo) return null;
  const a = Date.parse(validTo + 'T00:00:00Z'), b = Date.parse(today + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

/** The band an agreement is in, for the colour and the sort. */
export function band(days: number | null): 'open-ended' | 'expired' | 'expiring-7' | 'expiring-15' | 'expiring-30' | 'expiring-60' | 'ok' {
  if (days === null) return 'open-ended';
  if (days < 0) return 'expired';
  if (days <= 7) return 'expiring-7';
  if (days <= 15) return 'expiring-15';
  if (days <= 30) return 'expiring-30';
  if (days <= 60) return 'expiring-60';
  return 'ok';
}

/** The next alert still to go out, or null when the last one has passed. */
export function nextStage(days: number | null): number | null {
  if (days === null || days < 0) return null;
  for (let i = STAGES.length - 1; i >= 0; i--) if (days <= STAGES[i]) return STAGES[i];
  return null;
}

/** What the screen says about the agreement in one short line. */
export function expiryNote(days: number | null): string {
  if (days === null) return 'No end date';
  if (days < 0) return `Expired ${-days} ${-days === 1 ? 'day' : 'days'} ago - the rates are locked`;
  if (days === 0) return 'Expires today';
  const extra = days <= 15 ? ' - escalated to the manager' : days <= 30 ? ' - renewal prompt sent' : '';
  return `Expires in ${days} ${days === 1 ? 'day' : 'days'}${extra}`;
}

/** Renewal dates suggested from the old term: the day after it ends, for the same number of days. */
export function renewalDates(validFrom: string, validTo: string): { from: string; to: string } | null {
  const f = Date.parse(validFrom + 'T00:00:00Z'), e = Date.parse(validTo + 'T00:00:00Z');
  if (Number.isNaN(f) || Number.isNaN(e) || e < f) return null;
  const day = 86400000;
  const newFrom = e + day;
  return { from: iso(newFrom), to: iso(newFrom + (e - f)) };
}

/** Does the agreement lock the rates it governs? Only an expired or terminated one does. */
export function ratesLocked(status: string, days: number | null): boolean {
  if (status === 'TERMINATED' || status === 'EXPIRED') return true;
  return days !== null && days < 0;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
