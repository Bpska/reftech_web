/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-006, 007, 009, 010, 011 -- what the warehouse screens share: who is signed in, number and date
// formats, status colours, and printing (pallet labels, bin labels, pick lists, gate passes).
//
// Backend: /api/warehouse/** (warehouse module of reftech_core). Every screen says "Run script 30" until
// database_v2/30_req_wms_006_011_warehouse.sql has been applied.
import { currentUser } from '@/shared/services/api';
import { barcodeSvg, escapeXml } from './barcode';
import { fmtDate, fmtDateTime, fmtTemp, fmtTempRange } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export type Who = { role: string; staff: boolean; manager: boolean; partner: boolean; partnerId: number | null };

export function who(): Who {
  const u = currentUser();
  const role = String(u.role || u.roleCode || 'EMPLOYEE').replace('ROLE_', '').toUpperCase();
  const partner = String(u.loginType || u.userType || '').toUpperCase() === 'PARTNER' || role === 'PARTNER';
  const staff = !partner && ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(role);
  return { role, staff, manager: !partner && (role === 'MANAGER' || role === 'ADMIN'), partner, partnerId: u.partnerId ? Number(u.partnerId) : null };
}

export { input, label, btn, btnLight, btnRed, th, td, errorText } from '@/shared/components/FormKit';
export const card = 'rounded-2xl bg-white p-4 shadow-sm';

/** 1200 -> "1,200"; 2.5 -> "2.5"; null -> "-". */
export const num = (v: unknown, digits = 3) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: digits }) : String(v);
};
export const qty = (v: unknown, uom?: string | null) => (v === null || v === undefined ? '-' : `${num(v)}${uom ? ' ' + uom : ''}`);

/** 2026-10-05 -> 05 Oct 2026 */
export const day = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : fmtDate(v);
};
export const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
export const range = (min?: number | null, max?: number | null) =>
  min == null && max == null ? 'range not recorded' : fmtTempRange(min, max);

