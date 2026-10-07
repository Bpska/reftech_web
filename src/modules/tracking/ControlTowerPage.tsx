/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-005 -- Control Tower: every alert of the company in one queue, highest priority first, with escalation.
//
// Staff page (Employee, Manager, Admin). Anyone can take an alert, acknowledge, resolve with a cause, escalate
// and write a note; only a Manager or an Admin gives an alert to someone else. An alert nobody acknowledges
// goes up by itself (level 1: Manager, level 2: Admin). The list refreshes every 60 seconds.
//
// Backend: /api/tower/alerts, /api/tower/alerts/{id}/assign|acknowledge|resolve|escalate|note|history,
// /api/tower/staff (ControlTowerController).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, RadioTower, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { role } from '@/modules/transporter/transporter';
import { PRIORITY, minutesText, minutesUntil, pill, when } from './tower';
import { fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

type Alert = {
  id: number; alertType: string; typeLabel: string; severity?: string | null; status: string; message: string; priority: string;
  measuredValue?: number | null; thresholdValue?: number | null; createdAt: string; acknowledgedAt?: string | null; resolvedAt?: string | null;
  escalationLevel: number; escalatedAt?: string | null; escalatedToName?: string | null; causeCode?: string | null; correctiveAction?: string | null;
  assignedToUserId?: number | null; assignedToName?: string | null; assignedAt?: string | null; nextEscalationAt?: string | null;
  towerCauseCode?: string | null; acknowledgedByName?: string | null; resolvedByName?: string | null;
  tripId?: number | null; tripNumber?: string | null; tripStatus?: string | null; sourceCity?: string | null; destinationCity?: string | null;
  vehicleNumber?: string | null; partnerName?: string | null; driverName?: string | null; driverPhone?: string | null; ageMinutes?: number | null; resolvedHere?: boolean;
};
type Counts = { byPriority: Record<string, number>; byType: Record<string, number>; open: number; acknowledged: number; escalated: number };
type Queue = { ready: boolean; message?: string; alerts: Alert[]; counts: Counts; types: Record<string, string>; causes: Record<string, string>; temperatureCauses: Record<string, string> };
type Staff = { userId: number; name: string; role: string };
type History = { action: string; fromStatus?: string | null; toStatus?: string | null; byName?: string; notes?: string | null; at: string };
type Panel = { id: number; kind: 'give' | 'ack' | 'resolve' | 'escalate' | 'note' | 'history' };

const FILTERS: [string, string][] = [['OPEN', 'Open'], ['MINE', 'Mine'], ['UNASSIGNED', 'Not taken'], ['ESCALATED', 'Escalated'], ['RESOLVED', 'Resolved (7 days)']];
const TEMPERATURE = ['HIGH_TEMPERATURE', 'LOW_TEMPERATURE'];
const STATUS: Record<string, string> = { OPEN: 'bg-red-100 text-red-800', ACKNOWLEDGED: 'bg-amber-100 text-amber-800', RESOLVED: 'bg-emerald-100 text-emerald-800', CLOSED: 'bg-emerald-100 text-emerald-800' };
const STATUS_LABEL: Record<string, string> = { OPEN: 'Open', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const small = 'rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const cell = 'px-2.5 py-3 align-top';

export function ControlTowerPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const [filter, setFilter] = useState('OPEN');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [data, setData] = useState<Queue | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [history, setHistory] = useState<Record<number, History[]>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const manager = role().manager;

  const load = useCallback(async () => {
    const q = new URLSearchParams({ filter });
    if (type) q.set('type', type);
    if (priority) q.set('priority', priority);
    try { setData(await api(`/api/tower/alerts?${q}`)); setLoadedAt(new Date()); }
    catch (x) { setErr(errorText(x, 'Could not load the alerts')); }
  }, [filter, type, priority]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => { void load(); }, 60000);
    return () => window.clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!manager) return;
    api('/api/tower/staff').then(s => setStaff(Array.isArray(s) ? s : [])).catch(() => setStaff([]));
  }, [manager]);

  async function post(a: Alert, action: string, body: Record<string, unknown>, fail: string) {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await api(`/api/tower/alerts/${a.id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
      setMsg(`Alert ${a.id} (${a.typeLabel}): ${r?.message || 'Done.'}`);
      setPanel(null);
      setHistory(h => { const n = { ...h }; delete n[a.id]; return n; });
      await load();
      return true;
    } catch (x) { setErr(errorText(x, fail)); return false; }
    finally { setBusy(false); }
  }

  async function showHistory(a: Alert) {
    if (panel?.id === a.id && panel.kind === 'history') { setPanel(null); return; }
    setPanel({ id: a.id, kind: 'history' });
    try { const h = await api(`/api/tower/alerts/${a.id}/history`); setHistory(x => ({ ...x, [a.id]: Array.isArray(h) ? h : [] })); }
    catch (x) { setErr(errorText(x, 'Could not load the history')); }
  }

  function submit(e: FormEvent<HTMLFormElement>, a: Alert, kind: Panel['kind']) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) || '').trim();
    if (kind === 'give') void post(a, 'assign', { toUserId: Number(s('toUserId')), note: s('note') || null }, 'Could not give the alert');
    if (kind === 'ack') void post(a, 'acknowledge', { note: s('note') || null }, 'Could not acknowledge the alert');
    if (kind === 'escalate') void post(a, 'escalate', { reason: s('reason') }, 'Could not escalate the alert');
    if (kind === 'note') void post(a, 'note', { note: s('note') }, 'Could not add the note');
    if (kind === 'resolve') void post(a, 'resolve', { causeCode: s('causeCode'), correctiveAction: s('correctiveAction'), causeNotes: s('causeNotes') || null, note: s('note') || null }, 'Could not resolve the alert');
  }

  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;
  const ready = data?.ready ?? true;
  const alerts = data?.alerts || [];
  const counts = data?.counts;
  const tab = (f: string, text: string) => <button key={f} type="button" onClick={() => { setFilter(f); setPanel(null); }}
    className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === f ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{text}</button>;
  const toggle = (k: Panel['kind'], a: Alert) => { setMsg(''); setErr(''); setPanel(p => (p?.id === a.id && p.kind === k ? null : { id: a.id, kind: k })); };

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><RadioTower className="h-8 w-8 text-sky-700" />Control Tower</h1>
        <p className="text-slate-600">All alerts in one queue, most urgent first. Take an alert, act on it and resolve it with the cause. An alert nobody acknowledges goes up to a Manager, then to an Admin. Times are India time.</p>
      </div>
      <div className="text-right">
        <button type="button" onClick={() => { setMsg(''); setErr(''); void load(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400"><RefreshCw className="h-4 w-4" />Refresh</button>
        <div className="mt-1 text-xs text-slate-500">{loadedAt ? `Updated ${fmtTime(loadedAt)}, refreshes every minute` : 'Loading...'}</div>
      </div>
    </div>
    <Banner msg={msg} error={err} />
    {data && !data.ready && data.message && <div className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">{data.message}</div>}

    {counts && <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => {
        const s = PRIORITY[p];
        const on = priority === p;
        return <button key={p} type="button" onClick={() => setPriority(on ? '' : p)} title={on ? 'Show all priorities' : `Show only ${s.label.toLowerCase()} alerts`}
          className={`rounded-2xl border-2 p-4 text-left shadow-sm transition ${s.card} ${on ? 'ring-4 ring-sky-400' : 'hover:opacity-90'}`}>
          <div className="text-sm font-bold uppercase">{s.label}</div>
          <div className="text-3xl font-bold">{Number(counts.byPriority?.[p] || 0)}</div>
          <div className="text-xs">open alerts</div>
        </button>;
      })}
    </div>}
    {counts && <div className="mt-2 text-sm text-slate-600">{counts.open} open, {counts.acknowledged} acknowledged, {counts.escalated} escalated.{priority && <button type="button" onClick={() => setPriority('')} className="ml-2 font-semibold text-sky-700 hover:underline">Show all priorities</button>}</div>}

    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">{FILTERS.filter(([f]) => ready || (f !== 'MINE' && f !== 'UNASSIGNED')).map(([f, t]) => tab(f, t))}</div>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Alert type" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All types</option>
          {Object.entries(data?.types || {}).map(([k, v]) => <option key={k} value={k}>{v}{counts?.byType?.[k] ? ` (${counts.byType[k]})` : ''}</option>)}
        </select>
      </div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1250px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600">
          <th className={cell}>Priority</th><th className={cell}>Alert</th><th className={cell}>Trip / truck</th><th className={cell}>Driver</th><th className={cell}>Age</th>
          <th className={cell}>Status</th><th className={cell}>With</th><th className={cell}>Escalation</th><th className={cell}></th>
        </tr></thead>
        <tbody>
          {alerts.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">{data ? 'No alert in this list.' : 'Loading...'}</td></tr>}
          {alerts.map(a => {
            const p = PRIORITY[a.priority] || PRIORITY.LOW;
            const done = a.status === 'RESOLVED' || a.status === 'CLOSED';
            const next = minutesUntil(a.nextEscalationAt);
            const open = panel?.id === a.id ? panel.kind : null;
            return [
              <tr key={a.id} className={`border-t border-slate-200 ${open ? 'bg-sky-50/40' : ''}`}>
                <td className={cell}><span className={`${pill} ${p.pill}`}>{p.label}</span></td>
                <td className={`${cell} max-w-[22rem]`}><div className="font-bold">{a.typeLabel}</div><div>{a.message}</div>
                  {a.measuredValue != null && <div className="text-xs text-slate-500">Measured {Number(a.measuredValue)}{a.thresholdValue != null ? `, limit ${Number(a.thresholdValue)}` : ''}</div>}
                  <div className="text-xs text-slate-500">Raised {when(a.createdAt)} (no. {a.id})</div>
                  {done && <div className="mt-1 text-xs text-emerald-800">Resolved {when(a.resolvedAt)}{a.resolvedByName ? ` by ${a.resolvedByName}` : ''}{a.correctiveAction ? `: ${a.correctiveAction}` : ''}</div>}</td>
                <td className={`${cell} whitespace-nowrap`}>{a.tripId ? <Link to={`/trips/${a.tripId}`} className="font-semibold text-sky-700 hover:underline">{a.tripNumber || `Trip ${a.tripId}`}</Link> : <span className="text-slate-500">No trip</span>}
                  {(a.sourceCity || a.destinationCity) && <div className="text-xs text-slate-500">{a.sourceCity || '?'} to {a.destinationCity || '?'}</div>}
                  <div>{a.vehicleNumber || '-'}</div>{a.partnerName && <div className="text-xs text-slate-500">{a.partnerName}</div>}</td>
                <td className={`${cell} whitespace-nowrap`}>{a.driverName || '-'}{a.driverPhone && <div><a href={`tel:${a.driverPhone}`} className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"><Phone className="h-3.5 w-3.5" />{a.driverPhone}</a></div>}</td>
                <td className={`${cell} whitespace-nowrap`}>{minutesText(a.ageMinutes)}</td>
                <td className={cell}><span className={`${pill} ${STATUS[a.status] || 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[a.status] || a.status}</span>
                  {a.acknowledgedByName && a.status === 'ACKNOWLEDGED' && <div className="text-xs text-slate-500">by {a.acknowledgedByName}</div>}</td>
                <td className={`${cell} whitespace-nowrap`}>{a.assignedToName ? <><b>{a.assignedToName}</b><div className="text-xs text-slate-500">since {when(a.assignedAt)}</div></> : <span className="text-slate-500">{ready ? 'Nobody yet' : '-'}</span>}</td>
                <td className={`${cell} whitespace-nowrap`}>{a.escalationLevel > 0
                  ? <><span className={`${pill} bg-red-100 text-red-800`}>Level {a.escalationLevel}</span>{a.escalatedToName && <div className="text-xs">to {a.escalatedToName}</div>}<div className="text-xs text-slate-500">{when(a.escalatedAt)}</div></>
                  : <span className="text-slate-500">Not escalated</span>}
                  {!done && a.nextEscalationAt && <div className={`text-xs ${next != null && next <= 0 ? 'font-bold text-red-700' : 'text-slate-600'}`}>Next: {when(a.nextEscalationAt)}{next != null && (next > 0 ? ` (in ${minutesText(next)})` : ' (due now)')}</div>}</td>
                <td className={`${cell} text-right`}><div className="flex max-w-[15rem] flex-wrap justify-end gap-1.5">
                  {!done && ready && <button type="button" className={small} disabled={busy} onClick={() => post(a, 'assign', {}, 'Could not take the alert')}>Take</button>}
                  {!done && ready && manager && <button type="button" className={small} disabled={busy} onClick={() => toggle('give', a)}>Give to</button>}
                  {a.status === 'OPEN' && <button type="button" className={small} disabled={busy} onClick={() => toggle('ack', a)}>Acknowledge</button>}
                  {!done && <button type="button" className={`${small} border-emerald-400 text-emerald-800`} disabled={busy} onClick={() => toggle('resolve', a)}>Resolve</button>}
                  {!done && ready && a.escalationLevel < 2 && <button type="button" className={`${small} border-red-300 text-red-700`} disabled={busy} onClick={() => toggle('escalate', a)}>Escalate</button>}
                  <button type="button" className={small} disabled={busy} onClick={() => toggle('note', a)}>Note</button>
                  <button type="button" className={small} onClick={() => showHistory(a)}>{open === 'history' ? 'Hide history' : 'History'}</button>
                </div></td>
              </tr>,
              open && <tr key={`${a.id}-panel`} className="bg-sky-50/40"><td colSpan={9} className="px-2.5 pb-4">
                {open === 'history'
                  ? <HistoryList rows={history[a.id]} />
                  : <form onSubmit={e => submit(e, a, open)} className="grid gap-3 rounded-xl border border-sky-200 bg-white p-3 md:grid-cols-4">
                    <ActionFields kind={open} a={a} data={data} staff={staff} />
                    <div className="flex items-end gap-2 md:col-span-full">
                      <button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50">{BUTTON[open]}</button>
                      <button type="button" onClick={() => setPanel(null)} className={btnLight}>Cancel</button>
                    </div>
                  </form>}
              </td></tr>,
            ];
          })}
        </tbody>
      </table></div>
    </section>
  </>;
}

