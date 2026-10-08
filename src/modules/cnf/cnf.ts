/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-001 .. 007, REQ-PRT-002 -- what the C&F screens share: formats, status colours, the tabs a login sees,
// the "run this and show the message" helper and reading a CSV file. The pure functions are tested in cnf.test.ts.
import { useCallback, useState } from 'react';
import { api } from '@/shared/services/api';
import { fmtDate, fmtDateTime, fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const CNF_SCRIPT = 'database_v2/68_cnf_operations.sql';

/** Rupees as the login chose to see them: 123456.5 -> "₹ 1,23,456.50". Empty for nothing. */
export function inr(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return fmtMoney(n); // REQ-PLT-015: symbol or code and grouping as the login chose
}

/** A quantity without trailing zeros: 12.500 -> "12.5". */
export function qty(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : String(v);
}

/** 2026-10-07 -> "07 Oct 2026". */
export function day(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : fmtDate(String(v));
}

export function when(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
}

/** "2026-09" for the month before the given date (the month usually settled). */
export function lastMonth(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Yesterday as YYYY-MM-DD (the stock statement opens on yesterday). */
export function yesterday(today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const GREEN = 'bg-emerald-100 text-emerald-800', AMBER = 'bg-amber-100 text-amber-800', RED = 'bg-red-100 text-red-800',
  BLUE = 'bg-sky-100 text-sky-800', GREY = 'bg-slate-100 text-slate-700', VIOLET = 'bg-violet-100 text-violet-800';

/** The colour of a status pill on the C&F screens. */
export function statusColour(s: unknown): string {
  switch (String(s || '').toUpperCase()) {
    case 'ACTIVE': case 'ALLOTTED': case 'ISSUED': case 'APPROVED': case 'ACCEPTED': case 'SETTLED': case 'CREDITED': case 'LOCKED': case 'IN_RANGE': case 'RECORDED': return GREEN;
    case 'CREDIT_HOLD': case 'REQUESTED': case 'DRAFT': case 'OPEN': case 'REVIEWED': case 'STALE': case 'SUSPENDED': return AMBER;
    case 'REJECTED': case 'CANCELLED': case 'DISPUTED': case 'OUT_OF_RANGE': case 'ALERT': case 'ENDED': case 'REVERSED': return RED;
    case 'DISPATCHED': case 'SENT': case 'RECEIVED': case 'CLAIMED': return BLUE;
    case 'DELIVERED': case 'GRADED': case 'CLOSED': return VIOLET;
    default: return GREY;
  }
}

export type TabKey = 'contracts' | 'orders' | 'stock' | 'returns' | 'documents' | 'settlement';

/**
 * The tabs a login sees. Staff: all. A principal's login: its contract and orders always, the rest only when the
 * contract shows it on the portal (show_stock, show_invoices, show_settlement).
 */
export function tabsFor(partnerLogin: boolean, contract?: Record<string, unknown> | null): [TabKey, string][] {
  const all: [TabKey, string][] = [['contracts', 'Contracts & distributors'], ['orders', 'Orders'], ['stock', 'Stock statement'],
    ['returns', 'Returns & claims'], ['documents', 'Invoices & challans'], ['settlement', 'Settlement']];
  if (!partnerLogin) return all;
  if (!contract) return [['contracts', 'My contract']];
  return all.filter(([k]) =>
    k === 'contracts' || k === 'returns'
    || (k === 'orders' && contract.showOrders !== false)
    || (k === 'stock' && contract.showStock !== false)
    || (k === 'documents' && contract.showInvoices !== false)
    || (k === 'settlement' && contract.showSettlement !== false));
}

/** Lines "code,batch,quantity" of a CSV the principal sends; the server reads it, this only counts for the screen. */
export function csvRows(text: string): number {
  return text.split(/\r?\n/).filter(l => l.trim() && /\d/.test(l.split(/[,;\t]/).pop() || '')).length;
}

/** Runs a call, shows its message (or the error) and returns the answer. */
export function useRunner() {
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    setMsg(''); setError(''); setBusy(true);
    try {
      const out = await f();
      const m = (out as any)?.message;
      if (m) setMsg(String(m));
      return out;
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
      return undefined;
    } finally { setBusy(false); }
  }, []);
  return { msg, error, busy, run, setMsg, setError };
}
export type Runner = ReturnType<typeof useRunner>;

export const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
export const put = (path: string, body?: unknown) => api(path, { method: 'PUT', body: JSON.stringify(body ?? {}) });

/** Asks for a note or reason (min 5 characters, as the server checks). null = cancelled. */
export function ask(question: string): string | null {
  const r = window.prompt(question);
  return r === null ? null : r.trim();
}

export const SERVICES = ['STORAGE', 'DISPATCH', 'BILLING_ON_BEHALF', 'COLLECTION', 'RETURNS'];
export const FEE_TYPES = ['PER_CASE_IN', 'PER_CASE_OUT', 'PER_PALLET_IN', 'PER_PALLET_OUT', 'PER_ORDER', 'PER_INVOICE', 'FIXED_MONTHLY'];

// ---- REQ-CNF-007: returns against the principal's own invoice (contract invoice_issuer = PRINCIPAL)

/** A principal's credit note recorded before its number was known carries this prefix (PrincipalReturnService). */
export const PRINCIPAL_NOTE_PENDING = 'BY-PRINCIPAL/';
export function principalNumberPending(no: unknown): boolean {
  return typeof no === 'string' && no.toUpperCase().startsWith(PRINCIPAL_NOTE_PENDING);
}

export type PrincipalLine = { challanLineId?: number; productId?: string; batchNo?: string; expiryDate?: string; quantity: string; unitPrice?: string; gstRate?: string };

/** The lines to send: challan lines and typed lines with a quantity above zero; empty fields are left out. */
export function principalReturnLines(lines: PrincipalLine[]): Record<string, unknown>[] {
  return lines.filter(l => Number(l.quantity) > 0).map(l => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(l)) if (v !== undefined && v !== null && v !== '') out[k] = v;
    return out;
  });
}

/** Value (with GST) of the lines as typed, to compare with the invoice value before sending. */
export function principalReturnValue(lines: PrincipalLine[]): number {
  return Math.round(lines.reduce((s, l) => {
    const q = Number(l.quantity) || 0, p = Number(l.unitPrice) || 0, g = Number(l.gstRate) || 0;
    return s + q * p * (1 + g / 100);
  }, 0) * 100) / 100;
}