export const STATUS_STYLE: Record<string, string> = {
  RECEIVED: 'bg-amber-100 text-amber-800', STORED: 'bg-emerald-100 text-emerald-800', PICKED: 'bg-sky-100 text-sky-800',
  STAGED: 'bg-indigo-100 text-indigo-800', LOADED: 'bg-violet-100 text-violet-800', DISPATCHED: 'bg-slate-200 text-slate-700', CLOSED: 'bg-slate-200 text-slate-700',
  GOOD: 'bg-emerald-100 text-emerald-800', HOLD: 'bg-amber-100 text-amber-800', DAMAGED: 'bg-red-100 text-red-800',
  DRAFT: 'bg-slate-100 text-slate-700', RESERVED: 'bg-sky-100 text-sky-800', PICKING: 'bg-sky-100 text-sky-800', CANCELLED: 'bg-red-100 text-red-800',
  OPEN: 'bg-slate-100 text-slate-700', DONE: 'bg-emerald-100 text-emerald-800',
  // REQ-WMS-001 .. 017 (script 48)
  IN_TRANSFER: 'bg-violet-100 text-violet-800', DISPOSED: 'bg-slate-300 text-slate-800', NOTICED: 'bg-slate-100 text-slate-700', BOOKED: 'bg-sky-100 text-sky-800',
  ARRIVED: 'bg-amber-100 text-amber-800', RECEIVING: 'bg-indigo-100 text-indigo-800', POSTED: 'bg-emerald-100 text-emerald-800', NO_SHOW: 'bg-red-100 text-red-800',
  IN_TRANSIT: 'bg-violet-100 text-violet-800', SUBMITTED: 'bg-sky-100 text-sky-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-red-100 text-red-800', LIFTED: 'bg-slate-200 text-slate-700', GRADED: 'bg-sky-100 text-sky-800', REQUESTED: 'bg-amber-100 text-amber-800',
  PLANNED: 'bg-slate-100 text-slate-700', RUNNING: 'bg-indigo-100 text-indigo-800', BILLED: 'bg-emerald-100 text-emerald-800', ENDED: 'bg-slate-200 text-slate-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-800', RESOLVED: 'bg-emerald-100 text-emerald-800', IN_RANGE: 'bg-emerald-100 text-emerald-800',
  OUT_OF_RANGE: 'bg-red-100 text-red-800', NO_DATA: 'bg-slate-100 text-slate-600', SILENT: 'bg-amber-100 text-amber-800', POWER_OFF: 'bg-red-100 text-red-800',
  DOOR_OPEN: 'bg-amber-100 text-amber-800', RECALL: 'bg-red-100 text-red-800',
};
export const pill = (s?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[String(s)] || 'bg-slate-100 text-slate-700'}`;

/** Expiry colour: red when expired or within 7 days, amber within 30 days. */
export const expiryStyle = (days?: number | null) =>
  days == null ? '' : days < 0 ? 'font-bold text-red-700' : days <= 7 ? 'font-semibold text-red-600' : days <= 30 ? 'text-amber-700' : '';

// ------------------------------------------------------------------------------------------- printing

const PRINT_CSS = `body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#000}
.label{width:100mm;height:150mm;box-sizing:border-box;padding:6mm;border:1px dashed #999;page-break-after:always;display:flex;flex-direction:column;gap:3mm}
.label h1{font-size:30pt;margin:0;letter-spacing:1px}.label .big{font-size:15pt;font-weight:bold}.label table{width:100%;border-collapse:collapse;font-size:11pt}
.label td{padding:1mm 0;vertical-align:top}.label td:first-child{color:#444;width:32mm}.bin{width:100mm;height:50mm;padding:4mm;box-sizing:border-box;border:1px dashed #999;page-break-after:always;text-align:center}
.bin h1{font-size:20pt;margin:0 0 2mm}.doc{padding:12mm;font-size:11pt}.doc h1{font-size:18pt;margin:0}.doc table{width:100%;border-collapse:collapse;margin-top:4mm}
.doc th,.doc td{border:1px solid #555;padding:1.5mm;text-align:left;vertical-align:top}.doc .head{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm}
.muted{color:#555}.sign{display:flex;justify-content:space-between;margin-top:18mm}.sign div{border-top:1px solid #000;width:55mm;padding-top:1mm;text-align:center}
@media print{.label,.bin{border:none}}`;

/** Opens the browser print dialog for the given HTML (a new window, so the page itself is not changed). */
export function printHtml(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Allow pop-ups for this site to print'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

const e = (v: unknown) => escapeXml(v === null || v === undefined ? '-' : String(v));

/** One 100 x 150 mm label per pallet: barcode of the pallet code, product, batch, expiry, quantity, partner. */
export function palletLabelsHtml(pallets: any[]) {
  return pallets.map(p => `<div class="label">
    <div>${barcodeSvg(String(p.palletCode), 80, 2)}</div>
    <h1>${e(p.palletCode)}</h1>
    <div class="big">${e(p.productName)}</div>
    <table>
      <tr><td>Product code</td><td>${e(p.productCode)}${p.packSize ? ' · ' + e(p.packSize) : ''}</td></tr>
      <tr><td>Partner</td><td>${e(p.partnerName)}</td></tr>
      <tr><td>Batch</td><td class="big">${e(p.batchNo)}${p.serialNo ? ' · Serial ' + e(p.serialNo) : ''}</td></tr>
      <tr><td>Mfg / Expiry</td><td>${e(day(p.mfgDate))} / <b>${e(day(p.expiryDate))}</b></td></tr>
      <tr><td>Quantity</td><td class="big">${e(qty(p.quantity, p.uom))}${p.weightKg ? ' · ' + e(num(p.weightKg)) + ' kg' : ''}</td></tr>
      <tr><td>Temperature</td><td>${e(p.temperatureProfileName || '')}</td></tr>
      <tr><td>Received</td><td>${e(when(p.receivedAt))}${p.receivedTemperatureC != null ? ' at ' + e(fmtTemp(p.receivedTemperatureC)) : ''}</td></tr>
      <tr><td>Put away to</td><td class="big">${e(p.binCode || p.suggestedBinCode || 'scan a bin')}</td></tr>
    </table>
    <div class="muted">${e(p.warehouseName)} · RefTech</div>
  </div>`).join('');
}

/** 100 x 50 mm bin labels to stick on the rack beams. */
export function binLabelsHtml(bins: { binCode: string; place?: string }[]) {
  return bins.map(b => `<div class="bin"><h1>${e(b.binCode)}</h1>${barcodeSvg(b.binCode, 70, 2, false)}<div class="muted">${e(b.place || '')}</div></div>`).join('');
}