const BUTTON: Record<Panel['kind'], string> = { give: 'Give the alert', ack: 'Acknowledge', resolve: 'Resolve the alert', escalate: 'Escalate', note: 'Add note', history: '' };

function ActionFields({ kind, a, data, staff }: { kind: Panel['kind']; a: Alert; data: Queue | null; staff: Staff[] }) {
  const [cause, setCause] = useState('');
  if (kind === 'give') return <>
    <div><label className={label}>Give to<span className="text-red-600"> *</span></label>
      <select name="toUserId" required defaultValue="" className={input}><option value="" disabled>Choose a person</option>
        {staff.map(s => <option key={s.userId} value={s.userId}>{s.name} ({s.role.toLowerCase()})</option>)}</select></div>
    <div className="md:col-span-3"><label className={label}>Note</label><input name="note" maxLength={500} className={input} placeholder="Optional: what they should do" /></div>
  </>;
  if (kind === 'ack') return <div className="md:col-span-full"><label className={label}>Note</label>
    <input name="note" maxLength={900} className={input} placeholder="Optional: for example, called the driver, checking" />
    <div className="mt-0.5 text-xs text-slate-500">Acknowledging stops the automatic escalation and puts the alert with you if nobody has it.</div></div>;
  if (kind === 'escalate') return <div className="md:col-span-full"><label className={label}>Why is it escalated?<span className="text-red-600"> *</span></label>
    <input name="reason" required minLength={3} maxLength={900} className={input} placeholder="For example: driver not answering, needs a decision" />
    <div className="mt-0.5 text-xs text-slate-500">It goes to level {a.escalationLevel + 1}: {a.escalationLevel === 0 ? 'the partner manager or a Manager' : 'an Admin'}.</div></div>;
  if (kind === 'note') return <div className="md:col-span-full"><label className={label}>Note<span className="text-red-600"> *</span></label>
    <textarea name="note" required minLength={2} maxLength={900} rows={2} className={input} placeholder="What was done or found" /></div>;
  const temperature = TEMPERATURE.includes(a.alertType);
  const causes = (temperature ? data?.temperatureCauses : data?.causes) || {};
  return <>
    <div><label className={label}>Cause<span className="text-red-600"> *</span></label>
      <select name="causeCode" required value={cause} onChange={e => setCause(e.target.value)} className={input}><option value="" disabled>Choose the cause</option>
        {Object.entries(causes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    {temperature && <div><label className={label}>About the cause{cause === 'OTHER' && <span className="text-red-600"> *</span>}</label>
      <input name="causeNotes" required={cause === 'OTHER'} maxLength={500} className={input} placeholder={cause === 'OTHER' ? 'Describe the cause' : 'Optional'} /></div>}
    <div className={temperature ? 'md:col-span-2' : 'md:col-span-3'}><label className={label}>What was done<span className="text-red-600"> *</span></label>
      <input name="correctiveAction" required minLength={5} maxLength={900} className={input}
        placeholder={a.alertType === 'DOOR_OPEN_UNPLANNED' ? 'For example: driver opened the door for a police check, seal replaced' : 'For example: reefer reset, temperature back in range'} /></div>
    <div className="md:col-span-full"><label className={label}>Note</label><input name="note" maxLength={900} className={input} placeholder="Optional" /></div>
  </>;
}

function HistoryList({ rows }: { rows?: History[] }) {
  if (!rows) return <div className="p-3 text-slate-400">Loading the history...</div>;
  if (rows.length === 0) return <div className="p-3 text-slate-500">Nothing recorded yet.</div>;
  return <ol className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-sm">
    {rows.map((h, i) => <li key={i} className="flex flex-wrap gap-x-3">
      <span className="whitespace-nowrap text-slate-500">{when(h.at)}</span>
      <b>{h.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</b>
      {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus && <span className="text-slate-600">{STATUS_LABEL[h.fromStatus] || h.fromStatus} to {STATUS_LABEL[h.toStatus] || h.toStatus}</span>}
      <span className="text-slate-600">by {h.byName || 'System'}</span>
      {h.notes && <span className="basis-full pl-0 text-slate-800 md:basis-auto">{h.notes}</span>}
    </li>)}
  </ol>;
}
