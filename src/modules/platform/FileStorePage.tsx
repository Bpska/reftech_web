/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-005 -- File Store: the files kept outside the database (LOCAL folder or S3) with totals per module, and
// (platform owner only) File Store Migration: copy photos, signatures and PDFs that are still inside the database to
// the file store, checked by SHA-256, and free the database space of a column only when the screen that shows those
// files already reads the file store.
// Backend: /api/platform/files/** (FilesController).
import { FormEvent, useEffect, useState } from 'react';
import { HardDrive, Trash2 } from 'lucide-react';
import { api, apiDownload, apiUpload } from '@/shared/services/api';
import { Column, DataTable } from '@/shared/components/DataTable';
import { Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, Tabs, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, bytes, usePlatform } from './platform';

export function FileStorePage() {
  const status = usePlatform();
  const [tab, setTab] = useState('files');
  if (status && !status.ready) return <><PageTitle icon={<HardDrive />} title="File Store" /><ScriptMissing /></>;
  if (status && !status.admin) return <><PageTitle icon={<HardDrive />} title="File Store" /><NotAllowed what="see the file store (Admin only)" /></>;
  return <>
    <PageTitle icon={<HardDrive />} title="File Store">Files kept outside the database: logos, imports, exports, backups and documents.</PageTitle>
    <Tabs tabs={[['files', 'Files'], ...(status?.owner ? [['migration', 'File Store Migration'] as [string, string]] : [])]} value={tab} onChange={setTab} />
    {tab === 'files' ? <Files /> : <Migration />}
  </>;
}

function Files() {
  const [totals, setTotals] = useState<any>(null), [modules, setModules] = useState<string[]>([]), [reload, setReload] = useState(0), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  useEffect(() => { api('/api/platform/files/totals').then(setTotals).catch(e => setErr(e.message)); }, [reload]);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = (form.elements.namedItem('file') as HTMLInputElement).files?.[0], module = (form.elements.namedItem('module') as HTMLInputElement).value;
    setMsg(''); setErr('');
    if (!f) { setErr('Choose a file'); return; }
    try { const x = await apiUpload('/api/platform/files', { file: f, module }); setMsg(x.message); form.reset(); setReload(r => r + 1); } catch (x: any) { setErr(x.message); }
  }
  async function remove(r: any) {
    if (!window.confirm(`Delete ${r.fileName}? It is kept for a while and then removed by the retention job.`)) return;
    try { const x = await api(`/api/platform/files/${r.id}`, { method: 'DELETE' }); setMsg(x.message); setReload(v => v + 1); } catch (x: any) { setErr(x.message); }
  }
  const columns: Column[] = [
    { key: 'fileName', label: 'File', sort: 'fileName', render: r => <button type="button" className="font-bold text-sky-700 hover:underline" onClick={() => void apiDownload(`/api/platform/files/${r.id}`, r.fileName).catch(e => setErr(e.message))}>{r.fileName}</button> },
    { key: 'module', label: 'Module', sort: 'module' },
    { key: 'sizeBytes', label: 'Size', sort: 'sizeBytes', render: r => bytes(r.sizeBytes) },
    { key: 'storage', label: 'Storage' },
    { key: 'sourceTable', label: 'Moved from' },
    { key: 'createdBy', label: 'By' },
    { key: 'createdAt', label: 'When', sort: 'createdAt', render: r => when(r.createdAt) },
    { key: 'actions', label: 'Actions', render: r => <button type="button" aria-label={`Delete ${r.fileName}`} title="Delete" className={btnRed} onClick={() => void remove(r)}><Trash2 aria-hidden className="h-4 w-4" /></button> },
  ];
  return <>
    {msg && <div role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    {totals?.ready && <Section title="Where the files are">
      <p className="text-sm text-slate-700">New files go to <b>{totals.provider}</b>. Check: {totals.check === 'OK' ? <span className="font-semibold text-emerald-700">it can be written and read</span> : <span role="alert" className="font-semibold text-red-700">{totals.check}</span>}. Largest file {totals.maxMb} MB; allowed: {(totals.allowed || []).join(', ')}.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <table className="w-full text-sm"><caption className="text-left font-semibold">Per module</caption><thead><tr className="bg-slate-50"><th scope="col" className={th}>Module</th><th scope="col" className={th}>Files</th><th scope="col" className={th}>Size</th></tr></thead>
          <tbody>{(totals.byModule || []).map((m: any) => <tr key={m.module} className="border-t"><td className={td}>{m.module}</td><td className={td}>{m.files}</td><td className={td}>{bytes(m.bytes)}</td></tr>)}</tbody></table>
        <table className="w-full text-sm"><caption className="text-left font-semibold">Per storage</caption><thead><tr className="bg-slate-50"><th scope="col" className={th}>Storage</th><th scope="col" className={th}>Files</th><th scope="col" className={th}>Size</th></tr></thead>
          <tbody>{(totals.byStorage || []).map((m: any) => <tr key={m.storage} className="border-t"><td className={td}>{m.storage}</td><td className={td}>{m.files}</td><td className={td}>{bytes(m.bytes)}</td></tr>)}</tbody></table>
      </div>
    </Section>}
    <Section title="Upload a file">
      <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
        <label><span className={label}>File</span><input name="file" type="file" className={input} /></label>
        <label><span className={label}>Module</span><input name="module" defaultValue="GENERAL" className={input} /></label>
        <button className={btn}>Upload</button>
      </form>
    </Section>
    <Section title="Files">
      <DataTable path="/api/platform/files" columns={columns} reloadKey={reload} exportName="files" searchPlaceholder="Search name, module or person"
        onLoaded={x => setModules(Array.isArray(x?.modules) ? x.modules : [])}
        filters={[{ name: 'module', label: 'Module', options: modules.map(m => [m, m] as [string, string]) },
          { name: 'storage', label: 'Storage', options: [['LOCAL', 'Local folder'], ['S3', 'S3']] }, { name: 'createdAt', label: 'Stored', range: 'date' }]} />
    </Section>
  </>;
}

