/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-004, 006, 008, 009 -- what the dispatch desk screens share (docks, gate, reports, setup, documents, one load).
//
// Backend: DispatchPlanController (/api/dispatch/**). Until database_v2/64_dispatch_planning.sql is run the endpoints
// answer { ready: false, message } or refuse with "The dispatch planning tables are not in the database yet".
import { indiaDay } from '../dispatch';
import { fmtMoney, fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SCRIPT64 = 'database_v2/64_dispatch_planning.sql';

/** True for the answer or the error of an endpoint whose script 64 has not been run. */
export const notReady = (x: any) => (x && x.ready === false) || /dispatch planning tables are not in the database/i.test(typeof x === 'string' ? x : '');

/** A YYYY-MM-DD India day moved by n days. */
export const addDays = (day: string, n: number) => indiaDay(new Date(new Date(`${day}T12:00:00+05:30`).getTime() + n * 86400000));

/** "10:30" India time of a moment. */
export const hhmm = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtTime(d);
};

/** "45 min" or "2 h 05 min". */
export const minutes = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return '-';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  return a < 60 ? `${s}${a} min` : `${s}${Math.floor(a / 60)} h ${String(a % 60).padStart(2, '0')} min`;
};

/** "12.5 %" or "-". */
export const pct = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : `${Number(v)} %`);

/** Rupees without decimals, "-" when empty. */
export const inr = (v: unknown) => fmtMoney(v as any, 0);

export const SLOT_TEXT: Record<string, string> = {
  BOOKED: 'Booked', IN_YARD: 'In the yard', LOADING: 'Loading', LOADED: 'Loaded', LEFT: 'Left', CANCELLED: 'Cancelled', NO_SHOW: 'Did not come',
};
export const SLOT_STYLE: Record<string, string> = {
  BOOKED: 'bg-sky-100 text-sky-800 border-sky-300', IN_YARD: 'bg-amber-100 text-amber-900 border-amber-300', LOADING: 'bg-violet-100 text-violet-900 border-violet-300',
  LOADED: 'bg-emerald-100 text-emerald-900 border-emerald-300', LEFT: 'bg-slate-100 text-slate-600 border-slate-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-300', NO_SHOW: 'bg-red-100 text-red-800 border-red-300',
};

/** The trucks and partners lists (same endpoints as the other screens); an empty list when they cannot be read. */
export const asList = (x: any) => (Array.isArray(x) ? x : []);

/** The warehouse last chosen on the dock and gate screens (this browser only). */
export const savedWarehouse = () => { try { return localStorage.getItem('reftech_dispatch_warehouse') || ''; } catch { return ''; } };
export const saveWarehouse = (id: string) => { try { localStorage.setItem('reftech_dispatch_warehouse', id); } catch { /* private window */ } };

/** The warehouse to start with: the saved one, else the first with an outbound dock. */
export const pickWarehouse = (list: any[]) => {
  const s = savedWarehouse();
  if (s && list.some(w => String(w.id) === s)) return s;
  const w = list.find(x => Number(x.outboundDocks) > 0) || list[0];
  return w ? String(w.id) : '';
};
