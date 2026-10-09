/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-001 .. 005, 008, 012 .. 017 -- what the warehouse operation screens share: running a step with its message,
// the warehouse / partner / product lists, a plain table, tabs, photos and the "run script 48" notice.
//
// Backend: /api/warehouse/** (warehouse module of reftech_core, script 48).
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '@/shared/services/api';
import { btnLight, td, th } from '@/shared/components/FormKit';
import { errorText } from './wms';

export const OPS_SCRIPT = 'database_v2/48_warehouse_operations.sql';

export const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const put = (path: string, body?: unknown) => api(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });

/** busy / message / error of a screen, and run(): one step with its message (the backend's "message" when it sends one). */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const run = useCallback(async <T,>(action: () => Promise<T>, after?: (r: T) => void | Promise<void>) => {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await action();
      if (after) await after(r);
      const m = (r as any)?.message;
      if (m) setMsg(String(m));
      return r;
    } catch (x) { setError(errorText(x, 'Could not complete the step')); return null; }
    finally { setBusy(false); }
  }, []);
  return { busy, msg, error, setMsg, setError, run };
}

export function useWarehouses() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { api('/api/warehouse/layout').then(d => setList((d.warehouses || []).filter((w: any) => w.active))).catch(() => setList([])); }, []);
  return list;
}

export function usePartners() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { api('/api/operations/partners').then(p => setList(Array.isArray(p) ? p : [])).catch(() => setList([])); }, []);
  return list;
}

export function useProducts(partnerId: string | number | null | undefined) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    if (!partnerId) { setList([]); return; }
    api(`/api/warehouse/products?partnerId=${partnerId}`).then(r => setList(r.products || [])).catch(() => setList([]));
  }, [partnerId]);
  return list;
}

export const opts = (list: any[], text: (x: any) => string = x => x.name): [string, string][] => list.map(x => [String(x.id), text(x)]);

export type Col = { key: string; label: string; render?: (row: any) => ReactNode; right?: boolean };

