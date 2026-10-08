/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-004, 005, 006, 008, 009, 010, 012 -- what the tender, auction, share rule, verification, portal and truck
// change screens share: labels, colours, the JSON call and the file upload.
//
// Backend: TenderController (/api/allocation/tenders, /requests/{id}/tender, /share-rules), VerificationController,
// ScorecardController, TransporterPortalController, TransshipmentController. Everything needs script 46.
import { api } from '@/shared/services/api';

export const SCRIPT_46 = 'database_v2/46_transporter_tender_auction_portal.sql';

export const call = (method: string, path: string, body?: unknown) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Sends a form with a file (multipart). The browser sets the boundary, so no Content-Type here. */
export async function upload(path: string, form: FormData) {
  const url = import.meta.env.VITE_API_URL;
  if (!url) throw new Error('VITE_API_URL is not configured');
  const token = localStorage.getItem('reftech_token');
  const r = await fetch(`${url}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const text = await r.text(); let body: any = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!r.ok) throw new Error(body.message || `Upload failed (${r.status})`);
  return body;
}

/** Opens a stored file (PDF or photo) in a new tab with the login's token. */
export async function openFile(path: string) {
  const url = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('reftech_token');
  const r = await fetch(`${url}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(`The file could not be opened (${r.status})`);
  const blob = await r.blob();
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

export const KIND_LABEL: Record<string, string> = { TENDER: 'Tender', QUOTE: 'Spot quotes', AUCTION: 'Reverse auction', SHARE: 'Contract share' };
export const TENDER_LABEL: Record<string, string> = { OPEN: 'Open', AWARDED: 'Awarded', FAILED: 'Nobody took it', CANCELLED: 'Cancelled' };
export const OFFER_LABEL: Record<string, string> = {
  QUEUED: 'In line', SENT: 'Waiting for answer', INVITED: 'Invited', ACCEPTED: 'Accepted', DECLINED: 'Declined', TIMED_OUT: 'No answer in time',
  WITHDRAWN: 'Withdrawn', RETURNED: 'Gave it back', LOST: 'Not chosen',
};
const STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800', AWARDED: 'bg-emerald-100 text-emerald-800', FAILED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-200 text-slate-600',
  QUEUED: 'bg-slate-100 text-slate-700', SENT: 'bg-amber-100 text-amber-800', INVITED: 'bg-sky-100 text-sky-800', ACCEPTED: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-red-100 text-red-800', TIMED_OUT: 'bg-orange-100 text-orange-800', WITHDRAWN: 'bg-slate-200 text-slate-600', RETURNED: 'bg-red-100 text-red-800', LOST: 'bg-slate-200 text-slate-600',
  OK: 'bg-emerald-100 text-emerald-800', PROBLEM: 'bg-red-100 text-red-800', NOT_CHECKED: 'bg-amber-100 text-amber-800', NO_CONSENT: 'bg-amber-100 text-amber-800', UNAVAILABLE: 'bg-slate-200 text-slate-600',
  REQUESTED: 'bg-amber-100 text-amber-800', APPROVED: 'bg-sky-100 text-sky-800', DONE: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800',
  A: 'bg-emerald-100 text-emerald-800', B: 'bg-sky-100 text-sky-800', C: 'bg-amber-100 text-amber-800', D: 'bg-red-100 text-red-800', NEW: 'bg-slate-100 text-slate-600',
};
export const pill = (s?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;

export const VERIFY_LABEL: Record<string, string> = { OK: 'Verified', PROBLEM: 'Problem', NOT_CHECKED: 'Not checked', NO_CONSENT: 'No consent', UNAVAILABLE: 'Gov module missing' };

export const TRANSSHIP_LABEL: Record<string, string> = { REQUESTED: 'Waiting for approval', APPROVED: 'Approved: record handover', DONE: 'Done', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
export const REASONS: [string, string][] = [['BREAKDOWN', 'Breakdown'], ['ACCIDENT', 'Accident'], ['REEFER_FAULT', 'Reefer fault'], ['DRIVER', 'Driver problem'], ['OTHER', 'Other']];
