/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-007, REQ-TRK-002, 003, 004, 006, 007, 008, 009 -- what the tracking and telematics screens share.
import { when, minutesText } from './tower';

export { when, minutesText };
export const TELEMATICS_SCRIPT = 'database_v2/51_tracking_telematics.sql';

/** Where a position came from, in words. */
export const SOURCE_TEXT: Record<string, string> = {
  PHONE: "driver's app", DEVICE: 'vehicle tracker', MANUAL: 'typed by staff', SIM: 'SIM (mobile operator)',
  LINK: "driver's phone link", FASTAG: 'FASTag toll crossing', REEFER: 'reefer unit',
};
export const sourceText = (s?: string | null) => SOURCE_TEXT[String(s || '').toUpperCase()] || (s ? String(s) : '-');

export const pill = (tone: 'green' | 'amber' | 'red' | 'grey' | 'blue', text: string) => {
  const c = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-900', red: 'bg-red-100 text-red-800', grey: 'bg-slate-100 text-slate-700', blue: 'bg-sky-100 text-sky-800' }[tone];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${c}`}>{text}</span>;
};

export const num = (v: unknown, digits = 0) => v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '-'
  : Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** The address of this portal, sent when a link is made so the server can build it. */
export const origin = () => window.location.origin;

/** Copies text; true when it worked. */
export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Fetch for the pages that open without a login (no token is sent). */
export async function publicApi(path: string, options: RequestInit = {}) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error('VITE_API_URL is not configured');
  const r = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await r.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!r.ok) throw new Error(body.message || `Request failed (${r.status})`);
  return body;
}

const roleOf = (u: any) => String(u?.role || u?.roleCode || '').replace('ROLE_', '').toUpperCase();
const partner = (u: any) => String(u?.loginType || u?.userType || '').toUpperCase() === 'PARTNER' || roleOf(u) === 'PARTNER';
export const isStaff = (u: any) => ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(roleOf(u)) && !partner(u);
export const isManager = (u: any) => ['MANAGER', 'ADMIN'].includes(roleOf(u)) && !partner(u);