/** A plain table; rows clickable when onRow is given. */
export function Table({ cols, rows, onRow, empty = 'Nothing here yet.', selected }: { cols: Col[]; rows: any[]; onRow?: (r: any) => void; empty?: string; selected?: unknown }) {
  if (!rows.length) return <div className="text-slate-500">{empty}</div>;
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-slate-100 text-slate-700"><tr>{cols.map(c => <th key={c.key} className={`${th} ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id ?? i} onClick={onRow ? () => onRow(r) : undefined}
      className={`border-t ${onRow ? 'cursor-pointer hover:bg-sky-50' : ''} ${selected != null && r.id === selected ? 'bg-sky-50' : ''}`}>
      {cols.map(c => <td key={c.key} className={`${td} ${c.right ? 'text-right' : ''}`}>{c.render ? c.render(r) : r[c.key] == null ? '-' : String(r[c.key])}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <div className="mt-3 flex flex-wrap gap-2">{tabs.map(([v, t]) => <button key={v} type="button" onClick={() => onChange(v)}
    className={`rounded-xl px-4 py-2 font-semibold ${value === v ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{t}</button>)}</div>;
}

export function StaffOnly({ title }: { title: string }) {
  return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
}

/** Reads a picked file as base64 and stores it as a photo of the record (jpeg, png, webp or pdf). */
export async function addPhoto(entityType: string, entityId: number, file: File, caption?: string) {
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
  return post('/api/warehouse/photos', { entityType, entityId, fileName: file.name, contentType: file.type, dataBase64: data, caption });
}

/** Photo links and an "add photo" picker. */
export function Photos({ photos, entityType, entityId, onAdded, canAdd = true }: { photos: any[]; entityType: string; entityId: number; onAdded?: () => void; canAdd?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function open(id: number) {
    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const token = localStorage.getItem('reftech_token');
      const res = await fetch(`${API_URL}/api/warehouse/photos/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`Could not open the photo (${res.status})`);
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch (x) { setErr(errorText(x, 'Could not open the photo')); }
  }
  return <div className="flex flex-wrap items-center gap-2 text-sm">
    {(photos || []).map(p => <button key={p.id} type="button" className={btnLight} onClick={() => open(p.id)}>📷 {p.caption || p.fileName || `Photo ${p.id}`}</button>)}
    {canAdd && <label className={`${btnLight} cursor-pointer`}>{busy ? 'Adding…' : '+ Photo'}
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={busy} onChange={async e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        setBusy(true); setErr('');
        try { await addPhoto(entityType, entityId, f); onAdded?.(); } catch (x) { setErr(errorText(x, 'Could not add the photo')); } finally { setBusy(false); }
      }} /></label>}
    {err && <span className="text-red-700">{err}</span>}
  </div>;
}

/** Splits "P100001, P100002 P100003" (commas, spaces or new lines) into codes. */
export const codes = (text: unknown) => String(text || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

/** yyyy-mm-dd of today, and of the first of this month. */
export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().slice(0, 10); };

/** A datetime-local value ("2026-10-06T14:30", the browser's own time) as an ISO instant for the backend; '' -> undefined. */
export const iso = (v: unknown) => { const s = String(v || ''); if (!s) return undefined; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toISOString(); };

/** Lines typed on a screen: a product, a batch, dates, quantity, unit, pallets. */
export type LineDraft = Record<string, any>;

/** A small editable grid of lines (inbound notice, receipt note, return). fields: key, label, kind. */
export function LinesEditor({ lines, setLines, products, fields, fixedProduct }: {
  lines: LineDraft[]; setLines: (l: LineDraft[]) => void; products: any[];
  fields: { key: string; label: string; kind?: 'text' | 'number' | 'date' | 'select'; options?: [string, string][]; width?: string }[];
  fixedProduct?: (l: LineDraft) => boolean;
}) {
  const cell = 'w-full rounded-lg border border-slate-300 px-2 py-1 text-sm';
  const set = (i: number, k: string, v: any) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-slate-100"><tr><th className={th}>#</th><th className={th}>Product</th>{fields.map(f => <th key={f.key} className={th}>{f.label}</th>)}<th /></tr></thead>
    <tbody>{lines.map((l, i) => {
      const pr = products.find(p => String(p.id) === String(l.productId));
      return <tr key={i} className="border-t">
        <td className={td}>{i + 1}</td>
        <td className={`${td} min-w-48`}>{fixedProduct?.(l)
          ? <span>{l.productName || pr?.name}</span>
          : <select className={cell} value={l.productId || ''} onChange={e => { const p = products.find(x => String(x.id) === e.target.value); set(i, 'productId', e.target.value); if (p) setLines(lines.map((x, j) => j === i ? { ...x, productId: e.target.value, uom: p.baseUom } : x)); }}>
              <option value="">Choose…</option>{products.map(p => <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>)}
            </select>}</td>
        {fields.map(f => <td key={f.key} className={td} style={{ minWidth: f.width || '6rem' }}>
          {f.key === 'uom'
            ? <select className={cell} value={l.uom || ''} onChange={e => set(i, 'uom', e.target.value)}>
                {pr ? [[pr.baseUom, pr.baseUom], ...(pr.uoms || []).map((u: any) => [u.uom, u.uom])].map(([v]) => <option key={v} value={v}>{v}</option>) : <option value={l.uom || ''}>{l.uom || '-'}</option>}
              </select>
            : f.kind === 'select'
              ? <select className={cell} value={l[f.key] ?? ''} onChange={e => set(i, f.key, e.target.value)}>{f.options?.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
              : <input className={cell} type={f.kind || 'text'} step="any" value={l[f.key] ?? ''} onChange={e => set(i, f.key, e.target.value)} />}
        </td>)}
        <td className={td}>{!fixedProduct?.(l) && <button type="button" className="text-red-700" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>}</td>
      </tr>;
    })}</tbody>
  </table>
    <button type="button" className={`${btnLight} mt-2`} onClick={() => setLines([...lines, {}])}>+ Line</button>
  </div>;
}
