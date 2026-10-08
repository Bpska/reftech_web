/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-001 .. 007 -- small pieces the C&F tabs share: status pill, a plain table, PDF / Excel buttons.
import { ReactNode } from 'react';
import { apiDownload, apiOpen } from '@/shared/services/api';
import { btnLight, td, th } from '@/shared/components/FormKit';
import { statusColour, Runner } from './cnf';

export function Pill({ s }: { s: unknown }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${statusColour(s)}`}>{String(s ?? '').replace(/_/g, ' ')}</span>;
}

export type Col = { key: string; title: string; render?: (row: any) => ReactNode; right?: boolean };

export function Grid({ cols, rows, empty, onRow, selected }: { cols: Col[]; rows: any[]; empty: string; onRow?: (row: any) => void; selected?: unknown }) {
  if (!rows.length) return <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{empty}</div>;
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-slate-50 text-slate-600"><tr>{cols.map(c => <th key={c.key} className={`${th} ${c.right ? 'text-right' : ''}`}>{c.title}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id ?? i} onClick={onRow ? () => onRow(r) : undefined}
      className={`border-t ${onRow ? 'cursor-pointer hover:bg-sky-50' : ''} ${selected !== undefined && selected === r.id ? 'bg-sky-50' : ''}`}>
      {cols.map(c => <td key={c.key} className={`${td} ${c.right ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

/** Opens a PDF of the server in a new tab. */
export function PdfButton({ path, r, text = 'PDF' }: { path: string; r: Runner; text?: string }) {
  return <button type="button" className={btnLight} onClick={() => r.run(() => apiOpen(path))}>{text}</button>;
}

export function ExcelButton({ path, file, r, text = 'Excel' }: { path: string; file: string; r: Runner; text?: string }) {
  return <button type="button" className={btnLight} onClick={() => r.run(() => apiDownload(path, file))}>{text}</button>;
}

export function Info({ items }: { items: [string, ReactNode][] }) {
  return <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
    {items.map(([k, v]) => <div key={k}><dt className="text-xs font-semibold uppercase text-slate-500">{k}</dt><dd className="text-slate-900">{v === null || v === undefined || v === '' ? '-' : v}</dd></div>)}
  </dl>;
}
