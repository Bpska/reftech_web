/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-004 -- a list paged, searched, filtered and sorted by the server, with Export to CSV and Excel.
// The address answers {items, total, page, size, pages} (backend common/PagedQuery) and gives a file for format=csv|xlsx.
// Parameters sent: page, size, q, sort, dir, f.<filter>, from.<range>, to.<range>, plus `params` of the caller.
// REQ-PLT-007: the parameters are built by the pure buildQuery() (dataTableQuery.ts, tested by dataTableQuery.test.ts).
// REQ-PLT-015: the words of the table follow the login's language (usePrefs().t); English is unchanged. A date and
// time cell follows the login's date format and time zone; a status cell is translated in Hindi and Odia.
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { btnLight, input, td, th } from '@/shared/components/FormKit';
import { usePrefs } from '@/shared/i18n/PrefsProvider';
import { formatDate, formatDateTime } from '@/shared/i18n/format';
import { translateStatus } from '@/shared/i18n/i18n';
import type { Prefs } from '@/shared/i18n/prefs';
import { buildQuery, exportAddress, pageAddress } from './dataTableQuery';

export { buildQuery } from './dataTableQuery';

export type Column = { key: string; label: string; sort?: string; render?: (row: any) => ReactNode; className?: string };
export type Filter = { name: string; label: string; options?: [string, string][]; range?: 'date' | 'number' };

export function DataTable({ path, columns, filters = [], params = {}, exportName, pageSize = 25, reloadKey, rowKey = 'id', empty = 'Nothing found', searchPlaceholder = 'Search', onLoaded }: {
  path: string; columns: Column[]; filters?: Filter[]; params?: Record<string, string | number | undefined | null>; exportName?: string; pageSize?: number;
  reloadKey?: unknown; rowKey?: string; empty?: string; searchPlaceholder?: string; onLoaded?: (answer: any) => void;
}) {
  const [page, setPage] = useState(1), [size, setSize] = useState(pageSize);
  const [q, setQ] = useState(''), [typed, setTyped] = useState('');
  const [sort, setSort] = useState(''), [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [values, setValues] = useState<Record<string, string>>({});
  const [data, setData] = useState<any>({ items: [], total: 0, pages: 0 });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const { t, prefs } = usePrefs();
  const query = useMemo(() => buildQuery({ params, q, sort, dir, values }), [JSON.stringify(params), q, sort, dir, JSON.stringify(values)]);

  useEffect(() => { setPage(1); }, [query.toString()]);
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 350); return () => clearTimeout(t); }, [typed]);
  useEffect(() => {
    setBusy(true); setErr('');
    api(pageAddress(path, query, page, size)).then(x => { setData(x || {}); onLoaded?.(x); })
      .catch(e => { setErr(e.message); setData({ items: [], total: 0, pages: 0 }); }).finally(() => setBusy(false));
  }, [path, query.toString(), page, size, reloadKey]);

  function sortBy(c: Column) {
    if (!c.sort) return;
    if (sort === c.sort) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(c.sort); setDir('asc'); }
  }
  async function download(format: 'csv' | 'xlsx') {
    try { await apiDownload(exportAddress(path, query, format), `${exportName || 'list'}.${format}`); } catch (e: any) { setErr(e.message); }
  }
  const set = (k: string, v: string) => setValues(x => ({ ...x, [k]: v }));
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const from = data.total ? (page - 1) * size + 1 : 0, to = Math.min(page * size, data.total || 0);

  return <div className="ui-data-table">
    <div className="ui-table-toolbar flex flex-wrap items-end gap-2">
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">{t(searchPlaceholder)}</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={t(searchPlaceholder)} className={`${input} pl-9`} />
      </label>
      {filters.map(f => f.range
        ? <div key={f.name} className="flex items-end gap-1">
            <label className="text-xs font-semibold text-slate-600">{t('{label} from', { label: f.label })}<input type={f.range} className={input} value={values['from.' + f.name] || ''} onChange={e => set('from.' + f.name, e.target.value)} /></label>
            <label className="text-xs font-semibold text-slate-600">{t('to')}<input type={f.range} className={input} value={values['to.' + f.name] || ''} onChange={e => set('to.' + f.name, e.target.value)} /></label>
          </div>
        : <label key={f.name} className="text-xs font-semibold text-slate-600">{f.label}
            <select className={input} value={values['f.' + f.name] || ''} onChange={e => set('f.' + f.name, e.target.value)}>
              <option value="">{t('All')}</option>
              {(f.options || []).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>)}
      {exportName && <div className="flex gap-1">
        <button type="button" onClick={() => download('csv')} className={btnLight}><Download aria-hidden className="mr-1 inline h-4 w-4" />{t('CSV')}</button>
        <button type="button" onClick={() => download('xlsx')} className={btnLight}><Download aria-hidden className="mr-1 inline h-4 w-4" />{t('Excel')}</button>
      </div>}
    </div>
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    <div className="ui-table-scroll mt-3 overflow-x-auto">
      <table className="ui-table w-full text-sm" aria-busy={busy}>
        <thead><tr className="bg-slate-50">{columns.map(c => <th key={c.key} scope="col" className={th}>
          {c.sort ? <button type="button" onClick={() => sortBy(c)} className="inline-flex items-center gap-1 font-semibold">
            {c.label}{sort === c.sort && (dir === 'asc' ? <ArrowUp aria-label={t('ascending')} className="h-3 w-3" /> : <ArrowDown aria-label={t('descending')} className="h-3 w-3" />)}
          </button> : c.label}</th>)}</tr></thead>
        <tbody>
          {items.map((r, i) => <tr key={r[rowKey] ?? i} className="border-t">{columns.map(c => <td key={c.key} className={`${td} ${c.className || ''}`}>{c.render ? c.render(r) : fmt(r[c.key], t, prefs, c.key)}</td>)}</tr>)}
          {!busy && items.length === 0 && <tr><td className={`${td} text-slate-500`} colSpan={columns.length}>{t(empty)}</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="ui-table-footer mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>{busy ? t('Loading...') : t('{from}-{to} of {total}', { from, to, total: data.total || 0 })}</span>
      <div className="flex items-center gap-2">
        <label>{t('Rows')} <select value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-300 px-2 py-1">
          {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <button type="button" disabled={page <= 1 || busy} onClick={() => setPage(page - 1)} className={btnLight}>{t('Previous')}</button>
        <span>{t('Page {page} of {pages}', { page: data.pages ? page : 0, pages: data.pages || 0 })}</span>
        <button type="button" disabled={page >= (data.pages || 0) || busy} onClick={() => setPage(page + 1)} className={btnLight}>{t('Next')}</button>
      </div>
    </div>
  </div>;
}

function fmt(v: any, t: (text: string) => string, prefs: Prefs, key: string) {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return t(v ? 'Yes' : 'No');
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) { const d = new Date(v); if (!isNaN(d.getTime())) return formatDateTime(v, prefs); }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v, prefs);
  if (typeof v === 'string' && /status$/i.test(key)) return translateStatus(prefs.language, v);
  return String(v);
}
