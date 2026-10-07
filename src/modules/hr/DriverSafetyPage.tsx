/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-009 -- driver safety, training and duty hours (DRIVER_SAFETY_VIEW to see, DRIVER_SAFETY_EDIT to record).
//   Board: every driver with the safety score (Good 85+, Watch 70-84, At risk below 70), hours on duty in the last
//   24 hours and 7 days, the longest rest, mandatory training and whether he may start a trip now.
//   A driver: training records (with certificate), incidents, duty outside trips, trips allowed despite the rules.
//   Start Trip checks the same rules (app.driver-safety.*): over the hours or without rest stops the start unless a
//   trip is allowed here with a reason; missing training warns (or stops, when set to BLOCK).
// Backend: /api/hr/driver-safety/** (DriverSafetyController). Needs database_v2/57_driver_safety.sql.
import { FormEvent, useEffect, useState } from 'react';
import { HardHat } from 'lucide-react';
import { api, apiOpen, apiUpload } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, NoAccess, SAFETY_SCRIPT, Tabs, can, day, useMe, useRunner, when } from './hr';

export function DriverSafetyPage() {
  const me = useMe();
  const [board, setBoard] = useState<any>(null), [open, setOpen] = useState<number | null>(null), [tab, setTab] = useState('board');
  const load = () => api('/api/hr/driver-safety').then(setBoard);
  const r = useRunner(load);
  useEffect(() => { if (me && me.safetyReady !== false && can(me, 'DRIVER_SAFETY_VIEW', 'DRIVER_SAFETY_EDIT')) load().catch(e => r.setErr(e.message)); }, [me]);
  if (me && me.safetyReady === false) return <><h1 className="text-3xl font-bold">Driver Safety</h1><NotReady script={SAFETY_SCRIPT} /></>;
  if (me && !can(me, 'DRIVER_SAFETY_VIEW', 'DRIVER_SAFETY_EDIT')) return <><h1 className="text-3xl font-bold">Driver Safety</h1><NoAccess what="see driver safety" /></>;
  const edit = can(me, 'DRIVER_SAFETY_EDIT');
  const s = board?.summary || {}, st = board?.settings || {};
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><HardHat />Driver Safety</h1>
    <p className="text-slate-600">Safety score, duty hours and rest, training and incidents of every driver. Limits: {st.maxHours24h} hours in 24 hours, {st.maxHours7d} in 7 days,
      a rest of {st.minRestHours} hours in a row; over the limit {st.dutyMode === 'BLOCK' ? 'stops' : 'warns at'} Start Trip; missing training {st.trainingMode === 'BLOCK' ? 'stops' : 'warns'}.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-4">
      {[['Drivers', s.drivers, ''], ['At risk', s.atRisk, 'text-red-700'], ['May not start a trip now', s.notFit, 'text-red-700'], ['Training due', s.trainingDue, 'text-amber-700']].map(([t, v, c]) =>
        <div key={String(t)} className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">{t}</div><div className={`text-3xl font-bold ${c}`}>{v ?? '-'}</div></div>)}
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[['board', 'Drivers'], ['incidents', 'Incidents'], ['courses', 'Courses'], ...(edit ? [['allow', 'Allow a trip']] as [string, string][] : [])]} />
    <Banner msg={r.msg} error={r.err} />
    {tab === 'board' && <Section title="Drivers">
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="bg-slate-50"><th className={th}>Driver</th><th className={th}>Score</th><th className={th}>Last 24 h</th><th className={th}>Last 7 days</th><th className={th}>Longest rest (24 h)</th>
        <th className={th}>Training</th><th className={th}>Incidents (90 days)</th><th className={th}>May start a trip</th><th className={th}></th></tr></thead>
        <tbody>{(board?.rows || []).map((x: any) => <tr key={x.driverId} className={`border-t ${open === x.driverId ? 'bg-sky-50' : ''}`}>
          <td className={td}><b>{x.name}</b><div className="text-xs text-slate-500">{x.employeeCode}</div></td>
          <td className={td}><span className="text-lg font-bold">{x.score}</span> <Badge v={x.band} /></td>
          <td className={td}>{x.hours24h} h{x.onDuty && <div className="text-xs text-sky-700">on a trip now</div>}</td><td className={td}>{x.hours7d} h</td><td className={td}>{x.longestRest24h} h</td>
          <td className={td}>{x.trainingMissingOrOverdue > 0 ? <span className="font-semibold text-red-700">{x.trainingMissingOrOverdue} missing or lapsed</span> : 'Up to date'}{x.trainingDueSoon > 0 && <div className="text-xs text-amber-700">{x.trainingDueSoon} due soon</div>}</td>
          <td className={td}>{x.incidents90d}{x.openIncidents > 0 && <span className="text-xs text-amber-700"> ({x.openIncidents} open)</span>}{x.speedAlerts90d > 0 && <div className="text-xs text-slate-500">{x.speedAlerts90d} speed alerts</div>}</td>
          <td className={td}>{x.fitToDrive ? <span className="font-semibold text-emerald-700">Yes</span> : <span className="font-semibold text-red-700">No</span>}
            {(x.problems || []).map((p: string) => <div key={p} className="text-xs text-red-700">{p}</div>)}{(x.warnings || []).map((p: string) => <div key={p} className="text-xs text-amber-700">{p}</div>)}</td>
          <td className={td}><button onClick={() => setOpen(open === x.driverId ? null : x.driverId)} className={btnLight}>{open === x.driverId ? 'Close' : 'Open'}</button></td>
        </tr>)}</tbody></table></div>
    </Section>}
    {tab === 'board' && open && <DriverDetail id={open} edit={edit} onChange={load} />}
    {tab === 'incidents' && <Incidents drivers={board?.rows || []} edit={edit} onChange={load} />}
    {tab === 'courses' && <Courses edit={edit} />}
    {tab === 'allow' && edit && <Allow drivers={board?.rows || []} />}
  </>;
}

function DriverDetail({ id, edit, onChange }: { id: number; edit: boolean; onChange: () => unknown }) {
  const [d, setD] = useState<any>(null), [courses, setCourses] = useState<any[]>([]);
  const load = async () => { setD(await api('/api/hr/driver-safety/drivers/' + id)); await onChange(); };
  const r = useRunner(load);
  useEffect(() => { api('/api/hr/driver-safety/drivers/' + id).then(setD).catch(e => r.setErr(e.message)); api('/api/hr/driver-safety/courses').then(setCourses).catch(() => {}); }, [id]);
  async function training(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f);
    const file = fd.get('file') as File;
    if (await r.run(() => apiUpload(`/api/hr/driver-safety/drivers/${id}/training`, { courseId: String(fd.get('courseId')), completedOn: String(fd.get('completedOn')), trainer: String(fd.get('trainer') || ''),
      score: String(fd.get('score') || ''), certificateNo: String(fd.get('certificateNo') || ''), file: file && file.size ? file : null }), 'Training recorded')) f.reset();
  }
  async function duty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget;
    if (await r.run(() => api(`/api/hr/driver-safety/drivers/${id}/duty`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f))) }), 'Duty recorded')) f.reset();
  }
  if (!d) return <Banner error={r.err} />;
  return <Section title={`${d.name} - score ${d.score} (${d.band})`}>
    <Banner msg={r.msg} error={r.err} />
    <p className="text-sm text-slate-600">Licence {d.licenceNumber || '-'}{d.licenceExpiryDate && `, valid to ${day(d.licenceExpiryDate)}`}. Duty: {d.hours24h} h in 24 hours, {d.hours7d} h in 7 days; longest rest {d.longestRest24h} h.</p>
    <h3 className="mt-4 font-bold">Mandatory training</h3>
    <div className="mt-1 flex flex-wrap gap-2">{(d.training || []).map((t: any) => <span key={t.code} className="rounded-lg bg-slate-50 px-2 py-1 text-sm">{t.name} <Badge v={t.state} /> {t.validUntil && <span className="text-xs text-slate-500">to {day(t.validUntil)}</span>}</span>)}</div>
    <table className="mt-3 w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Course</th><th className={th}>Done</th><th className={th}>Valid to</th><th className={th}>Trainer / score</th><th className={th}>Certificate</th><th className={th}></th></tr></thead>
      <tbody>{(d.trainingRecords || []).map((t: any) => <tr key={t.id} className="border-t"><td className={td}>{t.name}</td><td className={td}>{day(t.completedOn)}</td><td className={td}>{t.validUntil ? day(t.validUntil) : 'No expiry'}</td>
        <td className={td}>{t.trainer || '-'} {t.score != null && `(${t.score})`}</td><td className={td}>{t.certificateNo || ''} {t.fileName && <button onClick={() => apiOpen(`/api/hr/driver-safety/training/${t.id}/certificate`).catch(e => r.setErr(e.message))} className="text-sky-700 underline">file</button>}</td>
        <td className={td}>{edit && <button onClick={() => { if (confirm('Remove this training record?')) void r.run(() => api('/api/hr/driver-safety/training/' + t.id, { method: 'DELETE' }), 'Removed'); }} className={btnRed}>Remove</button>}</td></tr>)}</tbody></table>
    {edit && <form onSubmit={training} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-6">
      <div className="md:col-span-2"><label className={label}>Course *</label><select name="courseId" required className={input}>{courses.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}{c.mandatory ? ' (mandatory)' : ''}</option>)}</select></div>
      <div><label className={label}>Done on *</label><input name="completedOn" type="date" required className={input} /></div>
      <div><label className={label}>Trainer</label><input name="trainer" className={input} /></div>
      <div><label className={label}>Score (0-100)</label><input name="score" type="number" min="0" max="100" step="0.1" className={input} /></div>
      <div><label className={label}>Certificate no.</label><input name="certificateNo" className={input} /></div>
      <div className="md:col-span-3"><label className={label}>Certificate file (PDF, JPG, PNG)</label><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" className={input} /></div>
      <div className="flex items-end"><button disabled={r.busy} className={btn}>Record training</button></div>
    </form>}
    <h3 className="mt-5 font-bold">Duty outside trips (last 14 days)</h3>
    <p className="text-xs text-slate-500">Trips count by themselves (actual start to end). Record here loading, other driving or work that is not a trip.</p>
    <table className="mt-1 w-full text-sm"><tbody>{(d.dutyLog || []).map((x: any) => <tr key={x.id} className="border-t"><td className={td}>{x.kind === 'DRIVING' ? 'Driving' : 'Other work'}</td><td className={td}>{when(x.startedAt)} to {when(x.endedAt)}</td><td className={td}>{x.hours} h</td><td className={td}>{x.note}</td>
      <td className={td}>{edit && <button onClick={() => r.run(() => api('/api/hr/driver-safety/duty/' + x.id, { method: 'DELETE' }), 'Removed')} className={btnRed}>Remove</button>}</td></tr>)}</tbody></table>
    {edit && <form onSubmit={duty} className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-5">
      <div><label className={label}>Kind</label><select name="kind" className={input}><option value="OTHER_WORK">Other work</option><option value="DRIVING">Driving (not a trip)</option></select></div>
      <div><label className={label}>From *</label><input name="from" type="datetime-local" required className={input} /></div>
      <div><label className={label}>To *</label><input name="to" type="datetime-local" required className={input} /></div>
      <div><label className={label}>Note</label><input name="note" className={input} /></div>
      <div className="flex items-end"><button disabled={r.busy} className={btn}>Record duty</button></div>
    </form>}
    {(d.overrides || []).length > 0 && <><h3 className="mt-5 font-bold">Trips allowed despite the rules</h3>
      <table className="mt-1 w-full text-sm"><tbody>{d.overrides.map((o: any) => <tr key={o.id} className="border-t"><td className={td}>{o.tripNumber}</td><td className={td}>{o.reason}</td><td className={td}>{o.grantedBy} {when(o.grantedAt)}</td></tr>)}</tbody></table></>}
  </Section>;
}

