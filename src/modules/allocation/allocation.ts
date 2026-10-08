/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-003, REQ-TAL-007 -- what the vehicle request and truck calendar screens share: times in India time,
// the block types, the weather-confirmation check and the freight quote of a hired truck.
//
// Backend: AllocationController (/api/allocation/**), FreightController (/api/transporters/freight/quote).
import { api } from '@/shared/services/api';
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SCRIPT = 'database_v2/34_req_tal_003_007_011_allocation_freight.sql';
export { role, rupees, tag } from '@/modules/transporter/transporter';

/** "07 Oct 2026, 10:03 am" in India time. */
export const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
/** A datetime-local value (time of this computer) as one exact moment, or '' when empty. */
export const iso = (v?: string | null) => { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
/** The India date (YYYY-MM-DD) of a moment. */
export const indiaDay = (v: Date | string = new Date()) => new Date(v).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const REQUEST_STATUS: Record<string, string> = { OPEN: 'Waiting for a truck', ASSIGNED: 'Truck given', CANCELLED: 'Cancelled' };
export const REQUEST_STYLE: Record<string, string> = { OPEN: 'bg-amber-100 text-amber-800', ASSIGNED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-slate-200 text-slate-600' };

export const TRUCK_BLOCKS: [string, string][] = [['SERVICE', 'Service day'], ['BREAKDOWN', 'Breakdown'], ['OFF_ROAD', 'Off road'], ['OTHER', 'Other']];
export const DRIVER_BLOCKS: [string, string][] = [['LEAVE', 'Leave'], ['TRAINING', 'Training'], ['OTHER', 'Other']];

/** The refusal of Create Trip that a tick "I have seen these warnings" and a reason can answer (not a Red block). */
export const needsWeatherTick = (message: string) => /weather warning/i.test(message) && /Tick "I have seen these warnings"/i.test(message);

/** A truck not owned by RefTech: its freight is booked from the transporter's contract, or agreed by hand. */
export const isHired = (ownershipType?: string | null) => !!ownershipType && ownershipType !== 'OWN';

/** The contract freight of a hired truck for a lane (FreightService.quote). */
export function freightQuote(q: { vehicleId: string | number; from?: string; to?: string; tons?: string | number | null; temperatureProfileId?: string | number | null; targetC?: string | number | null; date?: string }) {
  const p = new URLSearchParams({ vehicleId: String(q.vehicleId) });
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.tons !== null && q.tons !== undefined && q.tons !== '') p.set('tons', String(q.tons));
  if (q.temperatureProfileId) p.set('temperatureProfileId', String(q.temperatureProfileId));
  if (!q.temperatureProfileId && q.targetC !== null && q.targetC !== undefined && q.targetC !== '') p.set('targetC', String(q.targetC));
  if (q.date) p.set('date', q.date);
  return api(`/api/transporters/freight/quote?${p}`);
}
