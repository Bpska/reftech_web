/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-001 .. 016 -- what the Government screens share: the script name, colours of levels and states,
// the source line under a value ("Parivahan, typed in", "sample data") and a multipart upload.
//
// Backend: /api/gov/** (GovController, GovTollController, GovRecordsController, GovComplianceController).
export { role, rupees, day } from '@/modules/transporter/transporter';
export { when, iso } from '@/modules/allocation/allocation';

export const SCRIPT = 'database_v2/43_government_data_and_alerts.sql';

export const LEVEL_STYLE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800', MEDIUM: 'bg-amber-100 text-amber-800', LOW: 'bg-sky-100 text-sky-800', NONE: 'bg-slate-100 text-slate-600',
};
export const LEVEL_LABEL: Record<string, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', NONE: 'None' };
export const TILE_STYLE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800', MEDIUM: 'bg-amber-50 text-amber-800', LOW: 'bg-sky-50 text-sky-800', NONE: 'bg-slate-50 text-slate-700',
};

/** Paper and licence states, and the results set beside the register. */
export const STATE_STYLE: Record<string, string> = {
  OK: 'bg-emerald-100 text-emerald-800', ACTIVE: 'bg-emerald-100 text-emerald-800', MATCHES: 'bg-emerald-100 text-emerald-800', VALID: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-emerald-100 text-emerald-800', DONE: 'bg-emerald-100 text-emerald-800', CLEAR: 'bg-emerald-100 text-emerald-800', MATCHED: 'bg-emerald-100 text-emerald-800',
  EXPIRING: 'bg-amber-100 text-amber-800', DIFFERS: 'bg-amber-100 text-amber-800', DUE: 'bg-amber-100 text-amber-800', RENEW_SOON: 'bg-amber-100 text-amber-800',
  NAME_DIFFERS: 'bg-amber-100 text-amber-800', PAN_DIFFERS: 'bg-amber-100 text-amber-800', EMPTY: 'bg-amber-100 text-amber-800', NOT_CHECKED: 'bg-slate-100 text-slate-700',
  NO_CONSENT: 'bg-violet-100 text-violet-800', MISSING: 'bg-red-100 text-red-800', PENDING: 'bg-slate-100 text-slate-700', NOT_CROSSED: 'bg-slate-200 text-slate-700',
  UNKNOWN: 'bg-slate-100 text-slate-600', UPCOMING: 'bg-slate-100 text-slate-700', NOT_ON_PARIVAHAN: 'bg-slate-100 text-slate-600', NO_GSTIN: 'bg-slate-100 text-slate-600',
  EXPIRED: 'bg-red-100 text-red-800', NOT_ACTIVE: 'bg-red-100 text-red-800', OVERDUE: 'bg-red-100 text-red-800', CANCELLED: 'bg-red-100 text-red-800',
  INACTIVE: 'bg-red-100 text-red-800', BLACKLISTED: 'bg-red-100 text-red-800', DOUBLE: 'bg-red-100 text-red-800', WRONG_CLASS: 'bg-red-100 text-red-800',
  NO_TRIP: 'bg-amber-100 text-amber-800', NO_TRUCK: 'bg-amber-100 text-amber-800', NO_CROSSING: 'bg-sky-100 text-sky-800', NOT_A_TOLL: 'bg-slate-100 text-slate-600',
  ACCEPTED: 'bg-emerald-100 text-emerald-800', WAITING: 'bg-amber-100 text-amber-800', RECEIVED: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-red-100 text-red-800',
  REFUSED: 'bg-red-100 text-red-800', APPROVED: 'bg-amber-100 text-amber-800', WARN: 'bg-sky-100 text-sky-800', COURT: 'bg-violet-100 text-violet-800',
};
export const pill = (s?: string | null) => `inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STATE_STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;
export const words = (s?: string | null) => (s ? String(s).replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : '-');

export const STATE_TEXT: Record<string, string> = {
  OK: 'Valid', EXPIRING: 'Expiring', EXPIRED: 'Expired', NOT_ACTIVE: 'Not active', DIFFERS: 'HR date differs', NOT_CHECKED: 'Not checked', NO_CONSENT: 'No consent',
  ACTIVE: 'Active', CANCELLED: 'Cancelled or suspended', NAME_DIFFERS: 'Name differs', PAN_DIFFERS: 'PAN differs', NO_GSTIN: 'No GST number',
  VALID: 'Valid', RENEW_SOON: 'Renew soon', DUE: 'Due', OVERDUE: 'Overdue', UPCOMING: 'Upcoming', DONE: 'Done', UNKNOWN: 'Unknown',
};

/** Where a value came from, as the screens say it. */
export const SOURCE_TEXT: Record<string, string> = {
  SAMPLE: 'Sample data, not real', MANUAL: 'Typed by hand', ULIP: 'ULIP', HTTP: 'Service provider', STATEMENT: 'Bank statement', FASTAG: 'FASTag',
  DIGILOCKER: 'DigiLocker', 'System (nightly)': 'Nightly check',
};
export const sourceText = (s?: string | null) => (s ? SOURCE_TEXT[s] || s : '-');

/** The line shown when a system is typed by hand. */
export const providerNote = (provider?: string, what = 'This system') =>
  provider === 'SAMPLE' ? `${what} answers with sample data (not real). An Admin can connect it in Government > Connections.`
    : provider === 'MANUAL' || !provider ? `${what} is not connected: type the answer from the government site. An Admin can connect it in Government > Connections.` : '';

/** Sends a form with a file (multipart). */
export async function upload(path: string, form: FormData) {
  const url = import.meta.env.VITE_API_URL;
  if (!url) throw new Error('VITE_API_URL is not configured');
  const token = localStorage.getItem('reftech_token');
  const response = await fetch(`${url}${path}`, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(body.message || `Upload failed (${response.status})`);
  return body;
}

/** A datetime-local value for "now" in this computer's time. */
export const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
