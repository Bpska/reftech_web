/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-001 -- Temperature Alerts: list, acknowledge and resolve temperature excursions.
//
// Backend: /api/monitoring/excursions (ExcursionController). An alert is raised only after readings
// stay outside the allowed range for the configured time, then moves OPEN -> ACKNOWLEDGED -> RESOLVED.
// Resolving needs a cause and a corrective action; the server enforces it, this page only helps.
import { FormEvent, Fragment, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Clock3, RefreshCw, ShieldCheck, Thermometer } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { fmtDateTime, fmtTemp, fmtTempRange } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

type Excursion = {
  id: number; alertType: 'HIGH_TEMPERATURE' | 'LOW_TEMPERATURE'; severity: string; status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  message?: string; thresholdValue?: number; lastValue?: number; peakValue?: number;
  raisedAt?: string; excursionStartedAt?: string; recoveredAt?: string | null; minutesOutOfRange?: number; stillOutOfRange?: boolean;
  ownerName?: string | null; acknowledgedAt?: string | null; causeLabel?: string | null; causeNotes?: string | null;
  correctiveAction?: string | null; resolvedByName?: string | null; resolvedAt?: string | null;
  escalated?: boolean; escalatedAt?: string | null; escalatedToName?: string | null; escalationDueAt?: string | null;
  tripNumber?: string; sourceCity?: string; destinationCity?: string; requiredTempMinC?: number | null; requiredTempMaxC?: number | null;
  tripLoadId?: number | null; vehicleNumber?: string; partnerName?: string; canAcknowledge?: boolean; canResolve?: boolean;
};
type HistoryRow = { id: number; action: string; notes?: string | null; actionBy?: string; createdAt?: string };
type Cause = { code: string; label: string };
type Summary = { open?: number; acknowledged?: number; escalated?: number; resolvedToday?: number; sustainedMinutes?: number; escalationMinutes?: number };
type Filter = 'ACTIVE' | 'RESOLVED' | 'ALL';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const cell = 'px-2.5 py-3';

const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const degrees = (v?: number | null) => fmtTemp(v);
const range = (r: Excursion) =>
  fmtTempRange(r.requiredTempMinC, r.requiredTempMaxC);
