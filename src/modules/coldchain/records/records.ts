/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-008, 010, 011, 012, 013, 014 -- what the cold chain record screens share: the script they need, the
// "not ready" check, sending a form, the colour of a state and plain words for the codes the backend sends.
// Pure functions (no React) so records.test.ts can test them.
import { api, currentUser } from '@/shared/services/api';
import { fmtDate, fmtDateTime, tempNow, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SCRIPT66 = 'database_v2/66_cold_chain_records.sql';

/** true when the backend answered {ready:false} (script 66 not run yet). */
export const notReady = (x: any) => !!x && typeof x === 'object' && x.ready === false;

/** Who is signed in, as the cold chain screens need it. */
export function who() {
  const u: any = currentUser();
  const type = String(u.loginType || u.userType || '').toUpperCase();
  const r = String(u.baseRole || u.role || '').replace('ROLE_', '').toUpperCase();
  const partner = type === 'PARTNER' || r === 'PARTNER';
  const staff = !partner && type !== 'DRIVER' && r !== 'DRIVER' && r !== 'TRANSPORTER';
  return {
    partner, staff,
    manager: staff && (r === 'MANAGER' || r === 'ADMIN'),
    partnerViewer: partner && String(u.partnerRole || '').toUpperCase() === 'PARTNER_VIEWER',
  };
}

/** POST (or PUT) a JSON body. Empty strings are sent as null so optional fields stay empty. */
export function send(path: string, body: Record<string, unknown> = {}, method: 'POST' | 'PUT' = 'POST') {
  return api(path, { method, body: JSON.stringify(clean(body)) });
}

export function clean(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) out[k] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v;
  return out;
}

/** BIG_CODE -> "Big code". */
export function words(code?: string | null) {
  if (!code) return '-';
  const s = String(code).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A temperature stored in °C as "-18.5 °C" (or °F when the login chose it, REQ-PLT-015), or "-". */
export function temp(v: unknown) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : `${Math.round(tempNow(n) * 100) / 100} ${unitNow('temp')}`;
}

/** A date (YYYY-MM-DD or a moment) as "07 Oct 2026". */
export function day(v?: string | null) {
  if (!v) return '-';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00+05:30` : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : fmtDate(v);
}

/** A moment as "07 Oct 2026, 10:30 am" in India time. */
export function at(v?: string | null) {
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
}

/** The current time as "YYYY-MM-DD HH:MM" India time, the format the backend reads from a form. */
export function nowIndia(d: Date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

/** Minutes as "2 h 10 min". */
export function duration(min?: number | null) {
  if (min === null || min === undefined || Number.isNaN(Number(min))) return '-';
  const m = Math.max(0, Math.round(Number(min)));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

const STYLE: Record<string, string> = {
  OK: 'bg-emerald-100 text-emerald-800', PASS: 'bg-emerald-100 text-emerald-800', DONE: 'bg-emerald-100 text-emerald-800', CLOSED: 'bg-emerald-100 text-emerald-800',
  IN_RANGE: 'bg-emerald-100 text-emerald-800', CONTROLLED: 'bg-sky-100 text-sky-800', ADJUSTED: 'bg-sky-100 text-sky-800',
  DUE_SOON: 'bg-amber-100 text-amber-800', AT_RISK: 'bg-amber-100 text-amber-800', INVESTIGATING: 'bg-amber-100 text-amber-800', PARTIAL: 'bg-amber-100 text-amber-800',
  MEDIUM: 'bg-amber-100 text-amber-800', STALE: 'bg-amber-100 text-amber-800', RUNNING: 'bg-sky-100 text-sky-800', CAL_OVERDUE: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800', FAIL: 'bg-red-100 text-red-800', OPEN: 'bg-red-100 text-red-800', LATE: 'bg-red-100 text-red-800', EXPIRED: 'bg-red-100 text-red-800',
  OUT_OF_RANGE: 'bg-red-100 text-red-800', HIGH: 'bg-red-100 text-red-800', SKIPPED: 'bg-red-100 text-red-800', OVER: 'bg-red-100 text-red-800',
  NOT_SET: 'bg-slate-100 text-slate-700', INACTIVE: 'bg-slate-200 text-slate-600', NO_READING: 'bg-slate-100 text-slate-700', LOW: 'bg-slate-100 text-slate-700',
};
/** Tailwind classes of a state pill. */
export const tone = (state?: string | null) => STYLE[String(state || '').toUpperCase()] || 'bg-slate-100 text-slate-700';

/** Builds "?a=1&b=x" from the values that are set. */
export function qs(params: Record<string, string | number | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && String(v) !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** "Partner / product / batch" key of a custody record, the address of the record and of its PDF. */
export function custodyQuery(k: { partnerId?: number | string | null; productId?: number | string | null; batchNo?: string | null; palletCode?: string | null }) {
  return qs({ partnerId: k.partnerId ?? null, productId: k.productId ?? null, batchNo: k.batchNo ?? null, palletCode: k.palletCode ?? null });
}

/** The options of a select from a list of codes. */
export const opts = (codes: string[]): [string, string][] => codes.map(c => [c, words(c)]);

export const SENSOR_KINDS = ['TEMPERATURE', 'TEMP_HUMIDITY', 'DATA_LOGGER', 'PROBE', 'REEFER_PROBE', 'OTHER'];
export const SENSOR_PLACES = ['CHAMBER', 'VEHICLE', 'COMPARTMENT', 'REEFER', 'PORTABLE'];
export const CAL_RESULTS = ['PASS', 'ADJUSTED', 'FAIL'];
export const INCIDENT_TYPES = ['POWER_FAILURE', 'UNIT_FAILURE', 'OTHER'];
export const NOTICE_CHANNELS = ['PHONE', 'SMS', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER'];
export const PACK_KINDS = ['BOX', 'SHIPPER', 'GEL_PACK', 'DRY_ICE', 'PCM', 'OTHER'];
export const COOLANT_KINDS = ['GEL_PACK', 'DRY_ICE', 'PCM'];
export const CUSTODY_STAGES = ['INWARD', 'STORAGE', 'LOADING', 'TRANSPORT', 'DELIVERY', 'OTHER'];
export const COMPLAINT_TYPES = ['TEMPERATURE', 'DAMAGE', 'SHORTAGE', 'CONTAMINATION', 'PEST', 'HYGIENE', 'LATE', 'DOCUMENTS', 'OTHER'];
export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];
export const HYGIENE_MODES: [string, string][] = [['OFF', 'Off: no check'], ['WARN', 'Warn: show a warning at trip start'], ['REFUSE', 'Refuse: a truck without a passed check cannot load or start']];

/** A file name safe for a download. */
export const fileName = (s: string) => String(s || 'record').replace(/[^A-Za-z0-9._-]+/g, '_');
