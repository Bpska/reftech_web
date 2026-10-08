/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-010 -- what the Collections screen works out for itself. Pure functions, no network and no React.

export type Bill = { id: number; dueDate?: string | null; outstanding?: number; partnerName?: string | null; promisedDate?: string | null };
export type Setting = { daysBefore: number; onDue: boolean; overdueDays: string; channels: string };

/** Days from today to the due date: 3 = due in three days, -8 = eight days overdue, null = no due date. */
export function daysToDue(dueDate: string | null | undefined, today: string): number | null {
  if (!dueDate) return null;
  const a = Date.parse(dueDate + 'T00:00:00Z'), b = Date.parse(today + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

/** The bucket of a bill: 'due-later', 'due-soon' (inside the reminder days), 'due-today' or 'overdue'. */
export function bucket(days: number | null, daysBefore: number): 'no-due-date' | 'due-later' | 'due-soon' | 'due-today' | 'overdue' {
  if (days === null) return 'no-due-date';
  if (days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  return days <= (daysBefore || 0) ? 'due-soon' : 'due-later';
}

/** The reminder stages of the settings, in the order they are sent: 7 (before), 0 (on the day), -1, -7 ... */
export function stages(s: Setting): number[] {
  const out: number[] = [];
  if (s.daysBefore > 0) out.push(s.daysBefore);
  if (s.onDue) out.push(0);
  for (const part of String(s.overdueDays || '').split(',')) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n > 0 && !out.includes(-n)) out.push(-n);
  }
  return out;
}

/** The ageing buckets of the open bills, for the summary line. */
export function ageing(bills: Bill[], today: string): { label: string; count: number; amount: number }[] {
  const rows = [
    { label: 'Not due', count: 0, amount: 0 },
    { label: '1-30 days', count: 0, amount: 0 },
    { label: '31-60 days', count: 0, amount: 0 },
    { label: '61-90 days', count: 0, amount: 0 },
    { label: 'Over 90 days', count: 0, amount: 0 },
  ];
  for (const b of bills) {
    const d = daysToDue(b.dueDate, today);
    const over = d === null ? 0 : -d;
    const i = over <= 0 ? 0 : over <= 30 ? 1 : over <= 60 ? 2 : over <= 90 ? 3 : 4;
    rows[i].count += 1;
    rows[i].amount = round2(rows[i].amount + Number(b.outstanding || 0));
  }
  return rows;
}

/** Is this promise late? A promise whose date has passed and is still open needs a follow-up. */
export function promiseLate(promisedDate: string | null | undefined, status: string, today: string, graceDays = 0): boolean {
  if (status !== 'OPEN') return false;
  const d = daysToDue(promisedDate, today);
  return d !== null && d < -graceDays;
}

/** The amount a bank credit still has to place: credit - TDS - what is already allocated. */
export function unplaced(credit: number, tds: number, allocated: number): number {
  return round2(Math.max(0, (credit || 0) - (tds || 0) - (allocated || 0)));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