const duration = (min?: number) => {
  const m = Number(min || 0);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const ACTION_TEXT: Record<string, string> = {
  RAISED: 'Alert raised', RECURRED: 'Out of range again', RECOVERED: 'Back in range',
  ACKNOWLEDGED: 'Acknowledged', ESCALATED: 'Escalated', RESOLVED: 'Resolved',
};

function StatusBadge({ r }: { r: Excursion }) {
  const style = r.status === 'OPEN' ? 'bg-red-100 text-red-800' : r.status === 'ACKNOWLEDGED' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  const text = r.status === 'OPEN' ? 'Open' : r.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Resolved';
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${style}`}>{text}</span>;
}

export function ExcursionsPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const user = currentUser();
  const role = String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase();
  const allowed = ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(role);

  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [rows, setRows] = useState<Excursion[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [causes, setCauses] = useState<Cause[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (f: Filter) => {
    try {
      const [list, sum] = await Promise.all([api(`/api/monitoring/excursions?status=${f}`), api('/api/monitoring/excursions/summary')]);
      setRows(Array.isArray(list) ? list : []);
      setSummary(sum || {});
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load temperature alerts');
    } finally {
      setLoaded(true);
    }
  }, []);

  // Load now, then refresh every 30 seconds so a new alert appears without pressing Refresh.
  useEffect(() => {
    if (!allowed) return;
    void load(filter);
    const timer = window.setInterval(() => void load(filter), 30000);
    return () => window.clearInterval(timer);
  }, [allowed, filter, load]);

  useEffect(() => {
    if (!allowed) return;
    api('/api/monitoring/excursions/causes').then((c: Cause[]) => setCauses(Array.isArray(c) ? c : [])).catch(() => setCauses([]));
  }, [allowed]);

  async function toggle(r: Excursion) {
    if (openId === r.id) { setOpenId(null); setHistory([]); return; }
    setOpenId(r.id); setHistory([]); setError('');
    try { setHistory(await api(`/api/monitoring/excursions/${r.id}/history`)); } catch { setHistory([]); }
  }

  async function acknowledge(e: FormEvent<HTMLFormElement>, r: Excursion) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get('note') || '');
    setBusy(true); setError(''); setMsg('');
    try {
      await api(`/api/monitoring/excursions/${r.id}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) });
      setMsg(`Alert #${r.id} acknowledged. You are now its owner; record the cause and action to resolve it.`);
      await load(filter);
      setHistory(await api(`/api/monitoring/excursions/${r.id}/history`));
    } catch (x) { setError(x instanceof Error ? x.message : 'Could not acknowledge the alert'); } finally { setBusy(false); }
  }

  async function resolve(e: FormEvent<HTMLFormElement>, r: Excursion) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { causeCode: String(f.get('causeCode') || ''), causeNotes: String(f.get('causeNotes') || ''), correctiveAction: String(f.get('correctiveAction') || '') };
    setBusy(true); setError(''); setMsg('');
    try {
      await api(`/api/monitoring/excursions/${r.id}/resolve`, { method: 'POST', body: JSON.stringify(body) });
      setMsg(`Alert #${r.id} resolved.`);
      setOpenId(null); setHistory([]);
      await load(filter);
    } catch (x) { setError(x instanceof Error ? x.message : 'Could not resolve the alert'); } finally { setBusy(false); }
  }

  if (!allowed) return <div className="p-10">Operational access required.</div>;

  const tiles: [string, number, typeof Thermometer, string][] = [
    ['Open', summary.open || 0, AlertTriangle, 'bg-red-50 text-red-700'],
    ['Acknowledged', summary.acknowledged || 0, Clock3, 'bg-amber-50 text-amber-700'],
    ['Escalated to manager', summary.escalated || 0, Thermometer, 'bg-orange-50 text-orange-700'],
    ['Resolved today', summary.resolvedToday || 0, ShieldCheck, 'bg-emerald-50 text-emerald-700'],
  ];
  const tabs: [Filter, string][] = [['ACTIVE', 'Active'], ['RESOLVED', 'Resolved'], ['ALL', 'All']];

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Thermometer />Temperature Alerts</h1>
        <p className="text-slate-600">
          An alert is raised when the temperature stays outside the allowed range for {summary.sustainedMinutes ?? 10} minutes.
          An alert nobody acknowledges within {summary.escalationMinutes ?? 30} minutes is escalated to the manager.
        </p>
      </div>
      <button onClick={() => void load(filter)} className="inline-flex items-center gap-2 rounded-xl border border-sky-500 px-4 py-2 font-semibold text-sky-700">
        <RefreshCw className="h-4 w-4" />Refresh
      </button>
    </div>

    {msg && <div className="my-4 rounded-xl bg-blue-50 p-3 text-blue-900">{msg}</div>}
    {error && <div className="my-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</div>}

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map(([text, n, Icon, colour]) => (
        <div key={text} className={`rounded-xl p-4 ${colour}`}>
          <div className="flex items-center gap-3"><Icon className="h-7 w-7" /><div><div className="text-2xl font-black">{n}</div><div className="font-bold">{text}</div></div></div>
        </div>
      ))}
    </div>

    <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{filter === 'ACTIVE' ? 'Alerts that need action' : filter === 'RESOLVED' ? 'Resolved alerts' : 'All alerts'} ({rows.length})</h2>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {tabs.map(([key, text]) => (
            <button key={key} onClick={() => { setFilter(key); setOpenId(null); setHistory([]); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>{text}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600">
          {['Alert', 'Trip', 'Vehicle', 'Partner', 'Allowed', 'Peak', 'Out of range', 'Raised', 'Status', 'Owner', ''].map((h, i) => <th key={i} className="whitespace-nowrap px-2.5 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-slate-400">
            {!loaded ? 'Loading…' : filter === 'ACTIVE' ? 'No temperature alerts need action. A short spike that returns to range raises no alert.' : 'No alerts to show.'}
          </td></tr>}
          {rows.map(r => {
            const expanded = openId === r.id;
            return <Fragment key={r.id}>
              <tr className={`border-t border-slate-200 align-top ${expanded ? 'bg-sky-50/60' : ''}`}>
                <td className={cell}>
                  <div className="whitespace-nowrap font-semibold">#{r.id} {r.alertType === 'HIGH_TEMPERATURE' ? 'Too warm' : 'Too cold'}</div>
                  <div className="text-xs text-slate-500">{r.severity === 'CRITICAL' ? 'Critical' : 'Warning'}{r.tripLoadId ? ` · load ${r.tripLoadId}` : ''}</div>
                </td>
                <td className={cell}><div className="whitespace-nowrap font-semibold">{r.tripNumber || '-'}</div><div className="text-xs text-slate-500">{r.sourceCity || '-'} → {r.destinationCity || '-'}</div></td>
                <td className={`${cell} whitespace-nowrap`}>{r.vehicleNumber || '-'}</td>
                <td className={`${cell} min-w-[130px]`}>{r.partnerName || '-'}</td>
                <td className={`${cell} whitespace-nowrap`}>{range(r)}</td>
                <td className={`${cell} whitespace-nowrap font-semibold`}>{degrees(r.peakValue)}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  <div>{duration(r.minutesOutOfRange)}</div>
                  <div className={`text-xs font-semibold ${r.stillOutOfRange ? 'text-red-700' : 'text-emerald-700'}`}>{r.status === 'RESOLVED' ? '' : r.stillOutOfRange ? 'Still out of range' : 'Back in range'}</div>
                </td>
                <td className={cell}>{when(r.raisedAt)}</td>
                <td className={cell}>
                  <StatusBadge r={r} />
                  {r.escalated && r.status === 'OPEN' && <div className="mt-1 text-xs font-semibold text-orange-700">Escalated to {r.escalatedToName || 'manager'}</div>}
                </td>
                <td className={cell}>{r.ownerName || '-'}</td>
                <td className={`${cell} text-right`}>
                  <button onClick={() => void toggle(r)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-sky-500 px-3 py-1.5 text-xs font-bold text-sky-700">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {r.canAcknowledge ? 'Acknowledge' : r.canResolve ? 'Resolve' : 'View'}
                  </button>
                </td>
              </tr>

              {expanded && <tr className="border-t border-slate-200 bg-sky-50/40"><td colSpan={11} className="p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-4">
                    <h3 className="font-bold">What happened</h3>
                    <p className="mt-1 text-sm text-slate-700">{r.message || '-'}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-slate-500">Out of range since</dt><dd>{when(r.excursionStartedAt)}</dd>
                      <dt className="text-slate-500">Back in range</dt><dd>{r.recoveredAt ? when(r.recoveredAt) : 'Not yet'}</dd>
                      <dt className="text-slate-500">Last reading outside</dt><dd>{degrees(r.lastValue)}</dd>
                      <dt className="text-slate-500">Acknowledged</dt><dd>{r.acknowledgedAt ? `${when(r.acknowledgedAt)} by ${r.ownerName || '-'}` : 'Not yet'}</dd>
                      {r.status === 'OPEN' && <><dt className="text-slate-500">Escalation</dt><dd>{r.escalated ? `Escalated ${when(r.escalatedAt)} to ${r.escalatedToName || 'manager'}` : `Escalates at ${when(r.escalationDueAt)} if not acknowledged`}</dd></>}
                      {r.status === 'RESOLVED' && <>
                        <dt className="text-slate-500">Cause</dt><dd>{r.causeLabel || '-'}{r.causeNotes ? `: ${r.causeNotes}` : ''}</dd>
                        <dt className="text-slate-500">Corrective action</dt><dd>{r.correctiveAction || '-'}</dd>
                        <dt className="text-slate-500">Resolved</dt><dd>{when(r.resolvedAt)} by {r.resolvedByName || '-'}</dd>
                      </>}
                    </dl>
                    <h3 className="mt-4 font-bold">History</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                      {history.length === 0 && <li className="text-slate-400">No history yet.</li>}
                      {history.map(h => <li key={h.id} className="rounded-lg border border-slate-200 p-2">
                        <b>{ACTION_TEXT[h.action] || h.action}</b> <span className="text-slate-500">· {when(h.createdAt)} · {h.actionBy || 'System'}</span>
                        {h.notes && <div className="text-slate-600">{h.notes}</div>}
                      </li>)}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    {r.canAcknowledge && <form onSubmit={e => void acknowledge(e, r)}>
                      <h3 className="font-bold">Acknowledge this alert</h3>
                      <p className="mt-1 text-sm text-slate-600">Acknowledging makes you the owner and stops the escalation to the manager.</p>
                      <label className={`${label} mt-3`}>Note (optional)</label>
                      <input name="note" maxLength={300} placeholder="For example: calling the driver" className={input} />
                      <button disabled={busy} className="mt-4 rounded-xl bg-sky-700 px-5 py-2.5 font-semibold text-white disabled:bg-slate-300">{busy ? 'Saving…' : 'Acknowledge'}</button>
                    </form>}

                    {r.canResolve && <form onSubmit={e => void resolve(e, r)}>
                      <h3 className="font-bold">Record cause and action, then resolve</h3>
                      <p className="mt-1 text-sm text-slate-600">An alert cannot be closed without a cause and the corrective action taken.</p>
                      <label className={`${label} mt-3`}>Cause<span className="text-red-600"> *</span></label>
                      <select name="causeCode" required defaultValue="" className={input}>
                        <option value="">Select the cause</option>
                        {causes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <label className={`${label} mt-3`}>Cause note (needed for Other)</label>
                      <input name="causeNotes" maxLength={500} className={input} />
                      <label className={`${label} mt-3`}>Corrective action taken<span className="text-red-600"> *</span></label>
                      <textarea name="correctiveAction" required minLength={5} maxLength={1000} rows={3} placeholder="For example: door closed, set-point lowered to 1 °C for 2 hours" className={input} />
                      {r.stillOutOfRange && <p className="mt-2 text-sm font-semibold text-red-700">The temperature is still outside the range. If it stays out, a new alert is raised after you resolve this one.</p>}
                      <button disabled={busy} className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white disabled:bg-slate-300">{busy ? 'Saving…' : 'Resolve alert'}</button>
                    </form>}

                    {!r.canAcknowledge && !r.canResolve && r.status === 'ACKNOWLEDGED' &&
                      <p className="text-sm text-slate-600">{r.ownerName || 'Another user'} owns this alert. Only the owner, a Manager or an Admin can resolve it.</p>}
                    {r.status === 'RESOLVED' && <p className="text-sm text-slate-600">This alert is resolved. Its cause, action and history are shown on the left.</p>}
                  </div>
                </div>
              </td></tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
      </div>
    </section>
  </>;
}
