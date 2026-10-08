/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-009 -- pure helpers of the Trading screen (tested by trading.test.ts).

export const TRADING_SCRIPT = 'database_v2/104_req_cnf_008_009_prt_004_plt_018_trading_public_energy.sql';

export type TradingTab = 'masters' | 'buy' | 'stock' | 'sell' | 'collect' | 'margin';
export const TRADING_TABS: [TradingTab, string][] = [
  ['masters', 'Vendors & Customers'], ['buy', 'Purchase Orders'], ['stock', 'Trading Stock'],
  ['sell', 'Sales & Invoices'], ['collect', 'Collections'], ['margin', 'Margin'],
];

export function tabOf(v: string | null): TradingTab {
  return (TRADING_TABS.find(([k]) => k === v)?.[0]) ?? 'buy';
}

/** One line typed on a purchase or sales order (text fields as typed). */
export type Line = { productId: string; quantity: string; price: string; discountPct?: string; gstRate: string; batchNo?: string; expiryDate?: string };

const n = (v: unknown) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Value of a line before GST: quantity x price less the discount. */
export function lineValue(l: Line): number {
  return r2(n(l.quantity) * n(l.price) * (1 - n(l.discountPct) / 100));
}

/** Taxable value, GST and total of the lines (a preview; the server works out the real CGST/SGST or IGST). */
export function preview(lines: Line[]): { taxable: number; gst: number; total: number } {
  let taxable = 0, gst = 0;
  for (const l of lines) { const v = lineValue(l); taxable += v; gst += v * n(l.gstRate) / 100; }
  return { taxable: r2(taxable), gst: r2(gst), total: r2(taxable + gst) };
}

/** The lines to send: only those with a product and a quantity above 0; the price field is named for the order kind. */
export function linesToSend(lines: Line[], kind: 'PO' | 'SO'): Record<string, unknown>[] {
  return lines.filter(l => l.productId && n(l.quantity) > 0).map(l => kind === 'PO'
    ? { productId: Number(l.productId), quantity: n(l.quantity), unitCost: n(l.price), gstRate: n(l.gstRate) }
    : { productId: Number(l.productId), quantity: n(l.quantity), unitPrice: n(l.price), discountPct: n(l.discountPct), gstRate: n(l.gstRate) });
}

/** Colour of a margin % against the lowest margin of the settings. */
export function marginTone(pct: unknown, minPct: unknown): string {
  if (pct === null || pct === undefined || pct === '') return 'text-slate-600';
  const p = n(pct);
  if (p < 0) return 'text-red-700 font-bold';
  if (p < n(minPct)) return 'text-amber-700 font-bold';
  return 'text-emerald-700';
}

export const AGEING = ['NOT_DUE', '0-30', '31-60', '61-90', '90+'] as const;

/** Total of each ageing bucket over the customers. */
export function ageingTotals(rows: Record<string, unknown>[]): Record<string, number> {
  const out: Record<string, number> = { total: 0 };
  for (const b of AGEING) out[b] = 0;
  for (const r of rows) { for (const b of AGEING) out[b] = r2(out[b] + n(r[b])); out.total = r2(out.total + n(r.total)); }
  return out;
}