function Incidents({ drivers, edit, onChange }: { drivers: any[]; edit: boolean; onChange: () => unknown }) {
  const [status, setStatus] = useState('OPEN'), [rows, setRows] = useState<any[]>([]), [settings, setSettings] = useState<any>({});
  const load = async () => { setRows(await api('/api/hr/driver-safety/incidents?status=' + status)); await onChange(); };
  const r = useRunner(load);
  useEffect(() => { api('/api/hr/driver-safety/incidents?status=' + status).then(setRows).catch(e => r.setErr(e.message)); }, [status]);
  useEffect(() => { api('/api/hr/driver-safety/settings').then(setSettings).catch(() => {}); }, []);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const b: any = Object.fromEntries(new FormData(f)); b.injury = b.injury === 'on';
    if (await r.run(() => api('/api/hr/driver-safety/incidents', { method: 'POST', body: JSON.stringify(b) }), 'Incident recorded')) f.reset();
  }
  return <>
    <Banner msg={r.msg} error={r.err} />
    {edit && <Section title="Record an incident">
      <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>Driver *</label><select name="driverId" required className={input}><option value="">Choose</option>{drivers.map(x => <option key={x.driverId} value={x.driverId}>{x.name}</option>)}</select></div>
        <div><label className={label}>When *</label><input name="occurredAt" type="datetime-local" required className={input} /></div>
        <div><label className={label}>Kind *</label><select name="kind" required className={input}>{(settings.kinds || []).map((k: string) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}</select></div>
        <div><label className={label}>Severity *</label><select name="severity" required className={input}>{(settings.severities || []).map((k: string) => <option key={k}>{k}</option>)}</select></div>
        <div><label className={label}>Trip number</label><input name="tripNumber" className={input} /></div>
        <div><label className={label}>Place</label><input name="place" className={input} /></div>
        <div><label className={label}>Damage (Rs.)</label><input name="damageAmount" type="number" min="0" step="0.01" className={input} /></div>
        <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="injury" className="h-4 w-4" />Someone was hurt</label>
        <div className="md:col-span-2"><label className={label}>What happened *</label><textarea name="description" required rows={2} className={input} /></div>
        <div className="md:col-span-2"><label className={label}>Action taken</label><textarea name="actionTaken" rows={2} className={input} /></div>
        <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Record incident</button></div>
      </form>
    </Section>}
    <Section title="Incidents" right={<select value={status} onChange={e => setStatus(e.target.value)} className={input}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="ALL">All</option></select>}>
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>When</th><th className={th}>Driver</th><th className={th}>What</th><th className={th}>Severity</th><th className={th}>Action</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id} className="border-t"><td className={td}>{when(x.occurredAt)}</td><td className={td}>{x.driverName}{x.tripNumber && <div className="text-xs text-slate-500">{x.tripNumber}</div>}</td>
          <td className={td}><b>{String(x.kind).replace(/_/g, ' ')}</b> {x.place && `at ${x.place}`}<div className="text-xs">{x.description}</div>{x.injury && <div className="text-xs font-bold text-red-700">Injury</div>}</td>
          <td className={td}><Badge v={x.severity} /></td><td className={td}>{x.actionTaken || '-'}</td><td className={td}><Badge v={x.status} /></td>
          <td className={td}>{edit && x.status === 'OPEN' && <button onClick={() => { const a = window.prompt('Action taken', x.actionTaken || ''); if (a) void r.run(() => api(`/api/hr/driver-safety/incidents/${x.id}/close`, { method: 'POST', body: JSON.stringify({ actionTaken: a }) }), 'Closed'); }} className={btnLight}>Close</button>}</td></tr>)}</tbody></table>
    </Section>
  </>;
}

