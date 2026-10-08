/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-013, REQ-TAL-014, REQ-TAL-015 -- what the lane tender, free truck and invoice intake screens (staff and
// transporter portal) share: labels, the award split check, the check summary and the debit note moves.
// The backend checks everything again; these only help the screen say early what is wrong.
//
// Backend: LaneTenderController, FreeTruckController, InvoiceIntakeController (/api/transporters/...) and the
// portal controllers (/api/transporter-portal/...). Tables: database_v2/92_..., permissions: 93_... on reftech_hr.

export const SCRIPT_92 = 'database_v2/92_req_tal_013_014_015_lane_tender_free_trucks_invoices.sql';

export const LANE_TENDER_STATE: Record<string, string> = {
  DRAFT: 'Draft', OPEN: 'Round open', EVALUATION: 'Round closed', AWARDED: 'Awarded', CONVERTED: 'Contracts made', CANCELLED: 'Cancelled',
};
export const FREE_TRUCK_STATE: Record<string, string> = { OPEN: 'Free', MATCHED: 'Load given', WITHDRAWN: 'Withdrawn', EXPIRED: 'Expired' };
export const INVOICE_STATE: Record<string, string> = {
  RECEIVED: 'Received', REVIEW: 'Waiting for review', BILLED: 'Bill made', AUTO_APPROVED: 'Approved automatically', REJECTED: 'Rejected', DUPLICATE: 'Duplicate',
};
export const NOTE_STATE: Record<string, string> = {
  RAISED: 'Waiting for the transporter', ACCEPTED: 'Accepted', DISPUTED: 'Disputed', CONFIRMED: 'Confirmed by RefTech', WITHDRAWN: 'Withdrawn',
};
export const NOTE_REASON: Record<string, string> = { SHORTAGE: 'Shortage', DAMAGE: 'Damage', TEMPERATURE: 'Temperature', LATE_DELIVERY: 'Late delivery', OTHER: 'Other' };
export const SOURCE_LABEL: Record<string, string> = { EMAIL: 'Email', PORTAL: 'Portal upload', E_INVOICE: 'E-invoice', STAFF: 'Typed by staff' };

const STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', OPEN: 'bg-sky-100 text-sky-800', EVALUATION: 'bg-amber-100 text-amber-800', AWARDED: 'bg-emerald-100 text-emerald-800',
  CONVERTED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-slate-200 text-slate-600', MATCHED: 'bg-emerald-100 text-emerald-800', WITHDRAWN: 'bg-slate-200 text-slate-600',
  EXPIRED: 'bg-slate-200 text-slate-600', RECEIVED: 'bg-sky-100 text-sky-800', REVIEW: 'bg-amber-100 text-amber-800', BILLED: 'bg-emerald-100 text-emerald-800',
  AUTO_APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800', DUPLICATE: 'bg-red-100 text-red-800', RAISED: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800', DISPUTED: 'bg-red-100 text-red-800', CONFIRMED: 'bg-emerald-100 text-emerald-800',
  PASS: 'bg-emerald-100 text-emerald-800', WARN: 'bg-amber-100 text-amber-800', FAIL: 'bg-red-100 text-red-800',
};
export const badge = (s?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;

/** "L1", "L2" ... for a rank; "-" when the bidder has no rate on the lane. */
export const rankLabel = (rank?: number | null) => (rank ? `L${rank}` : '-');

export type Share = { transporterId: number; sharePercent: number };

/** The shares of a lane award, read from the form (empty or 0 shares are left out). */
export function sharesFrom(values: Record<number, string | number | undefined>): Share[] {
  return Object.entries(values)
    .map(([id, v]) => ({ transporterId: Number(id), sharePercent: Number(String(v ?? '').replace(',', '.')) }))
    .filter(s => Number.isFinite(s.sharePercent) && s.sharePercent > 0);
}

/** What is wrong with the split of one lane, or null. Same rules as LaneTenderRules.checkAward (at most 3, adds up to 100). */
export function splitProblem(shares: Share[], bidders: number[], maxSplit = 3): string | null {
  if (shares.length === 0) return 'Give at least one transporter a share, or mark the lane as not awarded';
  if (shares.length > maxSplit) return `A lane is split between at most ${maxSplit} transporters`;
  const ids = new Set<number>();
  for (const s of shares) {
    if (ids.has(s.transporterId)) return 'A transporter is listed twice';
    ids.add(s.transporterId);
    if (!bidders.includes(s.transporterId)) return 'A share is given to a transporter without a bid on this lane';
    if (Math.abs(Math.round(s.sharePercent * 100) - s.sharePercent * 100) > 1e-6) return 'Shares have at most 2 decimals';
  }
  const total = Math.round(shares.reduce((a, s) => a + s.sharePercent, 0) * 100) / 100;
  return total === 100 ? null : `The shares add up to ${total} %, not 100 %`;
}

/** True when the award passes over a cheaper bidder or gives a dearer one more: the backend then asks for a reason. */
export function needsReason(shares: Share[], ranking: { transporterId: number; rank: number }[]): boolean {
  const rankOf = new Map(ranking.map(r => [r.transporterId, r.rank]));
  const chosen = shares.map(s => ({ ...s, rank: rankOf.get(s.transporterId) ?? 99 })).sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < chosen.length; i++) if (chosen[i].rank !== i + 1) return true;
  for (let i = 1; i < chosen.length; i++) if (chosen[i].sharePercent > chosen[i - 1].sharePercent) return true;
  return false;
}

/** How many checks of an invoice passed, warned and failed. */
export function checkCounts(checks: { result?: string }[] = []) {
  const out = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const c of checks) if (c.result === 'PASS' || c.result === 'WARN' || c.result === 'FAIL') out[c.result]++;
  return out;
}

/** The tolerance as the screen says it: "2 % of the expected, at most ₹500". */
export function toleranceText(s?: { tolerancePercent?: number | string | null; toleranceAmount?: number | string | null } | null) {
  if (!s) return '';
  const pc = Number(s.tolerancePercent ?? 0), cap = Number(s.toleranceAmount ?? 0);
  if (!pc && !cap) return 'no tolerance: the bill must match exactly';
  if (!cap) return `${pc} % of the expected amount`;
  if (!pc) return `₹${cap}`;
  return `${pc} % of the expected amount, at most ₹${cap}`;
}

/** The actions on a debit note: the transporter accepts or disputes a raised note; RefTech confirms a dispute or withdraws. Same as InvoiceRules.move. */
export function noteActions(status: string, staff: boolean): string[] {
  if (staff) return status === 'DISPUTED' ? ['confirm', 'withdraw'] : status === 'RAISED' ? ['withdraw'] : [];
  return status === 'RAISED' ? ['accept', 'dispute'] : [];
}

/** A datetime-local value for an input (India time, as the backend reads a time without zone). */
export function localInput(d: Date) {
  const india = new Date(d.getTime() + 330 * 60000);
  return india.toISOString().slice(0, 16);
}

/** The WhatsApp quick reply a transporter can send for an offer (shown on the portal next to the buttons). */
export const quickReply = (offerId: number) => `YES ${offerId} · NO ${offerId} · QUOTE ${offerId} <amount>`;
