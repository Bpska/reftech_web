/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-004 -- Lists & Export: choose one of the main lists (trips, loads, partners, trucks, drivers, employees,
// invoices, stock, temperature excursions, expenses); the server pages, searches, filters and exports it.
// Backend: /api/platform/lists, /api/platform/lists/{name}/meta, /api/platform/lists/{name} (ListsController).
import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Column, DataTable, Filter } from '@/shared/components/DataTable';
import { input, label } from '@/shared/components/FormKit';
import { PageTitle, ScriptMissing, usePlatform } from './platform';

type ListInfo = { name: string; label: string; description: string; ready: boolean; message?: string };

export function ListsExportPage() {
  const status = usePlatform();
  const [lists, setLists] = useState<ListInfo[]>([]), [name, setName] = useState(''), [meta, setMeta] = useState<any>(null), [err, setErr] = useState('');

  useEffect(() => {
    if (!status?.ready) return;
    api('/api/platform/lists').then(x => {
      const l: ListInfo[] = Array.isArray(x?.lists) ? x.lists : [];
      setLists(l);
      const wanted = new URLSearchParams(window.location.search).get('list');
      setName(l.find(i => i.name === wanted)?.name || l[0]?.name || '');
    }).catch(e => setErr(e.message));
  }, [status?.ready]);

  useEffect(() => {
    setMeta(null);
    if (!name) return;
    api(`/api/platform/lists/${name}/meta`).then(setMeta).catch(e => setErr(e.message));
  }, [name]);

  if (status && !status.ready) return <><PageTitle icon={<ListChecks />} title="Lists & Export" /><ScriptMissing /></>;
  const columns: Column[] = (meta?.columns || []).map((c: any) => ({ key: c.key, label: c.label, sort: c.sort }));
  const filters: Filter[] = (meta?.filters || []).map((f: any) => f.range ? { name: f.name, label: f.label, range: f.range } : { name: f.name, label: f.label, options: (f.options || []).map((o: any) => [String(o[0]), String(o[1])]) });
  const chosen = lists.find(l => l.name === name);

  return <>
    <PageTitle icon={<ListChecks />} title="Lists & Export">Every main list of your company, paged by the server. Search, filter, sort and export the whole filtered list to CSV or Excel.</PageTitle>
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    {status && lists.length === 0 && !err && <p className="mt-4 text-slate-600">Your login may not open any of these lists.</p>}
    {lists.length > 0 && <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem]"><span className={label}>List</span>
          <select className={input} value={name} onChange={e => { setErr(''); setName(e.target.value); }}>
            {lists.map(l => <option key={l.name} value={l.name}>{l.label}</option>)}
          </select>
        </label>
        {chosen && <p className="pb-2 text-sm text-slate-600">{chosen.description}{meta?.search?.length ? ` Search looks in: ${meta.search.join(', ')}.` : ''}</p>}
      </div>
      {chosen && !chosen.ready && <div role="status" className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">{chosen.message}</div>}
      {meta && chosen?.ready && <div className="mt-4">
        <DataTable key={name} path={`/api/platform/lists/${name}`} columns={columns} filters={filters} exportName={name} searchPlaceholder={`Search ${chosen.label.toLowerCase()}`} />
      </div>}
    </section>}
  </>;
}