function Courses({ edit }: { edit: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/hr/driver-safety/courses').then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const b: any = Object.fromEntries(f); b.mandatory = f.get('mandatory') === 'on'; b.active = f.get('active') === 'on';
    await r.run(() => api('/api/hr/driver-safety/courses/' + encodeURIComponent(String(b.code).toUpperCase()), { method: 'PUT', body: JSON.stringify(b) }), 'Course saved');
  }
  return <Section title="Training courses"><Banner msg={r.msg} error={r.err} />
    <p className="mb-2 text-sm text-slate-500">Mandatory courses count for the score and the Start Trip check. Valid for: months until it must be done again (empty = once).</p>
    {[...rows, ...(edit ? [{ code: '', name: '', mandatory: false, validityMonths: '', active: true, isNew: true }] : [])].map((c: any) =>
      <form key={c.code || 'new'} onSubmit={save} className="grid gap-2 border-t py-2 md:grid-cols-6">
        <input name="code" defaultValue={c.code} readOnly={!c.isNew} required placeholder="Code" className={input} />
        <input name="name" defaultValue={c.name} required placeholder="Name" className={`${input} md:col-span-2`} />
        <input name="validityMonths" type="number" min="1" defaultValue={c.validityMonths ?? ''} placeholder="Valid for (months)" className={input} />
        <div className="flex items-center gap-3 text-sm"><label className="flex items-center gap-1"><input type="checkbox" name="mandatory" defaultChecked={c.mandatory} />Mandatory</label><label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={c.active} />On</label></div>
        {edit && <button disabled={r.busy} className={btnLight}>{c.isNew ? 'Add' : 'Save'}</button>}
      </form>)}
  </Section>;
}

