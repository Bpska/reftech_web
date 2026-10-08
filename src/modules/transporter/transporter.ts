/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-001, REQ-TAL-002, REQ-TAL-011 -- what the transporter screens share: who may do what, labels and colours.
//
// Backend: /api/transporters/** (transporter module of reftech_core). The screens say "Run script 32"
// until database_v2/32_req_tal_001_002_transporter.sql has been applied.
import { currentUser } from '@/shared/services/api';
import { fmtDate, fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SCRIPT = 'database_v2/32_req_tal_001_002_transporter.sql';

export function role() {
  const u = currentUser();
  const r = String(u.role || u.roleCode || 'EMPLOYEE').replace('ROLE_', '').toUpperCase();
  const partner = String(u.loginType || u.userType || '').toUpperCase() === 'PARTNER' || r === 'PARTNER';
  return { staff: !partner && ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(r), manager: !partner && (r === 'MANAGER' || r === 'ADMIN'), admin: !partner && r === 'ADMIN' };
}

export const ONBOARDING_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', SUBMITTED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800', SUSPENDED: 'bg-red-100 text-red-800',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800', IN_FORCE: 'bg-emerald-100 text-emerald-800', NOT_STARTED: 'bg-sky-100 text-sky-800',
  EXPIRED: 'bg-slate-200 text-slate-600', CANCELLED: 'bg-slate-200 text-slate-600',
  RECEIVED: 'bg-amber-100 text-amber-800', CHECKED: 'bg-sky-100 text-sky-800', ON_HOLD: 'bg-orange-100 text-orange-800', PAID: 'bg-emerald-100 text-emerald-800',
  SENT_BACK: 'bg-red-100 text-red-800', BOOKED: 'bg-amber-100 text-amber-800', BILLED: 'bg-emerald-100 text-emerald-800',
  PASS: 'bg-emerald-100 text-emerald-800', WARN: 'bg-amber-100 text-amber-800', FAIL: 'bg-red-100 text-red-800',
  OWN: 'bg-sky-100 text-sky-800', ATTACHED: 'bg-violet-100 text-violet-800', MARKET: 'bg-orange-100 text-orange-800',
};
export const tag = (s?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${ONBOARDING_STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;

export const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Waiting for approval', APPROVED: 'Approved', REJECTED: 'Rejected', SUSPENDED: 'Suspended',
  PENDING_APPROVAL: 'Waiting for approval', IN_FORCE: 'In force', NOT_STARTED: 'Approved, not started', EXPIRED: 'Expired', CANCELLED: 'Cancelled',
};

export const OWNERSHIP: [string, string][] = [['OWN', 'Own (RefTech)'], ['ATTACHED', 'Attached (long-term)'], ['MARKET', 'Market (hired per trip)']];
export const VEHICLE_TYPES: [string, string][] = [['REEFER_TRUCK', 'Reefer truck'], ['DRY_CONTAINER', 'Dry container']];
export const RATE_BASES: [string, string][] = [['PER_TRIP', 'Per trip'], ['PER_TON', 'Per ton'], ['PER_KM', 'Per km']];
export const CHARGE_BASES: [string, string][] = [['PER_TRIP', 'Per trip'], ['PER_DAY', 'Per day'], ['PER_HOUR', 'Per hour'], ['PER_TON', 'Per ton'], ['PERCENT', 'Percent of freight']];

export const docLabel = (t: string) => t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()).replace(/^Gst /, 'GST ').replace(/^Pan /, 'PAN ').replace(/^Msme /, 'MSME ');

export const rupees = (v: unknown) => fmtMoney(v as any);
export const day = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : fmtDate(v);
};

// REQ-TAL-011 freight bills: needs script 34 as well as script 32.
export const FREIGHT_SCRIPT = 'database_v2/34_req_tal_003_007_011_allocation_freight.sql';
export const BILL_LABEL: Record<string, string> = {
  RECEIVED: 'Received', CHECKED: 'Checked', ON_HOLD: 'On hold', APPROVED: 'Approved', PAID: 'Paid', SENT_BACK: 'Sent back', CANCELLED: 'Cancelled',
  BOOKED: 'Waiting for bill', BILLED: 'Billed',
};
export const PAY_MODES: [string, string][] = [['NEFT', 'NEFT'], ['RTGS', 'RTGS'], ['IMPS', 'IMPS'], ['UPI', 'UPI'], ['CHEQUE', 'Cheque'], ['CASH', 'Cash'], ['FUEL_CARD', 'Fuel card']];
/** True when an error says a database script has not been run (the backend answers 503 with the script name). */
export const scriptMissing = (x: unknown) => x instanceof Error && /database_v2\/3[24]_|script 3[24]/i.test(x.message);
