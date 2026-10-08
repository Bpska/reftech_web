/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-009 -- Backups & Recovery (platform owner only: the backups hold every company). Last good backup of each of
// the 4 databases with its age, Run backup now, Verify (pg_restore --list), Download, the record of backups made by
// hand (MANUAL), restore drills done on a spare server and the RPO / RTO reached against the targets.
// Backend: /api/platform/backups/** (BackupController). How to restore: reftech_core/docs/DISASTER_RECOVERY.md.
import { FormEvent, useEffect, useState } from 'react';
import { DatabaseBackup, Download } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { Badge, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, bytes, usePlatform } from './platform';

const DBS: [string, string][] = [['operational', 'reftech_operational'], ['hr', 'reftech_hr'], ['billing', 'reftech_billing'], ['ai', 'reftech_ai']];

function Tile({ title, children, tone = 'slate' }: { title: string; children: any; tone?: 'green' | 'amber' | 'red' | 'slate' }) {
  const c = { green: 'border-emerald-300 bg-emerald-50', amber: 'border-amber-300 bg-amber-50', red: 'border-red-300 bg-red-50', slate: 'border-slate-200 bg-white' }[tone];
  return <div className={`rounded-2xl border p-4 ${c}`}><div className="text-sm font-semibold text-slate-600">{title}</div><div className="mt-1">{children}</div></div>;
}

