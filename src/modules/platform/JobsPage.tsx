/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-010 -- background jobs. Queue: every job of the company (the owner: of every company), counts, Retry,
// Cancel and the job's data. Timed jobs (owner only): every scheduled job of the server with its last run, next
// expected run and failures in the last 24 hours.
// Route: /platform/jobs (tab=timed for the second tab). Backend: /api/platform/jobs/** (JobsController).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Cog, RotateCcw, X } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btnLight, btnRed, td, th } from '@/shared/components/FormKit';
import { Badge, Tabs, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';

const STATUSES: [string, string][] = [['QUEUED', 'Queued'], ['RUNNING', 'Running'], ['DONE', 'Done'], ['FAILED', 'Failed (will retry)'], ['DEAD', 'Dead (stopped)'], ['CANCELLED', 'Cancelled']];

export function JobsPage() {
  const s = usePlatform();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'timed' ? 'timed' : 'queue';
  if (s && !s.admin) return <><PageTitle icon={<Cog />} title="Background jobs" /><NotAllowed what="open the background jobs (Admin only)" /></>;
  const tabs: [string, string][] = [['queue', 'Queue']];
  if (s?.owner) tabs.push(['timed', 'Timed jobs']);
  return <>
    <PageTitle icon={<Cog />} title="Background jobs">Work the server does in the background: messages, webhooks, imports. A failed job is tried again with a growing wait.</PageTitle>
    {s && !s.ready ? <ScriptMissing /> : <>
      <Tabs tabs={tabs} value={tab} onChange={t => setSp(t === 'timed' ? { tab: 'timed' } : {})} />
      {tab === 'queue' && <QueueTab owner={!!s?.owner} initialStatus={sp.get('status') || ''} />}
      {tab === 'timed' && s?.owner && <TimedTab />}
    </>}
  </>;
}

function QueueTab({ owner, initialStatus }: { owner: boolean; initialStatus: string }) {
  const [all, setAll] = useState(false), [reload, setReload] = useState(0), [counts, setCounts] = useState<any>({}), [types, setTypes] = useState<string[]>([]);
  const [open, setOpen] = useState<any>(null);
  const loadCounts = () => api('/api/platform/jobs/counts' + (all ? '?all=true' : '')).then(setCounts).catch(() => {});
  const r = useRunner(async () => { setReload(x => x + 1); await loadCounts(); });
  useEffect(() => { loadCounts(); }, [all, reload]);
  useEffect(() => { api('/api/platform/jobs/types').then(x => setTypes(Array.isArray(x) ? x : [])).catch(() => {}); }, []);
  const view = async (id: number) => { try { setOpen(await api(`/api/platform/jobs/${id}`)); } catch (e: any) { r.setErr(e.message); } };
  return <>
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-7">
      {STATUSES.map(([k, t]) => <div key={k} className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="text-xs font-semibold text-slate-500">{t}</div>
        <div className={`text-2xl font-bold ${k === 'DEAD' && counts[k] > 0 ? 'text-red-700' : ''}`}>{counts[k] ?? 0}</div>
      </div>)}
      <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-xs font-semibold text-slate-500">Oldest waiting</div>
        <div className="text-2xl font-bold">{Math.round(Number(counts.oldestWaitingSeconds || 0) / 60)} min</div></div>
    </div>
    <Section title="Queue" right={owner ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="h-4 w-4" />Every company</label> : undefined}>
      <Banner msg={r.msg} />
      {r.err && <div role="alert"><Banner error={r.err} /></div>}
      <DataTable path="/api/platform/jobs" params={{ all: all ? 'true' : undefined, 'f.status': initialStatus || undefined }} reloadKey={reload} exportName="background-jobs"
        searchPlaceholder="Search type, error, key"
        filters={[{ name: 'status', label: 'Status', options: STATUSES }, { name: 'type', label: 'Type', options: types.map(t => [t, t] as [string, string]) }]}
        columns={[
          { key: 'id', label: 'Job' },
          ...(all ? [{ key: 'tenantId', label: 'Company' }] : []),
          { key: 'type', label: 'Type', sort: 'type' },
          { key: 'status', label: 'Status', render: x => <Badge v={x.status} /> },
          { key: 'attempts', label: 'Attempts', sort: 'attempts', render: x => `${x.attempts} / ${x.maxAttempts}` },
          { key: 'runAt', label: 'Run at', sort: 'runAt', render: x => when(x.runAt) },
          { key: 'durationMs', label: 'Time', sort: 'durationMs', render: x => x.durationMs == null ? '-' : `${x.durationMs} ms` },
          { key: 'lastError', label: 'Last error', className: 'max-w-xs text-xs text-red-800' },
          { key: 'createdBy', label: 'Created by' },
          { key: 'actions', label: 'Actions', render: x => <div className="flex flex-wrap gap-1">
              <button type="button" className={btnLight} onClick={() => view(x.id)}>Data</button>
              {['FAILED', 'DEAD', 'CANCELLED'].includes(x.status) && <button type="button" className={btnLight} onClick={() => r.run(() => api(`/api/platform/jobs/${x.id}/retry`, { method: 'POST' }))}>
                <RotateCcw aria-hidden className="mr-1 inline h-3 w-3" />Retry</button>}
              {['QUEUED', 'FAILED'].includes(x.status) && <button type="button" className={btnRed} onClick={() => { if (window.confirm(`Cancel job ${x.id}?`)) void r.run(() => api(`/api/platform/jobs/${x.id}/cancel`, { method: 'POST' })); }}>Cancel</button>}
            </div> },
        ]} />
    </Section>
    {open && <div role="dialog" aria-modal="true" aria-label={`Job ${open.id}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={e => { if (e.key === 'Escape') setOpen(null); }}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Job {open.id}: {open.type}</h2>
          <button type="button" autoFocus aria-label="Close" onClick={() => setOpen(null)} className={btnLight}><X aria-hidden className="h-4 w-4" /></button></div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="font-semibold">Status</dt><dd><Badge v={open.status} /></dd>
          <dt className="font-semibold">Attempts</dt><dd>{open.attempts} / {open.maxAttempts}</dd>
          <dt className="font-semibold">Created</dt><dd>{when(open.createdAt)} by {open.createdBy || '-'}</dd>
          <dt className="font-semibold">Idempotency key</dt><dd className="break-all">{open.idempotencyKey || '-'}</dd>
          <dt className="font-semibold">Result</dt><dd>{open.result || '-'}</dd>
          <dt className="font-semibold">Last error</dt><dd className="text-red-800">{open.lastError || '-'}</dd>
        </dl>
        <h3 className="mt-3 font-semibold">Data</h3>
        <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(open.payload, null, 2)}</pre>
      </div>
    </div>}
  </>;
}

function TimedTab() {
  const [d, setD] = useState<any>(null), [runs, setRuns] = useState<{ name: string; rows: any[] } | null>(null);
  const r = useRunner();
  useEffect(() => { api('/api/platform/jobs/timed').then(setD).catch(e => r.setErr(e.message)); }, []);
  const show = async (name: string) => { try { setRuns({ name, rows: await api(`/api/platform/jobs/timed/${encodeURIComponent(name)}/runs`) }); } catch (e: any) { r.setErr(e.message); } };
  return <Section title="Timed jobs">
    <p className="mb-2 text-sm text-slate-600">Jobs the server runs on a timetable. "Not logged yet" means the job runs but does not write to this log yet.
      The Admins get a notification when a logged job fails twice in a row.</p>
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    {!d && !r.err && <p className="text-slate-500">Loading...</p>}
    {d && <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="bg-slate-50">{['Job', 'Timetable', 'Last run', 'Status', 'Next expected', 'Failures 24 h', 'Last note / error', ''].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
      <tbody>{(d.jobs || []).map((j: any) => <tr key={j.name} className="border-t">
        <td className={td}><div className="font-semibold">{j.name}</div><div className="text-xs text-slate-500">{j.what}</div></td>
        <td className={`${td} text-xs`}>{j.schedule}{j.property && <div className="text-slate-500">{j.property}</div>}</td>
        <td className={td}>{j.logged ? when(j.lastStartedAt) : <span className="text-xs text-slate-500">Not logged yet</span>}</td>
        <td className={td}>{j.lastStatus ? <Badge v={j.lastStatus} /> : '-'}</td>
        <td className={td}>{j.nextExpected ? when(j.nextExpected) : '-'}</td>
        <td className={`${td} ${j.failures24h > 0 ? 'font-bold text-red-700' : ''}`}>{j.failures24h}</td>
        <td className={`${td} max-w-xs text-xs`}>{j.lastError || j.lastNotes || '-'}</td>
        <td className={td}>{j.logged && <button type="button" className={btnLight} onClick={() => show(j.name)}>Runs</button>}</td>
      </tr>)}</tbody>
    </table></div>}
    {runs && <div className="mt-4">
      <div className="flex items-center justify-between"><h3 className="font-bold">Last runs of {runs.name}</h3><button type="button" className={btnLight} onClick={() => setRuns(null)}>Close</button></div>
      <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50">{['Started', 'Finished', 'Server', 'Status', 'Rows', 'Note / error'].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
        <tbody>{runs.rows.map(x => <tr key={x.id} className="border-t"><td className={td}>{when(x.startedAt)}</td><td className={td}>{when(x.finishedAt)}</td><td className={`${td} text-xs`}>{x.server}</td>
          <td className={td}><Badge v={x.status} /></td><td className={td}>{x.rows ?? '-'}</td><td className={`${td} text-xs`}>{x.error || x.notes || '-'}</td></tr>)}</tbody></table>
    </div>}
  </Section>;
}
