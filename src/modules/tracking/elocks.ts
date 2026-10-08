/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-010 -- the pure helpers of the Electronic Locks screen: event names and colours, distances, the battery
// and the stop a code may be given for. Tested by elocks.test.ts.

export const ELOCK_SCRIPT = 'database_v2/88_req_wms_020_022_023_trk_010_bond_plant_plug_elock.sql';

export const EVENT_NAMES: Record<string, string> = {
  OPEN: 'Opened', CLOSE: 'Closed', TAMPER: 'Tamper', UNLOCK_GRANTED: 'Code accepted', UNLOCK_REFUSED: 'Unlock refused', LOW_BATTERY: 'Battery low',
};
export const eventName = (t?: string | null) => EVENT_NAMES[String(t)] || String(t || '-');

/** Colour of an event row: red for tamper and for anything away from a stop that raised an alert. */
export function eventStyle(e: { eventType?: string; alertId?: number | null; atPlannedStop?: boolean | null }) {
  if (e.eventType === 'TAMPER') return 'bg-red-50 text-red-800';
  if (e.alertId) return 'bg-amber-50 text-amber-900';
  if (e.eventType === 'UNLOCK_GRANTED' || e.eventType === 'CLOSE') return 'text-emerald-800';
  return '';
}

/** 850 -> "850 m"; 19440 -> "19.4 km" (ElockRules.distance). */
export const distance = (m?: number | null) => {
  if (m === null || m === undefined || !Number.isFinite(Number(m))) return '-';
  const n = Math.round(Number(m));
  return n < 1000 ? `${n} m` : `${(n / 1000).toFixed(1)} km`;
};

/** Where the event happened, in words. */
export function placeText(e: { lockKind?: string; atPlannedStop?: boolean | null; stopName?: string | null; distanceM?: number | null; chamberName?: string | null }) {
  if (e.lockKind === 'CHAMBER_DOOR') return e.chamberName || 'Chamber';
  if (e.atPlannedStop === true) return `At ${e.stopName || 'a planned stop'}`;
  if (e.atPlannedStop === false) return `${distance(e.distanceM)} from ${e.stopName || 'the nearest stop'}`;
  return 'Position not known';
}

export const batteryStyle = (pct?: number | null) =>
  pct == null ? 'text-slate-400' : pct <= 15 ? 'font-bold text-red-700' : pct <= 30 ? 'text-amber-700' : 'text-emerald-700';

export const STATE_STYLE: Record<string, string> = {
  LOCKED: 'bg-emerald-100 text-emerald-800', UNLOCKED: 'bg-amber-100 text-amber-800', UNKNOWN: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-sky-100 text-sky-800', USED: 'bg-emerald-100 text-emerald-800', EXPIRED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-slate-200 text-slate-700', BLOCKED: 'bg-red-100 text-red-800',
};
export const statePill = (s?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATE_STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;

/** A code for a truck lock needs a trip with planned stops; a chamber lock needs neither. '' when the form is complete. */
export function codeFormProblem(lockKind: string | undefined, v: { tripId?: unknown; issuedToName?: unknown; validHours?: unknown }, tripStops?: number) {
  if (!String(v.issuedToName || '').trim()) return 'Type who gets the code';
  const h = v.validHours === undefined || v.validHours === '' || v.validHours === null ? null : Number(v.validHours);
  if (h !== null && (!Number.isFinite(h) || h < 1 || h > 168)) return 'A code is valid for 1 to 168 hours';
  if (lockKind === 'TRUCK_DOOR') {
    if (!v.tripId) return 'Choose the trip; a truck lock opens only at a planned stop of its trip';
    if (tripStops === 0) return 'The trip has no planned stop';
  }
  return '';
}