function Allow({ drivers }: { drivers: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/hr/driver-safety/overrides').then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  async function allow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget;
    if (await r.run(() => api('/api/hr/driver-safety/overrides', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(f))) }), 'Allowed. Start Trip shows the rule as a warning for this trip.')) f.reset();
  }
  return <Section title="Allow one trip despite the duty or training rule"><Banner msg={r.msg} error={r.err} />
    <form onSubmit={allow} className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Driver *</label><select name="driverId" required className={input}><option value="">Choose</option>{drivers.map(x => <option key={x.driverId} value={x.driverId}>{x.name}{x.fitToDrive ? '' : ' (may not start now)'}</option>)}</select></div>
      <div><label className={label}>Trip number *</label><input name="tripNumber" required className={input} /></div>
      <div className="md:col-span-2"><label className={label}>Why is it safe? *</label><input name="reason" required minLength={10} placeholder="Short local trip with a co-driver" className={input} /></div>
      <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Allow this trip</button></div>
    </form>
    <table className="mt-4 w-full text-sm"><tbody>{rows.map(o => <tr key={o.id} className="border-t"><td className={td}>{o.driverName}</td><td className={td}>{o.tripNumber}</td><td className={td}>{o.reason}</td><td className={td}>{o.grantedBy} {when(o.grantedAt)}</td></tr>)}</tbody></table>
  </Section>;
}
