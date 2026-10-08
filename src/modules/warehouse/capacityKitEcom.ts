/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-018, REQ-WMS-019, REQ-WMS-021 -- pure helpers of the Reserved Space, Kitting & Grading and E-commerce
// Fulfilment screens (no React, no API): occupancy bar, forecast colours, component need, the grading balance,
// the pack-station tally, and the courier label and tax invoice that print.
//
// Backend: /api/warehouse/capacity/**, /api/warehouse/kitting/**, /api/warehouse/ecom/** (script 84).
import { barcodeSvg, escapeXml } from './barcode';

export const CAPACITY_SCRIPT = 'database_v2/84_req_wms_018_019_021_capacity_kitting_ecom.sql';

// ------------------------------------------------------------------------------------- REQ-WMS-018

/** Widths in % of the occupancy bar: pallets stored, reserved but empty (held back), free for anyone. */
export function occupancyBar(positions: number, used: number, reservedEmpty: number) {
  if (!positions || positions <= 0) return { used: 0, held: 0, free: 0, over: used > 0 };
  const pct = (n: number) => Math.round(Math.max(0, n) * 1000 / positions) / 10;
  const u = Math.min(used, positions);
  const h = Math.min(reservedEmpty, positions - u);
  return { used: pct(u), held: pct(h), free: pct(positions - u - h), over: used + reservedEmpty > positions };
}

/** Colour of a forecast cell: red when full or over, amber under 10 % free, green otherwise. */
export function freeStyle(free: number, positions: number) {
  if (free <= 0) return 'bg-red-100 text-red-800 font-bold';
  if (positions > 0 && free / positions < 0.1) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-50 text-emerald-800';
}