export function BackupsPage() {
  const st = usePlatform();
  const [o, setO] = useState<any>(null), [reload, setReload] = useState(0), [keep, setKeep] = useState<any>(null);
  const [manual, setManual] = useState({ database: 'hr', sizeMb: '', place: '', notes: '' });
  const [drill, setDrill] = useState({ drillDate: new Date().toISOString().slice(0, 10), database: 'all', backupRunId: '', restoredTo: '', result: 'OK', minutesTaken: '', dataAgeHours: '', notes: '' });
  const load = async () => { const x = await api('/api/platform/backups/overview'); setO(x); setKeep(x.settings); setReload(n => n + 1); };
  const r = useRunner(load);
  useEffect(() => { if (st?.ready && st.owner) load().catch(e => r.setErr(e.message)); }, [st?.ready, st?.owner]);
  const title = <PageTitle icon={<DatabaseBackup aria-hidden />} title="Backups & Recovery">Copies of the 4 databases, checks of the copies and restore drills.</PageTitle>;
  if (!st) return <>{title}<p className="mt-4 text-slate-500">Loading...</p></>;
  if (!st.ready) return <>{title}<ScriptMissing /></>;
  if (!st.owner) return <>{title}<NotAllowed what="see the backups. They hold every company, so only the platform owner (an Admin of RefTech) may" /></>;

  const age = (h: any) => h === null || h === undefined ? 'never' : Number(h) < 48 ? `${h} hours ago` : `${Math.round(Number(h) / 24)} days ago`;
  const runNow = (database?: string) => r.run(() => api('/api/platform/backups/run', { method: 'POST', body: JSON.stringify({ database: database || 'all' }) }));
  function recordManual(e: FormEvent) { e.preventDefault(); void r.run(() => api('/api/platform/backups/manual', { method: 'POST', body: JSON.stringify(manual) })); }
  function recordDrill(e: FormEvent) { e.preventDefault(); void r.run(() => api('/api/platform/backups/drills', { method: 'POST', body: JSON.stringify(drill) })); }
  function saveKeep(e: FormEvent) { e.preventDefault(); void r.run(() => api('/api/platform/backups/settings', { method: 'PUT', body: JSON.stringify(keep) }), 'Backup settings saved'); }

  return <>
    {title}
    <Banner msg={r.msg} error={r.err} />
    {o && <>
      <p className="mt-2 text-sm text-slate-600">
        Provider <b>{o.provider}</b>{o.provider === 'PG_DUMP' ? ' (pg_dump runs every night at 01:30)' : ' (people make the backups and record them here)'}
        {!o.enabled && <b className="text-red-700"> - backups are switched off (app.backup.enabled=false)</b>}.
        Files go to {o.folder ? <b>{o.folder}</b> : <>the file store (<b>{o.fileStore}</b>)</>}.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {o.databases.map((d: any) => {
          const h = d.ageHours === undefined ? null : Number(d.ageHours);
          return <Tile key={d.code} title={d.name} tone={h === null ? 'red' : h > 26 ? 'red' : d.lastStatus === 'FAILED' ? 'amber' : 'green'}>
            <div className="text-lg font-bold">{age(d.ageHours)}</div>
            <div className="text-xs text-slate-600">{d.lastOkSize ? bytes(d.lastOkSize) : ''} {d.lastOkVerify && <>check <Badge v={d.lastOkVerify} /></>}</div>
            {d.lastStatus === 'FAILED' && <div className="mt-1 text-xs text-red-700">Last try failed: {d.lastError}</div>}
            {o.provider === 'PG_DUMP' && <button type="button" disabled={r.busy} className={`${btnLight} mt-2`} onClick={() => runNow(d.code)}>Back up now</button>}
          </Tile>;
        })}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Tile title="RPO: data that could be lost" tone={o.rpo.met ? 'green' : 'red'}>
          Longest time without a good backup in 30 days: <b>{o.rpo.reachedHours ?? '-'} hours</b> (target {o.rpo.targetHours} hours)
        </Tile>
        <Tile title="RTO: time to be back after a failure" tone={o.rto.reachedMinutes === undefined ? 'amber' : o.rto.met ? 'green' : 'red'}>
          {o.rto.reachedMinutes === undefined ? 'No restore drill recorded yet.' : <>Last drill ({String(o.rto.lastDrillDate)}, {o.rto.daysSinceDrill} days ago): <b>{o.rto.reachedMinutes} minutes</b>, <Badge v={o.rto.lastDrillResult} /></>} (target {o.rto.targetHours} hours)
          {o.rto.daysSinceDrill > 35 && <div className="text-sm text-red-700">A drill is due: test a restore every month.</div>}
        </Tile>
      </div>
      {o.provider === 'PG_DUMP' && <button type="button" disabled={r.busy} className={`${btn} mt-4`} onClick={() => runNow()}>Back up all 4 databases now</button>}
    </>}

    <Section title="Backup runs">
      <DataTable path="/api/platform/backups/runs" reloadKey={reload}
        filters={[{ name: 'database', label: 'Database', options: DBS }, { name: 'status', label: 'Status', options: [['OK', 'OK'], ['FAILED', 'Failed'], ['RUNNING', 'Running']] },
          { name: 'kind', label: 'Kind', options: [['SCHEDULED', 'Scheduled'], ['MANUAL', 'By hand / Run now']] }, { name: 'startedAt', label: 'Date', range: 'date' }]}
        columns={[
          { key: 'startedAt', label: 'Started', sort: 'startedAt', render: x => when(x.startedAt) },
          { key: 'database', label: 'Database', sort: 'database' },
          { key: 'status', label: 'Status', sort: 'status', render: x => <><Badge v={x.status} />{x.error && <div className="max-w-xs text-xs text-red-700">{x.error}</div>}</> },
          { key: 'kind', label: 'Kind', render: x => `${x.kind} (${x.provider})` },
          { key: 'sizeBytes', label: 'Size', sort: 'sizeBytes', render: x => x.sizeBytes ? bytes(x.sizeBytes) : '-' },
          { key: 'durationMs', label: 'Took', render: x => x.durationMs ? `${Math.round(x.durationMs / 1000)} s` : '-' },
          { key: 'verifyResult', label: 'Check', render: x => x.verifyResult ? <><Badge v={x.verifyResult} /><div className="max-w-xs text-xs text-slate-500">{x.verifyNote}</div></> : '-' },
          { key: 'place', label: 'Where', render: x => x.removedAt ? <span className="text-slate-500">removed {when(x.removedAt)}</span> : <span className="break-all text-xs">{x.path || (x.fileId ? `file store #${x.fileId}` : '-')}</span> },
          { key: 'act', label: 'Actions', render: x => x.status === 'OK' && !x.removedAt && x.provider === 'PG_DUMP' ? <div className="flex gap-1">
            <button type="button" disabled={r.busy} className={btnLight} onClick={() => r.run(() => api(`/api/platform/backups/runs/${x.id}/verify`, { method: 'POST' }))}>Verify</button>
            <button type="button" className={btnLight} aria-label={`Download backup ${x.id}`} onClick={() => apiDownload(`/api/platform/backups/runs/${x.id}/download`, `${x.database}-${x.id}.dump`).catch(e => r.setErr(e.message))}><Download aria-hidden className="h-4 w-4" /></button>
          </div> : null },
        ]} />
    </Section>

    {o && <Section title={o.provider === 'MANUAL' ? 'Make a backup by hand' : 'Commands to back up by hand'}>
      <p className="text-sm text-slate-600">Run these on a computer that can reach the database server. Put the real password in place of &lt;password&gt;; never write it in a file.</p>
      {o.manualCommands.map((c: any) => <div key={c.database} className="mt-3">
        <div className="font-semibold">{c.name || c.database}</div>
        {c.error ? <div className="text-red-700">{c.error}</div> : <>
          <div className="text-xs text-slate-500">Linux</div><pre className="overflow-x-auto rounded-xl bg-slate-50 p-2 text-xs">{c.linux}</pre>
          <div className="text-xs text-slate-500">Windows (Command Prompt)</div><pre className="overflow-x-auto rounded-xl bg-slate-50 p-2 text-xs">{c.windows}</pre></>}
      </div>)}
      <form onSubmit={recordManual} className="mt-4 grid gap-3 md:grid-cols-4">
        <div><label htmlFor="m-db" className={label}>Database</label>
          <select id="m-db" className={input} value={manual.database} onChange={e => setManual({ ...manual, database: e.target.value })}>{DBS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div><label htmlFor="m-size" className={label}>Size (MB)</label><input id="m-size" type="number" min={0} step="0.1" className={input} value={manual.sizeMb} onChange={e => setManual({ ...manual, sizeMb: e.target.value })} /></div>
        <div className="md:col-span-2"><label htmlFor="m-place" className={label}>Where the file is kept</label><input id="m-place" className={input} required value={manual.place} onChange={e => setManual({ ...manual, place: e.target.value })} placeholder="e.g. NAS \\backup\reftech or S3 bucket" /></div>
        <div className="md:col-span-3"><label htmlFor="m-notes" className={label}>Notes</label><input id="m-notes" className={input} value={manual.notes} onChange={e => setManual({ ...manual, notes: e.target.value })} /></div>
        <div className="flex items-end"><button disabled={r.busy} className={btn}>Record backup done</button></div>
      </form>
    </Section>}

    <Section title="Restore drills">
      <p className="text-sm text-slate-600">Once a month restore the latest backup on a spare server (see docs/DISASTER_RECOVERY.md) and record it here.</p>
      <form onSubmit={recordDrill} className="mt-3 grid gap-3 md:grid-cols-4">
        <div><label htmlFor="d-date" className={label}>Date</label><input id="d-date" type="date" className={input} value={drill.drillDate} onChange={e => setDrill({ ...drill, drillDate: e.target.value })} /></div>
        <div><label htmlFor="d-db" className={label}>Database</label>
          <select id="d-db" className={input} value={drill.database} onChange={e => setDrill({ ...drill, database: e.target.value })}><option value="all">All 4</option>{DBS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div><label htmlFor="d-run" className={label}>Backup run number</label><input id="d-run" inputMode="numeric" className={input} value={drill.backupRunId} onChange={e => setDrill({ ...drill, backupRunId: e.target.value })} /></div>
        <div><label htmlFor="d-result" className={label}>Result</label>
          <select id="d-result" className={input} value={drill.result} onChange={e => setDrill({ ...drill, result: e.target.value })}><option value="OK">OK</option><option value="PARTIAL">Partly</option><option value="FAILED">Failed</option></select></div>
        <div className="md:col-span-2"><label htmlFor="d-to" className={label}>Restored to (server)</label><input id="d-to" className={input} value={drill.restoredTo} onChange={e => setDrill({ ...drill, restoredTo: e.target.value })} /></div>
        <div><label htmlFor="d-min" className={label}>Minutes taken</label><input id="d-min" type="number" min={0} className={input} value={drill.minutesTaken} onChange={e => setDrill({ ...drill, minutesTaken: e.target.value })} /></div>
        <div><label htmlFor="d-age" className={label}>Hours of data lost</label><input id="d-age" type="number" min={0} step="0.1" className={input} value={drill.dataAgeHours} onChange={e => setDrill({ ...drill, dataAgeHours: e.target.value })} /></div>
        <div className="md:col-span-3"><label htmlFor="d-notes" className={label}>Notes</label><input id="d-notes" className={input} value={drill.notes} onChange={e => setDrill({ ...drill, notes: e.target.value })} /></div>
        <div className="flex items-end"><button disabled={r.busy} className={btn}>Record drill</button></div>
      </form>
      <div className="mt-4"><DataTable path="/api/platform/backups/drills" reloadKey={reload} pageSize={10}
        columns={[
          { key: 'drillDate', label: 'Date', sort: 'drillDate' }, { key: 'database', label: 'Database' }, { key: 'backupRunId', label: 'Backup run' },
          { key: 'restoredTo', label: 'Restored to' }, { key: 'result', label: 'Result', render: x => <Badge v={x.result} /> },
          { key: 'minutesTaken', label: 'Minutes', sort: 'minutesTaken' }, { key: 'dataAgeHours', label: 'Hours lost' }, { key: 'notes', label: 'Notes' }, { key: 'doneBy', label: 'By' },
        ]} /></div>
    </Section>

    {keep && <Section title="Keep and targets">
      <form onSubmit={saveKeep} className="grid gap-3 md:grid-cols-5">
        {([['keepDaily', 'Daily backups kept'], ['keepWeekly', 'Sunday backups kept'], ['keepMonthly', '1st-of-month backups kept'], ['rpoHours', 'RPO target (hours)'], ['rtoHours', 'RTO target (hours)']] as [string, string][]).map(([k, t]) =>
          <div key={k}><label htmlFor={`k-${k}`} className={label}>{t}</label><input id={`k-${k}`} type="number" min={0} className={input} value={keep[k] ?? ''} onChange={e => setKeep({ ...keep, [k]: e.target.value })} /></div>)}
        <div><button disabled={r.busy} className={btn}>Save</button></div>
      </form>
    </Section>}
  </>;
}
