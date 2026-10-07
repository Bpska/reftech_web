/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-001, 002, 010, 011 -- what the planning board, the trip approval panel and the load screens share.
//
// Backend: DispatchController (/api/dispatch/**). Until database_v2/40_dispatch_and_quality_hold.sql is run the
// board shows trucks, trips and open loads, and says that approval, delivery windows and the change log need the script.
import { api } from '@/shared/services/api';

export const SCRIPT = 'database_v2/40_dispatch_and_quality_hold.sql';
export { role, when, iso, indiaDay } from '@/modules/allocation/allocation';

export type ReadinessItem = { code: string; level: 'REFUSE' | 'APPROVAL' | 'WARN'; text: string };
export type Readiness = { vehicleId: number; items: ReadinessItem[]; refused: boolean; needsApproval: boolean; manager: boolean };

export const LEVEL_TEXT: Record<string, string> = { REFUSE: 'Not allowed', APPROVAL: 'Manager approval', WARN: 'Note' };
export const LEVEL_STYLE: Record<string, string> = {
  REFUSE: 'bg-red-100 text-red-800', APPROVAL: 'bg-amber-100 text-amber-800', WARN: 'bg-sky-100 text-sky-800',
};
export const APPROVAL_TEXT: Record<string, string> = { PENDING: 'Waiting for approval', APPROVED: 'Approved' };
export const APPROVAL_STYLE: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800' };

/** The readiness of one truck for a booking (service, breakdown, insurance, permit, fitness, transporter). */
export function readinessOf(vehicleId: string | number, start?: string, end?: string): Promise<Readiness> {
  const q = new URLSearchParams({ vehicleId: String(vehicleId) });
  if (start) q.set('start', start);
  if (end) q.set('end', end);
  return api(`/api/dispatch/readiness?${q}`);
}

/** The refusal that a tick "Use this truck anyway" and a reason can answer (a Manager only). */
export const needsReadinessTick = (message: string) => /Use this truck anyway/i.test(message);

/** A datetime-local value (this computer's time) from an exact moment, for editing. */
export const localInput = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** "5", "5.25" -- a ton or rupee number without trailing zeros. */
export const plain = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(Number(v)));