/** Days from..to counted both ends ('2026-10-01', '2026-10-31' -> 31); 0 when not valid. */
export function daysBetween(from?: string, to?: string) {
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

/** What a reservation commits at most: positions x days x rate (the bill charges the empty part only). */
export function maxCommitted(positions: number, from?: string, to?: string, rate?: number | null) {
  if (!rate) return null;
  return Math.round(positions * daysBetween(from, to) * rate * 100) / 100;
}

// ------------------------------------------------------------------------------------- REQ-WMS-019

/** Component need for a number of finished units, rounded up to 3 decimals (same as KitRules.need). */
export function componentNeed(perBuild: number, outputPerBuild: number, units: number) {
  if (!outputPerBuild || outputPerBuild <= 0) return 0;
  return Math.ceil((perBuild * units / outputPerBuild) * 1000 - 1e-9) / 1000;
}

export type GradeOut = { weightKg?: number | string | null };

/** Sorting balance: kg in vs kg out + waste. diffPct like KitRules.balanceDiffPct; ok within the tolerance. */
export function gradeBalance(inputKg: number, outputs: GradeOut[], wasteKg: number, tolerancePct: number) {
  const out = outputs.reduce((s, o) => s + (Number(o.weightKg) || 0), 0);
  const accounted = out + (wasteKg || 0);
  if (!inputKg || inputKg <= 0) return { out, accounted, diffPct: 0, ok: true };
  const diffPct = Math.round(Math.abs(inputKg - accounted) * 10000 / inputKg) / 100;
  return { out, accounted, diffPct, ok: diffPct <= tolerancePct };
}

// ------------------------------------------------------------------------------------- REQ-WMS-021

export type PackLine = { productCode: string; barcode?: string | null; sku?: string | null; pickedQty: number; productName?: string };

/** Turns a scanned code (barcode, SKU or product code) into the product code of an order line, or null. */
export function matchScan(lines: PackLine[], code: string) {
  const c = code.trim().toUpperCase();
  const l = lines.find(x => [x.productCode, x.barcode, x.sku].some(v => v && String(v).toUpperCase() === c));
  return l ? l.productCode : null;
}

/** The pack-station tally: per line picked, scanned and what is left; done when every line matches. */
export function packTally(lines: PackLine[], scans: Record<string, number>) {
  const rows = lines.map(l => ({ productCode: l.productCode, productName: l.productName, picked: Number(l.pickedQty) || 0, scanned: scans[l.productCode] || 0 }))
    .map(r => ({ ...r, left: r.picked - r.scanned }));
  const unknown = Object.keys(scans).filter(k => !lines.some(l => l.productCode === k));
  return { rows, unknown, done: rows.length > 0 && rows.every(r => r.left === 0) && unknown.length === 0 };
}

const e = (v: unknown) => escapeXml(v === null || v === undefined ? '' : String(v));
const money = (v: unknown) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The 100 x 150 mm courier label: waybill barcode, ship-to, COD, order and parcel. One per parcel. */
export function courierLabelHtml(doc: any) {
  const o = doc.order || {};
  const parcels: any[] = o.parcels && o.parcels.length ? o.parcels : [{ parcelNo: o.orderNo }];
  return parcels.map((p, i) => `<div class="label">
    <div class="big">${e(o.courier || 'Courier')}${parcels.length > 1 ? ` · ${i + 1} of ${parcels.length}` : ''}</div>
    <div>${barcodeSvg(String(o.awbNo || p.parcelNo), 70, 2)}</div>
    <table>
      <tr><td>Ship to</td><td class="big">${e(o.customerName)}</td></tr>
      <tr><td></td><td>${e(o.shipAddress)}<br>${e(o.shipCity)} ${e(o.shipState)} <b>${e(o.shipPincode)}</b><br>${e(o.customerPhone)}</td></tr>
      <tr><td>Payment</td><td class="big">${doc.codToCollect != null ? `COD ₹ ${money(doc.codToCollect)}` : 'PREPAID'}</td></tr>
      <tr><td>Order</td><td>${e(o.orderNo)} · ${e(o.channel)} ${e(o.channelOrderRef)}</td></tr>
      <tr><td>Parcel</td><td>${e(p.parcelNo)}${p.weightKg ? ` · ${e(p.weightKg)} kg` : ''}${p.boxName ? ` · ${e(p.boxName)}` : ''}</td></tr>
      <tr><td>Keep cold</td><td>${p.qualifiedUntil ? `Box holds until ${e(String(p.qualifiedUntil).slice(0, 16).replace('T', ' '))}` : 'Perishable, keep cold'}</td></tr>
      <tr><td>From</td><td>${e(doc.seller?.name)} c/o ${e(doc.shipFrom?.name)}, ${e(doc.shipFrom?.city)}</td></tr>
    </table>
  </div>`).join('');
}

/** The tax invoice of the seller (the partner) with GST backed out of the prices: CGST + SGST or IGST. */
export function invoiceHtml(doc: any) {
  const o = doc.order || {};
  const rows = (doc.invoiceLines || []).map((l: any, i: number) => `<tr><td>${i + 1}</td><td>${e(l.productName)}<br><span class="muted">${e(l.sku || l.productCode)}</span></td>
    <td>${e(l.quantity)}</td><td>${money(l.unitPrice)}</td><td>${money(l.taxable)}</td><td>${e(l.gstRate)}%</td>
    <td>${doc.sameState ? `${money(l.cgst)} + ${money(l.sgst)}` : money(l.igst)}</td><td>${money(l.total)}</td></tr>`).join('');
  return `<div class="doc">
    <div class="head"><div><h1>Tax Invoice</h1><div>${e(doc.seller?.name)}</div><div class="muted">${e(doc.seller?.address)}</div><div>GSTIN ${e(doc.seller?.gstNumber || '-')}</div></div>
    <div><div>Invoice <b>${e(o.invoiceNo)}</b></div><div>Date ${e(o.invoiceDate)}</div><div>Order ${e(o.orderNo)}</div><div>${e(o.channel)} ${e(o.channelOrderRef)}</div></div></div>
    <p><b>Bill and ship to:</b> ${e(o.customerName)}, ${e(o.shipAddress)}, ${e(o.shipCity)} ${e(o.shipState)} ${e(o.shipPincode)}</p>
    <table><tr><th>#</th><th>Item</th><th>Qty</th><th>Price (incl. GST)</th><th>Taxable</th><th>GST</th><th>${doc.sameState ? 'CGST + SGST' : 'IGST'}</th><th>Total</th></tr>${rows}
    <tr><td colspan="4"><b>Total</b></td><td>${money(doc.taxable)}</td><td></td><td>${doc.sameState ? `${money(doc.cgst)} + ${money(doc.sgst)}` : money(doc.igst)}</td><td><b>${money(doc.total)}</b></td></tr></table>
    <p>${doc.codToCollect != null ? `Cash on delivery: ₹ ${money(doc.codToCollect)}` : 'Paid online'}. Shipped from ${e(doc.shipFrom?.name)}.</p>
  </div>`;
}
