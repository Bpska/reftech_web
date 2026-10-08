/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-003 -- the Route tab of the Dispatch Plan: every stop in order with its promised window, the worked-out
// arrival, waiting and lateness, what is on board after it, and the live expected time on the road.
// A stop's window and its minutes at the stop can be changed (a reason when the trip is approved); "Save the plan"
// keeps the arrivals, km, time and cost so the reports can compare them with what happened.
// Backend: GET /api/dispatch/trips/{id}/route, PUT /api/dispatch/trips/{id}/route/stops/{stopId}
// { windowFrom, windowTo, serviceMinutes, reason }, POST /api/dispatch/trips/{id}/route/save.
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Save } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, input, label, td, th } from '@/shared/components/FormKit';
import { Problems, TabProps, approved, iso, localInput, minutes, plain, rupee, send, useAction, when, words } from './planning';
import { fmtDistance, fmtMoney, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const SOURCE: Record<string, string> = { STOP: 'set here', LOAD: 'from the load', TRIP: 'trip arrival' };

export function RouteTab({ tripId, plan, reload }: TabProps) {
  const r = plan.route || {};
  const stops: any[] = r.stops || [];
  const t = r.totals || {};
  const { busy, msg, err, run } = useAction(reload);
  const [edit, setEdit] = useState<any>(null);
  const running = stops.some(s => s.expectedAt);
  // a stop names its trip load; the load plan knows the load request behind it
  const requestOf: Record<string, any> = {};
  for (const i of plan.loadPlan?.items || []) if (i.tripLoadId != null) requestOf[i.tripLoadId] = i.loadRequestId;

  function startEdit(s: any) {
    setEdit({ id: s.id, place: s.place, windowFrom: s.windowSource === 'STOP' ? localInput(s.windowFrom) : '', windowTo: s.windowSource === 'STOP' ? localInput(s.windowTo) : '',
      serviceMinutes: s.serviceMinutes ?? '', reason: '', loadFrom: s.windowSource !== 'STOP' ? s.windowFrom : null, loadTo: s.windowSource !== 'STOP' ? s.windowTo : null });
  }

  async function saveStop(e: FormEvent) {
    e.preventDefault();
    const body = { windowFrom: iso(edit.windowFrom) || null, windowTo: iso(edit.windowTo) || null,
      serviceMinutes: edit.serviceMinutes === '' ? null : Number(edit.serviceMinutes), reason: edit.reason || null };
    const ok = await run(() => api(`/api/dispatch/trips/${tripId}/route/stops/${edit.id}`, send('PUT', body)));
    if (ok) setEdit(null);
  }

  const set = (k: string) => (e: any) => setEdit((x: any) => ({ ...x, [k]: e.target.value }));

  return <Section title="Route and arrival times" right={r.canEdit && <button className={btn} disabled={busy} onClick={() => void run(() => api(`/api/dispatch/trips/${tripId}/route/save`, send('POST', {})))}>
    <Save className="mr-1 inline h-4 w-4" />Save the plan</button>}>
    <Banner msg={msg} error={err} />
    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
      <Box k="Distance" v={`${fmtDistance(t.distanceKm)}${t.distanceComplete === false ? ' (some towns unknown)' : ''}`} />
      <Box k="Time" v={minutes(t.durationMinutes)} />
      <Box k="Cost (about)" v={rupee(t.cost)} />
      <Box k="Late stops" v={`${t.lateStops ?? 0}${t.lateMinutes ? ` (${minutes(t.lateMinutes)})` : ''}`} bad={t.lateStops > 0} />
      <Box k="Waiting" v={minutes(t.waitMinutes)} />
    </div>
    <p className="mt-2 text-xs text-slate-500">
      Worked out at {fmtDistance(r.settings?.averageSpeedKmph)}/h, {plain(r.settings?.stopMinutes)} min per stop
      {r.truck?.costPerKm != null ? `, ${fmtMoney(r.truck.costPerKm)} per km` : ''}.
      {r.saved ? ` Plan saved ${when(r.saved.savedAt)} by ${r.saved.savedBy || '-'}: ${fmtDistance(r.saved.distanceKm)}, ${minutes(r.saved.durationMinutes)}, ${rupee(r.saved.cost)}.` : ' The plan is not saved yet.'}
    </p>

    {edit && <form onSubmit={saveStop} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 md:grid-cols-4">
      <div className="md:col-span-4 text-sm font-bold text-slate-800">Stop {edit.place}
        {(edit.loadFrom || edit.loadTo) && <span className="ml-2 font-normal text-slate-600">(now {when(edit.loadFrom)} to {when(edit.loadTo)}; leave empty to keep it)</span>}</div>
      <div><span className={label}>Window from</span><input className={input} type="datetime-local" value={edit.windowFrom} onChange={set('windowFrom')} /></div>
      <div><span className={label}>Window to</span><input className={input} type="datetime-local" value={edit.windowTo} onChange={set('windowTo')} /></div>
      <div><span className={label}>Minutes at the stop</span><input className={input} type="number" min={0} max={1440} value={edit.serviceMinutes} onChange={set('serviceMinutes')} placeholder={`${plain(r.settings?.stopMinutes)} (default)`} /></div>
      <div><span className={label}>Reason{approved(plan) ? ' *' : ''}</span><input className={input} required={approved(plan)} minLength={approved(plan) ? 5 : undefined} value={edit.reason} onChange={set('reason')} placeholder="Customer asked for a later slot" /></div>
      <div className="flex gap-2 md:col-span-4"><button className={btn} disabled={busy}>Save stop</button><button type="button" className={btnLight} onClick={() => setEdit(null)}>Cancel</button></div>
    </form>}

    <div className="mt-3 overflow-x-auto">
      {!stops.length ? <p className="text-sm text-slate-500">The trip has no stops yet.</p> : <table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50">
          <th className={th}>#</th><th className={th}>Stop</th><th className={th}>Goods</th><th className={th}>Window</th><th className={th}>Arrival</th>
          <th className={th}>Wait</th><th className={th}>Late</th><th className={th}>Leaves</th><th className={th}>Km</th><th className={th}>On board after</th>
          {running && <th className={th}>Expected now</th>}{r.canEdit && <th className={th} />}
        </tr></thead>
        <tbody>{stops.map(s => <tr key={s.id} className={`border-t ${s.done ? 'text-slate-400' : ''}`}>
          <td className={td}>{s.order}</td>
          <td className={td}><div className="font-semibold">{s.place || '-'}</div><div className="text-xs text-slate-500">{words(s.type)}{s.done ? ` · done ${when(s.actualAt)}` : ''}</div></td>
          <td className={td}>
            <div>{s.what}</div>
            <div className="text-xs text-slate-500">{s.partnerName || ''}{requestOf[s.tripLoadId] && <> · <Link className="text-sky-700 hover:underline" to={`/dispatch/loads/${requestOf[s.tripLoadId]}`}>{s.loadNumber}</Link></>}</div>
          </td>
          <td className={`${td} whitespace-nowrap`}>
            {s.windowFrom || s.windowTo ? <>{when(s.windowFrom)}<br />to {when(s.windowTo)}</> : <span className="text-slate-400">none</span>}
            {s.windowSource && <div className="text-xs text-slate-500">{SOURCE[s.windowSource] || s.windowSource}</div>}
          </td>
          <td className={`${td} whitespace-nowrap`}>{when(s.arrivalAt)}{s.plannedArrivalAt && s.plannedArrivalAt !== s.arrivalAt && <div className="text-xs text-slate-500">saved {when(s.plannedArrivalAt)}</div>}</td>
          <td className={td}>{s.waitMinutes ? minutes(s.waitMinutes) : '-'}</td>
          <td className={`${td} ${s.lateMinutes > 0 ? 'font-bold text-red-700' : ''}`}>{s.lateMinutes > 0 ? minutes(s.lateMinutes) : '-'}</td>
          <td className={`${td} whitespace-nowrap`}>{when(s.departureAt)}<div className="text-xs text-slate-500">{s.serviceMinutes != null ? `${s.serviceMinutes} min at stop` : ''}</div></td>
          <td className={td}>{s.legKm == null ? (s.order === 1 ? '-' : '?') : plain(s.legKm)}</td>
          <td className={td}>
            <div>{fmtWeight(s.onBoardTons)}{s.onBoardM3 != null ? ` · ${plain(s.onBoardM3)} m³` : ''} · {s.onBoardPallets} pal</div>
            {s.legProblems?.map((p: string, i: number) => <div key={i} className="text-xs font-semibold text-red-700">{p}</div>)}
          </td>
          {running && <td className={`${td} whitespace-nowrap`}>{s.expectedAt ? when(s.expectedAt) : '-'}{s.lateNow > 0 && <div className="text-xs font-bold text-red-700">{minutes(s.lateNow)} late</div>}</td>}
          {r.canEdit && <td className={td}><button className={btnLight} title="Change the window" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></button></td>}
        </tr>)}</tbody>
      </table>}
    </div>

    <Problems items={r.problems} title="Problems" />
    <Problems items={(r.offRoute || []).map((o: any) => o.text)} title={`Off the route (more than ${fmtDistance(r.settings?.offRouteKm)})`} tone="amber" />
    {t.unknownTowns?.length > 0 && <p className="text-sm text-amber-800">Towns without a map position: {t.unknownTowns.join(', ')}.</p>}
  </Section>;
}

function Box({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return <div className={`rounded-xl p-3 ${bad ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-800'}`}><div className="text-xs text-slate-500">{k}</div><div className="font-bold">{v}</div></div>;
}
