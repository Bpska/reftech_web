/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-007 -- the Suggestions tab of the Dispatch Plan: a better order of the stops (fewer late stops, fewer km)
// against the present one, with "Use this order"; and the open loads that fit a part-load trip, each with its fare,
// extra km, extra cost and gain, and the best set to add. A load is added on the Part-Load Planner of the trip.
// Read only when the tab is opened (the load suggestions take a moment).
// Backend: GET /api/dispatch/trips/{id}/optimise/stops, POST /api/dispatch/trips/{id}/optimise/stops
// { stopIds, suggested: true, reason }, GET /api/dispatch/trips/{id}/optimise/loads.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Sparkles } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, errorText, td, th } from '@/shared/components/FormKit';
import { TabProps, minutes, plain, reasonFor, rupee, send, useAction, when, words } from './planning';
import { fmtDistance } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function SuggestionsTab({ tripId, plan, reload }: TabProps) {
  const [order, setOrder] = useState<any>(null), [loads, setLoads] = useState<any>(null);
  const [orderErr, setOrderErr] = useState(''), [loadsErr, setLoadsErr] = useState(''), [reading, setReading] = useState(false);
  const { busy, msg, err, run } = useAction(reload);

  const readOrder = () => api(`/api/dispatch/trips/${tripId}/optimise/stops`).then(x => { setOrder(x); setOrderErr(''); })
    .catch(e => setOrderErr(errorText(e, 'The best order could not be worked out')));
  const readLoads = () => {
    setReading(true);
    return api(`/api/dispatch/trips/${tripId}/optimise/loads`).then(x => { setLoads(x); setLoadsErr(''); })
      .catch(e => setLoadsErr(errorText(e, 'The loads could not be checked'))).finally(() => setReading(false));
  };
  useEffect(() => { void readOrder(); void readLoads(); }, [tripId]);

  async function applyOrder() {
    const reason = reasonFor(plan, 'changing the order of the stops');
    if (reason === null) return;
    const ok = await run(() => api(`/api/dispatch/trips/${tripId}/optimise/stops`, send('POST', { stopIds: order.stopIds, suggested: true, reason: reason || null })));
    if (ok) void readOrder();
  }

  const cur = order?.current || {}, sug = order?.suggested || {};
  const suggestions: any[] = loads?.suggestions || [];
  const best: any[] = loads?.bestSet || [];
  const inBest = new Set(best.map(b => b.loadId));

  return <>
    <Section title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-sky-700" />Best order of the stops</span>}
      right={<button className={btnLight} onClick={() => void readOrder()}><RefreshCw className="mr-1 inline h-4 w-4" />Again</button>}>
      <Banner msg={msg} error={err || orderErr} />
      {!order ? !orderErr && <p className="text-sm text-slate-500">Working out…</p> : <>
        <p className={`text-sm font-semibold ${order.changed ? 'text-emerald-800' : 'text-slate-700'}`}>{order.message}</p>
        {order.method && <p className="text-xs text-slate-500">{order.method}.</p>}
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead><tr className="bg-slate-50"><th className={th} /><th className={th}>Km</th><th className={th}>Time</th><th className={th}>Cost</th><th className={th}>Late stops</th><th className={th}>Waiting</th></tr></thead>
          <tbody>
            <Totals name="Now" t={cur} />
            {order.suggested && <Totals name="Suggested" t={sug} strong={order.changed} />}
          </tbody>
        </table></div>
        {order.changed && <>
          <p className="mt-2 text-sm text-slate-700">Saves {fmtDistance(order.savingKm)}{order.savingCost != null ? `, about ${rupee(order.savingCost)}` : ''}.</p>
          <ol className="mt-2 space-y-1 text-sm">{(order.stops || []).map((s: any) => <li key={s.id} className="flex flex-wrap gap-2">
            <span className="w-6 text-right font-bold">{s.order}.</span><span className="font-semibold">{s.place}</span>
            <span className="text-slate-500">{words(s.type)} · {s.what}</span>
            <span className="text-slate-500">arrives {when(s.arrivalAt)}</span>{s.lateMinutes > 0 && <span className="font-bold text-red-700">{minutes(s.lateMinutes)} late</span>}
          </li>)}</ol>
          {order.canApply && <button className={`${btn} mt-3`} disabled={busy} onClick={() => void applyOrder()}>Use this order</button>}
          <p className="mt-1 text-xs text-slate-500">After using it, save the plan on the Route tab to keep the new arrival times.</p>
        </>}
      </>}
    </Section>

    <Section title="Loads to add" right={<div className="flex gap-2">
      <Link to={`/part-load/${tripId}`} className={btnLight}>Part-Load Planner</Link>
      <button className={btnLight} disabled={reading} onClick={() => void readLoads()}><RefreshCw className={`mr-1 inline h-4 w-4 ${reading ? 'animate-spin' : ''}`} />Again</button></div>}>
      <Banner error={loadsErr} />
      {!loads ? !loadsErr && <p className="text-sm text-slate-500">Checking the open loads… this can take a moment.</p> : <>
        <p className="text-sm font-semibold text-slate-700">{loads.message}</p>
        {best.length > 0 && <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          <b>Best set:</b> {best.map(b => b.loadNumber).join(', ')} · gain about {rupee(loads.bestSetGain)} · {fmtDistance(loads.bestSetKm)} more
        </div>}
        {suggestions.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50">
            <th className={th}>Load</th><th className={th}>Partner</th><th className={th}>Towns</th><th className={th}>Tons</th><th className={th}>Pallets</th>
            <th className={th}>Fare</th><th className={th}>Extra km</th><th className={th}>Extra cost</th><th className={th}>Gain</th><th className={th}>Fits</th><th className={th} />
          </tr></thead>
          <tbody>{suggestions.map(s => <tr key={s.loadId} className={`border-t ${inBest.has(s.loadId) ? 'bg-emerald-50/60' : ''}`}>
            <td className={`${td} font-semibold`}>{s.loadNumber}{inBest.has(s.loadId) && <div className="text-xs font-bold text-emerald-700">in the best set</div>}</td>
            <td className={td}>{s.partnerName || '-'}</td>
            <td className={td}>{s.pickupCity} to {s.deliveryCity}{s.stops?.length > 0 && <div className="text-xs text-slate-500" title={s.stops.join('\n')}>{s.stops.length} stops on the new route</div>}</td>
            <td className={td}>{plain(s.weightTons)}</td><td className={td}>{s.palletCount ?? '-'}</td>
            <td className={td}>{rupee(s.fare)}</td><td className={td}>{plain(s.extraKm)}</td><td className={td}>{rupee(s.extraCost)}</td>
            <td className={`${td} font-bold ${s.gain == null ? '' : Number(s.gain) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{rupee(s.gain)}</td>
            <td className={td}>{s.ok ? <span className="text-emerald-700">Yes</span> : <span className="text-red-700">No</span>}{s.note && <div className="text-xs text-slate-500">{s.note}</div>}</td>
            <td className={td}><Link to={`/part-load/${tripId}`} className="whitespace-nowrap text-sky-700 hover:underline">Add on the planner</Link></td>
          </tr>)}</tbody>
        </table></div>}
      </>}
    </Section>
  </>;
}

function Totals({ name, t, strong }: { name: string; t: any; strong?: boolean }) {
  return <tr className={`border-t ${strong ? 'font-bold text-emerald-800' : ''}`}>
    <td className={td}>{name}</td><td className={td}>{plain(t.distanceKm)}{t.distanceComplete === false ? ' (some towns unknown)' : ''}</td>
    <td className={td}>{minutes(t.durationMinutes)}</td><td className={td}>{rupee(t.cost)}</td>
    <td className={`${td} ${t.lateStops > 0 ? 'text-red-700' : ''}`}>{t.lateStops ?? 0}</td><td className={td}>{minutes(t.waitMinutes)}</td>
  </tr>;
}
