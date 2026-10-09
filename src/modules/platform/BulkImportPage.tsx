/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-014 -- Bulk Import & Export: load partners, trucks, drivers, products and opening stock from Excel or CSV
// when a company starts. Download the template, fill it, upload: every row is checked first and nothing is written
// until Import is pressed. Errors can be downloaded as Excel, fixed and uploaded again. Export gives the same columns.
// Backend: /api/platform/bulk/** (BulkController).
import { FormEvent, useEffect, useState } from 'react';
import { Download, FileUp, Upload } from 'lucide-react';
import { api, apiDownload, apiUpload } from '@/shared/services/api';
import { Column, DataTable } from '@/shared/components/DataTable';
import { Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, when } from '@/modules/hr/hr';
import { PageTitle, ScriptMissing, usePlatform } from './platform';

const STATUS_TEXT: Record<string, string> = { UPLOADED: 'Uploaded', CHECKED: 'Checked', IMPORTING: 'Importing', DONE: 'Done', FAILED: 'Failed', CANCELLED: 'Cancelled' };

export function BulkImportPage() {
  const status = usePlatform();
  const [kinds, setKinds] = useState<any[]>([]), [kind, setKind] = useState(''), [mode, setMode] = useState('CREATE_ONLY');
  const [run, setRun] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);

  useEffect(() => {
    if (!status?.ready) return;
    api('/api/platform/bulk/kinds').then(x => { const k = Array.isArray(x?.kinds) ? x.kinds : []; setKinds(k); setKind(k[0]?.kind || ''); }).catch(e => setErr(e.message));
  }, [status?.ready]);

  // while an import runs in the background, ask again every 3 seconds
  useEffect(() => {
    if (run?.status !== 'IMPORTING') return;
    const t = setInterval(() => { api(`/api/platform/bulk/runs/${run.id}`).then(x => { setRun(x); if (x.status !== 'IMPORTING') setReload(r => r + 1); }).catch(() => {}); }, 3000);
    return () => clearInterval(t);
  }, [run?.id, run?.status]);

  if (status && !status.ready) return <><PageTitle icon={<FileUp />} title="Bulk Import & Export" /><ScriptMissing /></>;
  const info = kinds.find(k => k.kind === kind);
  const slug = (k: string) => k.toLowerCase().replace(/_/g, '-');

  async function go(fn: () => Promise<any>, ok?: string) {
    setBusy(true); setErr(''); setMsg('');
    try { const x = await fn(); if (x && x.id) setRun(x); if (ok) setMsg(ok); setReload(r => r + 1); }
    catch (e: any) { setErr(e.message || 'Not done'); }
    finally { setBusy(false); }
  }
  function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if (!f) { setErr('Choose a file'); return; }
    const form = e.currentTarget;
    void go(async () => { const x = await apiUpload(`/api/platform/bulk/${kind}/upload?mode=${mode}`, { file: f }); form.reset(); return x; });
  }
  const open = (id: number) => go(() => api(`/api/platform/bulk/runs/${id}`));

  const history: Column[] = [
    { key: 'id', label: 'Import', sort: 'createdAt', render: r => <button type="button" onClick={() => void open(r.id)} className="font-bold text-sky-700 hover:underline">#{r.id}</button> },
    { key: 'kind', label: 'Kind', sort: 'kind', render: r => kinds.find(k => k.kind === r.kind)?.label || r.kind },
    { key: 'fileName', label: 'File' },
    { key: 'status', label: 'Status', sort: 'status', render: r => <Badge v={r.status} /> },
    { key: 'rowsTotal', label: 'Rows' },
    { key: 'rowsError', label: 'With errors' },
    { key: 'rowsCreated', label: 'Created' },
    { key: 'rowsUpdated', label: 'Updated' },
    { key: 'createdBy', label: 'By' },
    { key: 'createdAt', label: 'When', render: r => when(r.createdAt) },
  ];

  return <>
    <PageTitle icon={<FileUp />} title="Bulk Import & Export">Load partners, trucks, drivers, products and opening stock from Excel. Every row is checked first; nothing is written until you press Import.</PageTitle>
    {msg && <div role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {err && <div role="alert" className="my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    {status && kinds.length === 0 && !err && <p className="mt-4 text-slate-600">Your login may not import data. An Admin can do it, or give the permission in Access Control.</p>}

    {kinds.length > 0 && <Section title="1. Choose what to load">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56"><span className={label}>Kind</span>
          <select className={input} value={kind} onChange={e => { setKind(e.target.value); setRun(null); if (e.target.value === 'OPENING_STOCK') setMode('CREATE_ONLY'); }}>
            {kinds.map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
        </label>
        <button type="button" className={btnLight} onClick={() => void apiDownload(`/api/platform/bulk/template/${kind}`, `import-${slug(kind)}-template.xlsx`).catch(e => setErr(e.message))}>
          <Download aria-hidden className="mr-1 inline h-4 w-4" />Template (Excel)</button>
        <button type="button" className={btnLight} onClick={() => void apiDownload(`/api/platform/bulk/export/${kind}?format=xlsx`, `export-${slug(kind)}.xlsx`).catch(e => setErr(e.message))}>
          <Download aria-hidden className="mr-1 inline h-4 w-4" />Export current (Excel)</button>
        <button type="button" className={btnLight} onClick={() => void apiDownload(`/api/platform/bulk/export/${kind}?format=csv`, `export-${slug(kind)}.csv`).catch(e => setErr(e.message))}>
          <Download aria-hidden className="mr-1 inline h-4 w-4" />Export current (CSV)</button>
      </div>
      {info && <details className="mt-3 text-sm text-slate-700"><summary className="cursor-pointer font-semibold">Columns of {info.label}</summary>
        <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50"><th scope="col" className={th}>Column</th><th scope="col" className={th}>Required</th><th scope="col" className={th}>What to write</th><th scope="col" className={th}>Allowed</th></tr></thead>
          <tbody>{info.columns.map((c: any) => <tr key={c.key} className="border-t"><td className={`${td} font-mono`}>{c.key}</td><td className={td}>{c.required ? 'Yes' : ''}</td><td className={td}>{c.help}</td><td className={td}>{(c.allowed || []).join(', ')}</td></tr>)}</tbody></table>
      </details>}
    </Section>}

    {kinds.length > 0 && <Section title="2. Upload and check">
      <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
        <label><span className={label}>File (.xlsx or .csv, at most 5,000 rows)</span><input name="file" type="file" accept=".xlsx,.csv" className={input} /></label>
        <label><span className={label}>Mode</span>
          <select className={input} value={mode} onChange={e => setMode(e.target.value)} disabled={kind === 'OPENING_STOCK'}>
            <option value="CREATE_ONLY">Create only (an existing record is an error)</option>
            <option value="CREATE_OR_UPDATE">Create or update{info?.key ? ` (matched by ${info.key})` : ''}</option>
          </select>
        </label>
        <button disabled={busy} className={btn}><Upload aria-hidden className="mr-1 inline h-4 w-4" />Upload and check</button>
      </form>
    </Section>}

    {run && <Section title={`Import #${run.id}: ${kinds.find(k => k.kind === run.kind)?.label || run.kind}`} right={<Badge v={run.status} />}>
      <p className="text-sm text-slate-700"><b>{run.fileName}</b> · {run.mode === 'CREATE_OR_UPDATE' ? 'Create or update' : 'Create only'} · {run.rowsTotal} row(s), {run.rowsOk} good, {run.rowsError} with errors
        {run.status === 'IMPORTING' && <> · {run.rowsDone} written so far</>}. {STATUS_TEXT[run.status] ? '' : run.status}</p>
      {run.message && <p className="mt-1 text-sm text-slate-600">{run.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {run.status === 'CHECKED' && <button type="button" disabled={busy || run.rowsOk === 0} className={btn} onClick={() => { if (window.confirm(`Import the ${run.rowsOk} good row(s)? Rows with errors are skipped.`)) void go(() => api(`/api/platform/bulk/runs/${run.id}/commit`, { method: 'POST', body: '{}' }), 'The import runs in the background. You get a notification when it is done.'); }}>Import {run.rowsOk} good row(s)</button>}
        {['UPLOADED', 'CHECKED'].includes(run.status) && <button type="button" disabled={busy} className={btnRed} onClick={() => void go(() => api(`/api/platform/bulk/runs/${run.id}/cancel`, { method: 'POST', body: '{}' }), 'Import cancelled')}>Cancel</button>}
        {Number(run.errorCount) > 0 && <button type="button" className={btnLight} onClick={() => void apiDownload(`/api/platform/bulk/runs/${run.id}/errors.xlsx`, `import-${run.id}-errors.xlsx`).catch(e => setErr(e.message))}>
          <Download aria-hidden className="mr-1 inline h-4 w-4" />Rows with errors (Excel)</button>}
      </div>
      {Array.isArray(run.errors) && run.errors.length > 0 && <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full text-sm"><caption className="sr-only">Errors of the import</caption>
          <thead><tr className="bg-slate-50"><th scope="col" className={th}>Row</th><th scope="col" className={th}>Column</th><th scope="col" className={th}>Problem</th></tr></thead>
          <tbody>{run.errors.map((e: any, i: number) => <tr key={i} className="border-t"><td className={td}>{e.rowNo}</td><td className={`${td} font-mono`}>{e.column || '-'}</td><td className={td}>{e.message}{e.atCommit ? <span className="ml-1 text-xs text-slate-500">(at import)</span> : null}</td></tr>)}</tbody>
        </table>
        {Number(run.errorCount) > run.errors.length && <p className="mt-1 text-xs text-slate-500">The first {run.errors.length} of {run.errorCount} errors are shown. Download the rows with errors for all of them.</p>}
      </div>}
    </Section>}

    {kinds.length > 0 && <Section title="History">
      <DataTable path="/api/platform/bulk/runs" columns={history} reloadKey={reload} exportName="imports" searchPlaceholder="Search file, person or result"
        filters={[{ name: 'kind', label: 'Kind', options: kinds.map(k => [k.kind, k.label] as [string, string]) },
          { name: 'status', label: 'Status', options: Object.entries(STATUS_TEXT) as [string, string][] }, { name: 'createdAt', label: 'Uploaded', range: 'date' }]} />
    </Section>}
  </>;
}
