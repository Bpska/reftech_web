/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-001 -- Retention (company Admin): how many days each kind of data is kept. Every night at 03:15 older data
// is removed in batches; GPS and temperature rows are first copied to archive files (CSV, gzip) that can be downloaded
// here. Dry run shows the counts without deleting; Run now starts the job at once.
// Backend: /api/platform/retention/** (RetentionController).
import { FormEvent, useEffect, useState } from 'react';
import { Archive, Download } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, input, td, th } from '@/shared/components/FormKit';
import { useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, bytes, usePlatform } from './platform';

export function RetentionPage() {
  const st = usePlatform();
  const [kinds, setKinds] = useState<any[]>([]), [days, setDays] = useState<Record<string, string>>({}), [dry, setDry] = useState<any[] | null>(null), [reload, setReload] = useState(0);
  const load = async () => {
    const x = await api('/api/platform/retention/settings');
    const list: any[] = x.kinds || [];
    setKinds(list);
    setDays(Object.fromEntries(list.map(k => [k.kind, String(k.days)])));
    setReload(n => n + 1);
  };
  const r = useRunner(load);
  useEffect(() => { if (st?.ready && st.admin) load().catch(e => r.setErr(e.message)); }, [st?.ready, st?.admin]);
  const title = <PageTitle icon={<Archive aria-hidden />} title="Retention">How long each kind of data is kept. Older data is removed every night at 03:15.</PageTitle>;
  if (!st) return <>{title}<p className="mt-4 text-slate-500">Loading...</p></>;
  if (!st.ready) return <>{title}<ScriptMissing /></>;
  if (!st.admin) return <>{title}<NotAllowed what="change how long data is kept (Admin only)" /></>;

  function save(e: FormEvent) {
    e.preventDefault();
    void r.run(() => api('/api/platform/retention/settings', { method: 'PUT', body: JSON.stringify({ days }) }), 'Retention settings saved');
  }
  async function dryRun() {
    const x = await r.run(() => api('/api/platform/retention/dry-run', { method: 'POST' }), 'Dry run done. Nothing was deleted.');
    if (x && x.items) setDry(x.items);
  }
  function runNow() {
    if (!window.confirm('Remove the data older than the days set now? GPS and temperature rows are archived to files first.')) return;
    void r.run(() => api('/api/platform/retention/run', { method: 'POST' }));
  }

  return <>
    {title}
    <Banner msg={r.msg} error={r.err} />
    <Section title="Days to keep" right={<div className="flex gap-2">
      <button type="button" disabled={r.busy} onClick={dryRun} className={btnLight}>Dry run</button>
      <button type="button" disabled={r.busy} onClick={runNow} className={btnLight}>Run now</button></div>}>
      <form onSubmit={save}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-slate-50"><th scope="col" className={th}>Data</th><th scope="col" className={th}>Days kept</th><th scope="col" className={th}>Default</th><th scope="col" className={th}>Note</th></tr></thead>
          <tbody>{kinds.map(k => <tr key={k.kind} className="border-t">
            <td className={td}><label htmlFor={`days-${k.kind}`} className="font-semibold">{k.label}</label></td>
            <td className={td}><input id={`days-${k.kind}`} type="number" min={0} max={36500} className={`${input} w-32`} value={days[k.kind] ?? ''}
              onChange={e => setDays(d => ({ ...d, [k.kind]: e.target.value }))} /></td>
            <td className={td}>{k.defaultDays === 0 ? 'keep for ever' : `${k.defaultDays} days`}</td>
            <td className={`${td} text-slate-600`}>{k.note}{k.minDays > 1 && <> At least {k.minDays} days{k.kind !== 'DELETED_FILES' && ', or 0 to keep for ever'}.</>}</td>
          </tr>)}</tbody>
        </table></div>
        <button disabled={r.busy} className={`${btn} mt-3`}>Save</button>
      </form>
    </Section>

    {dry && <Section title="Dry run: what would be removed now">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th scope="col" className={th}>Data</th><th scope="col" className={th}>Days kept</th><th scope="col" className={th}>Rows archived first</th><th scope="col" className={th}>Rows removed</th><th scope="col" className={th}>Note</th></tr></thead>
        <tbody>{dry.map(x => <tr key={x.kind} className="border-t"><td className={td}>{x.label}</td><td className={td}>{x.days === 0 ? 'for ever' : x.days}</td>
          <td className={td}>{x.archived}</td><td className={td}>{x.deleted}</td><td className={td}>{x.error ? <span role="alert" className="text-red-700">{x.error}</span> : x.note}</td></tr>)}</tbody></table>
    </Section>}

    <Section title="Last runs">
      <DataTable path="/api/platform/retention/runs" reloadKey={reload} pageSize={10}
        filters={[{ name: 'kind', label: 'Data', options: kinds.map(k => [k.kind, k.label] as [string, string]) }, { name: 'dryRun', label: 'Dry run', options: [['true', 'Yes'], ['false', 'No']] }, { name: 'startedAt', label: 'Date', range: 'date' }]}
        columns={[
          { key: 'startedAt', label: 'Started', sort: 'startedAt', render: x => when(x.startedAt) },
          { key: 'kind', label: 'Data', sort: 'kind' },
          { key: 'dryRun', label: 'Dry run' },
          { key: 'keepDays', label: 'Days kept' },
          { key: 'rowsArchived', label: 'Archived' },
          { key: 'rowsDeleted', label: 'Removed', sort: 'rowsDeleted' },
          { key: 'error', label: 'Problem', render: x => x.error ? <span className="text-red-700">{x.error}</span> : '-' },
          { key: 'runBy', label: 'By' },
        ]} />
    </Section>

    <Section title="Archive files (old GPS and temperature rows)">
      <DataTable path="/api/platform/retention/archives" reloadKey={reload} pageSize={10}
        filters={[{ name: 'tableName', label: 'Table', options: [['driver_location_history', 'GPS history'], ['temperature_reading', 'Temperature readings']] }]}
        columns={[
          { key: 'period', label: 'Month', sort: 'period' },
          { key: 'tableName', label: 'Table' },
          { key: 'rowCount', label: 'Rows', sort: 'rowCount' },
          { key: 'sizeBytes', label: 'Size', render: x => bytes(x.sizeBytes) },
          { key: 'createdAt', label: 'Made', sort: 'createdAt', render: x => when(x.createdAt) },
          { key: 'file', label: 'File', render: x => <button type="button" className={btnLight} aria-label={`Download ${x.fileName}`}
            onClick={() => apiDownload(`/api/platform/retention/archives/${x.id}/file`, x.fileName || 'archive.csv.gz').catch(e => r.setErr(e.message))}>
            <Download aria-hidden className="mr-1 inline h-4 w-4" />Download</button> },
        ]} />
    </Section>
  </>;
}