function Migration() {
  const [data, setData] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/api/platform/files/migration').then(setData).catch(e => setErr(e.message));
  useEffect(() => { void load(); const t = setInterval(() => { void load(); }, 10000); return () => clearInterval(t); }, []);
  async function go(path: string, c: any, extra: any = {}) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await api(path, { method: 'POST', body: JSON.stringify({ db: c.db, table: c.table, column: c.column, ...extra }) }); setMsg(x.message); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const cols: any[] = Array.isArray(data?.columns) ? data.columns : [];
  return <>
    {msg && <div role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    <Section title="Files still inside the database">
      <p className="text-sm text-slate-700">Every column of the four databases that holds file bytes. <b>Copy to file store</b> copies each row to the file store ({data?.provider || '...'}) in batches of 200 and checks the copy by SHA-256; it can be stopped and started again.
        <b> Free database space</b> empties the column only for rows with a checked copy, and only when the screen that shows those files already reads the file store. Everything else stays in the database.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="bg-slate-50"><th scope="col" className={th}>Database</th><th scope="col" className={th}>Table.column</th><th scope="col" className={th}>Rows with bytes</th><th scope="col" className={th}>In database</th><th scope="col" className={th}>Copies</th><th scope="col" className={th}>State</th><th scope="col" className={th}>Actions</th></tr></thead>
        <tbody>{cols.map(c => <tr key={c.source} className="border-t">
          <td className={td}>{c.db}</td>
          <td className={`${td} font-mono`}>{c.table}.{c.column}<div className="font-sans text-xs text-slate-500">key {c.keyColumn}</div></td>
          <td className={td}>{c.rowsWithData ?? '-'}</td><td className={td}>{bytes(c.bytesInDatabase)}</td>
          <td className={td}>{c.copies} ({bytes(c.bytesInFileStore)})</td>
          <td className={td}>{c.state ? <Badge v={c.state} /> : '-'}{c.running && <span className="ml-1 text-xs text-amber-700">running</span>}{c.result && <div className="max-w-xs text-xs text-slate-600">{c.result}</div>}{c.error && <div className="text-xs text-red-700">{c.error}</div>}</td>
          <td className={td}><div className="flex flex-wrap gap-1">
            <button type="button" disabled={busy || c.running || !c.rowsWithData} className={btnLight} onClick={() => void go('/api/platform/files/migration/copy', c)}>Copy to file store</button>
            {c.lastId && <button type="button" disabled={busy || c.running} className={btnLight} onClick={() => void go('/api/platform/files/migration/copy', c, { fromStart: true })}>Copy again from the start</button>}
            <button type="button" disabled={busy || c.running || !c.freeable || !c.rowsWithData} className={btnRed} title={c.freeNote || ''}
              onClick={() => { if (window.confirm(`Empty ${c.table}.${c.column} in the database for every row with a checked copy? This cannot be undone from the screen.`)) void go('/api/platform/files/migration/free', c); }}>Free database space</button>
          </div>{c.freeNote && <p className="mt-1 max-w-sm text-xs text-slate-500">{c.freeNote}</p>}</td>
        </tr>)}
          {data && cols.length === 0 && <tr><td className={`${td} text-slate-500`} colSpan={7}>No file columns were found.</td></tr>}</tbody>
      </table></div>
      {data?.vacuumAdvice && <p className="mt-3 text-sm text-slate-600">{data.vacuumAdvice}</p>}
    </Section>
  </>;
}
