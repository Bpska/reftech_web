/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-014 -- Government Connections: every outside system (FASTag, Parivahan, Sarathi, e-Challan, GST,
// FSSAI, DigiLocker, road safety, e-way bill, weather), how it is reached (by hand, sample data, ULIP, a service
// provider, DigiLocker), whether it works, its last error and the call log. An Admin sets the address and the
// keys (stored encrypted, never shown again), tests it and runs a timed check now. Others can only look.
// Backend: /api/gov/connections (GovController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, when } from './gov';

const STATE: Record<string, [string, string]> = {
  WORKING: ['Working', 'bg-emerald-100 text-emerald-800'], SLOW: ['Slow', 'bg-amber-100 text-amber-800'], FAILING: ['Failing', 'bg-red-100 text-red-800'],
  MANUAL: ['Typed by hand', 'bg-slate-100 text-slate-700'], NOT_CONNECTED: ['Not connected', 'bg-amber-100 text-amber-800'], NOT_USED: ['Not used', 'bg-slate-100 text-slate-500'],
};
const JOBS: [string, string][] = [['TOLLS', 'Tolls of running trips'], ['VAHAN', 'Parivahan of all trucks'], ['FASTAG', 'FASTag of all trucks'], ['CHALLANS', 'Challans of all trucks'],
  ['LICENCES', 'Licences of all drivers'], ['GST', 'GST of partners and transporters'], ['FSSAI', 'FSSAI reminders'], ['CALENDAR', 'Calendar reminders'], ['SUMMARY', '08:00 summary email']];

export function GovConnectionsPage() {
  const [d, setD] = useState<any>(null), [edit, setEdit] = useState<any>(null), [log, setLog] = useState<{ system: string; rows: any[] } | null>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [provider, setProvider] = useState('');
  const load = () => api('/api/gov/connections').then(setD).catch(e => setErr(errorText(e, 'The connections could not be read')));
  useEffect(() => { void load(); }, []);

  async function run(fn: () => Promise<any>, done: (x: any) => string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done(x)); await load(); return x; }
    catch (e) { setErr(errorText(e, 'Not saved')); return null; } finally { setBusy(false); }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b: any = Object.fromEntries(f); b.enabled = f.get('enabled') === 'on'; b.clearSecret = f.get('clearSecret') === 'on';
    if (!b.secret) delete b.secret;
    if (await run(() => api(`/api/gov/connections/${edit.system}`, { method: 'PUT', body: JSON.stringify(b) }), () => 'Connection saved')) setEdit(null);
  }
  const test = (system: string) => run(() => api(`/api/gov/connections/${system}/test`, { method: 'POST' }), x => x.message || (x.ok ? 'Working' : 'Failed'));
  const showLog = (system: string) => api(`/api/gov/connections/${system}/calls?limit=100`).then(rows => setLog({ system, rows })).catch(e => setErr(errorText(e, 'The call log could not be read')));
  const runJob = (job: string) => run(() => api(`/api/gov/run/${job}`, { method: 'POST' }), x => `Done: ${Object.entries(x || {}).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">Government Connections</h1><NotReady script={SCRIPT} /></>;
  const needsUrl = (p: string) => ['ULIP', 'HTTP', 'DIGILOCKER'].includes(p);
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Plug />Government Connections</h1>
    <p className="text-slate-600">How each government system is reached and whether it works. Every screen works by hand until a system is connected.{d && !d.canEdit ? ' Only an Admin can change these.' : ''}</p>
    <Banner msg={msg} error={err} />
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> :
        <table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">System</th><th>Gives</th><th>Reached by</th><th>State</th><th>Last success</th><th>This month</th><th /></tr></thead>
          <tbody>{d.connections.map((c: any) => <tr key={c.system} className="border-t align-top">
            <td className="p-2 font-semibold">{c.name}<div className="text-xs font-normal text-slate-500">Suggested: {c.suggestedRoute}</div></td>
            <td className="max-w-xs text-xs">{c.gives}</td>
            <td>{c.providerLabel || c.provider}{!c.enabled ? <span className="text-xs text-slate-500"> (off)</span> : null}</td>
            <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATE[c.state]?.[1] || ''}`}>{STATE[c.state]?.[0] || c.state}</span>
              {c.stateNote ? <div className="max-w-xs text-xs text-slate-500">{c.stateNote}</div> : null}
              {c.lastError && c.state === 'FAILING' ? <div className="max-w-xs text-xs text-red-700">{c.lastError}</div> : null}</td>
            <td className="whitespace-nowrap text-xs">{c.lastSuccessAt ? when(c.lastSuccessAt) : '-'}{c.lastLatencyMs != null ? <div className="text-slate-500">{c.lastLatencyMs} ms</div> : null}</td>
            <td className="text-xs">{Number(c.callsThisMonth || 0)} calls{Number(c.failedThisMonth) > 0 ? <span className="text-red-700">, {c.failedThisMonth} failed</span> : ''}</td>
            <td className="whitespace-nowrap p-2">{d.canEdit && <><button className={btnLight} onClick={() => { setEdit(c); setProvider(c.provider); }}>Set up</button>{' '}
              <button className={btnLight} disabled={busy} onClick={() => test(c.system)}>Test</button>{' '}
              <button className={btnLight} onClick={() => showLog(c.system)}>Calls</button></>}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    {edit && <Section title={`Set up ${edit.name}`} right={<button className={btnLight} onClick={() => setEdit(null)}>Close</button>}>
      <form key={edit.system} onSubmit={save} className="grid gap-3 md:grid-cols-3">
        <div><span className={label}>Reached by *</span><select name="provider" value={provider} onChange={e => setProvider(e.target.value)} className={input}>
          {(edit.providers || []).map((p: any) => <option key={p.code} value={p.code}>{p.label}</option>)}</select></div>
        {needsUrl(provider) && <>
          <div className="md:col-span-2"><span className={label}>Address (base URL)</span><input name="baseUrl" defaultValue={edit.baseUrl || ''} className={input} placeholder="https://..." /></div>
          <div><span className={label}>User name</span><input name="username" defaultValue={edit.username || ''} className={input} autoComplete="off" /></div>
          <div><span className={label}>Client id</span><input name="clientId" defaultValue={edit.clientId || ''} className={input} autoComplete="off" /></div>
          <div><span className={label}>Secret or key {edit.secretStored ? '(stored; leave blank to keep)' : ''}</span><input name="secret" type="password" className={input} autoComplete="new-password" /></div>
          {edit.secretStored && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="clearSecret" />Remove the stored secret</label>}
          <div className="md:col-span-3"><span className={label}>Options (JSON, as the provider needs)</span><textarea name="options" rows={2} defaultValue={edit.options || ''} className={input} placeholder='{"path.vehicle":"/vahan/vehicle"}' /></div>
        </>}
        {provider === 'SAMPLE' && <p className="text-sm text-amber-800 md:col-span-3">Sample data is for trying the screens. Nothing it gives is real.</p>}
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="enabled" defaultChecked={edit.enabled !== false} />In use</label>
        <div className="md:col-span-3"><button className={btn} disabled={busy}>Save</button></div>
      </form>
    </Section>}

    {log && <Section title={`Calls to ${d?.connections?.find((c: any) => c.system === log.system)?.name || log.system}`} right={<button className={btnLight} onClick={() => setLog(null)}>Close</button>}>
      {!log.rows.length ? <p className="text-sm text-slate-500">No call yet.</p> :
        <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">When</th><th>What</th><th>Subject</th><th>By</th><th>Result</th><th>Time</th></tr></thead>
          <tbody>{log.rows.map(r => <tr key={r.id} className="border-t align-top">
            <td className="whitespace-nowrap p-2">{when(r.calledAt)}</td><td>{r.purpose}</td><td>{r.subject || '-'}</td><td>{r.userName || 'System'}</td>
            <td className={r.ok ? 'text-emerald-700' : 'text-red-700'}>{r.ok ? 'OK' : 'Failed'}{r.message ? <div className="text-xs">{r.message}</div> : null}</td><td>{r.latencyMs != null ? `${r.latencyMs} ms` : '-'}</td>
          </tr>)}</tbody></table>}
    </Section>}

    {d?.canEdit && <Section title="Run a timed check now">
      <p className="text-sm text-slate-600">These run by themselves: tolls every 30 minutes, Parivahan and FASTag at night, challans at 06:00, reminders at 07:00, the summary email at 08:00, licences and GST on the 1st.</p>
      <div className="mt-2 flex flex-wrap gap-2">{JOBS.map(([k, t]) => <button key={k} className={btnLight} disabled={busy} onClick={() => runJob(k)}>{t}</button>)}</div>
    </Section>}
  </>;
}
