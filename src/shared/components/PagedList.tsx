/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-004 -- server paging for a screen that keeps its own table (rows with buttons, forms, a row that opens).
// usePagedList() asks a PagedQuery address ({items, total, page, size, pages}) for one page; <PagerBar> is the search
// box, the sort choice, Export and Previous / Next under or over that table. A simple list uses <DataTable> instead.
import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { btnLight, input } from '@/shared/components/FormKit';
import { usePrefs } from '@/shared/i18n/PrefsProvider';
import { buildQuery, exportAddress, pageAddress } from './dataTableQuery';

export type PagedAnswer<T> = { items: T[]; total: number; page: number; size: number; pages: number; options?: Record<string, any> };

export type PagedList<T> = {
  items: T[]; total: number; pages: number; options: Record<string, any>; busy: boolean; error: string;
  page: number; setPage: (p: number) => void; size: number; setSize: (n: number) => void;
  typed: string; setTyped: (q: string) => void; sort: string; dir: 'asc' | 'desc'; setSort: (s: string, d?: 'asc' | 'desc') => void;
  reload: () => void; query: URLSearchParams; path: string;
};

/** One page of `path`; `params` (filters such as f.status) restart at page 1 when they change. */
export function usePagedList<T = any>(path: string, params: Record<string, string | number | undefined | null> = {}, pageSize = 25, defaultSort = ''): PagedList<T> {
  const [page, setPage] = useState(1), [size, setSize] = useState(pageSize);
  const [typed, setTyped] = useState(''), [q, setQ] = useState('');
  const [sort, setSortKey] = useState(defaultSort), [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [data, setData] = useState<PagedAnswer<T>>({ items: [], total: 0, page: 1, size: pageSize, pages: 0 });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [tick, setTick] = useState(0);
  const query = useMemo(() => buildQuery({ params, q, sort, dir }), [JSON.stringify(params), q, sort, dir]);
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 350); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(1); }, [query.toString()]);
  useEffect(() => {
    let live = true;
    setBusy(true); setError('');
    api(pageAddress(path, query, page, size))
      .then((x: any) => { if (live) setData({ items: Array.isArray(x?.items) ? x.items : [], total: x?.total || 0, page: x?.page || page, size: x?.size || size, pages: x?.pages || 0, options: x?.options }); })
      .catch((e: any) => { if (live) { setError(e?.message || 'Could not load the list'); setData({ items: [], total: 0, page: 1, size, pages: 0 }); } })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [path, query.toString(), page, size, tick]);
  return {
    items: data.items, total: data.total, pages: data.pages, options: data.options || {}, busy, error, page, setPage, size, setSize: n => { setSize(n); setPage(1); },
    typed, setTyped, sort, dir, setSort: (s, d) => { setSortKey(s); setDir(d || 'asc'); }, reload: () => setTick(x => x + 1), query, path,
  };
}

/** Search box, sort choice, Export and the page buttons of a usePagedList. */
export function PagerBar({ list, placeholder = 'Search', sorts = [], exportName, top = true }: {
  list: PagedList<any>; placeholder?: string; sorts?: [string, string][]; exportName?: string; top?: boolean;
}) {
  const { t } = usePrefs();
  const from = list.total ? (list.page - 1) * list.size + 1 : 0, to = Math.min(list.page * list.size, list.total);
  async function download(format: 'csv' | 'xlsx') { await apiDownload(exportAddress(list.path, list.query, format), `${exportName || 'list'}.${format}`); }
  const pager = <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
    <span>{list.busy ? t('Loading...') : t('{from}-{to} of {total}', { from, to, total: list.total })}</span>
    <label>{t('Rows')} <select value={list.size} onChange={e => list.setSize(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1">
      {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    <button type="button" disabled={list.page <= 1 || list.busy} onClick={() => list.setPage(list.page - 1)} className={btnLight}>{t('Previous')}</button>
    <span>{t('Page {page} of {pages}', { page: list.pages ? list.page : 0, pages: list.pages })}</span>
    <button type="button" disabled={list.page >= list.pages || list.busy} onClick={() => list.setPage(list.page + 1)} className={btnLight}>{t('Next')}</button>
  </div>;
  if (!top) return <div className="mt-3 flex justify-end">{pager}</div>;
  return <div className="flex flex-wrap items-end gap-2">
    <label className="relative min-w-56 flex-1">
      <span className="sr-only">{t(placeholder)}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input value={list.typed} onChange={e => list.setTyped(e.target.value)} placeholder={t(placeholder)} className={`${input} pl-9`} />
    </label>
    {sorts.length > 0 && <label className="text-xs font-semibold text-slate-600">{t('Sort by')}
      <select className={input} value={`${list.sort}|${list.dir}`} onChange={e => { const [s, d] = e.target.value.split('|'); list.setSort(s, d as 'asc' | 'desc'); }}>
        <option value="|asc">{t('Default order')}</option>
        {sorts.flatMap(([k, label]) => [<option key={k + 'a'} value={`${k}|asc`}>{label} (A-Z, low-high)</option>, <option key={k + 'd'} value={`${k}|desc`}>{label} (Z-A, high-low)</option>])}
      </select></label>}
    {exportName && <div className="flex gap-1">
      <button type="button" onClick={() => void download('csv')} className={btnLight}><Download aria-hidden className="mr-1 inline h-4 w-4" />{t('CSV')}</button>
      <button type="button" onClick={() => void download('xlsx')} className={btnLight}><Download aria-hidden className="mr-1 inline h-4 w-4" />{t('Excel')}</button>
    </div>}
    {list.error && <div role="alert" className="w-full rounded-xl bg-red-50 p-3 text-red-800">{list.error}</div>}
    <div className="w-full">{pager}</div>
  </div>;
}
