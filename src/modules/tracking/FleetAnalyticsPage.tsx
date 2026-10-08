/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-007 -- Fleet Analytics: for one month, per truck, the use (hours on trips), kilometres, idle hours,
// waiting and detention at stops, truck fuel and kilometres per litre, reefer fuel and hours, trips and on-time
// share; and the fleet over six months. Staff only.
// Backend: GET /api/tracking/analytics(.csv)?month=YYYY-MM (FleetAnalyticsController).
import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, Section, btnLight, errorText, input, td, th } from '@/shared/components/FormKit';
import { minutesText, num } from './telematics';

const thisMonth = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);

function Bars({ rows, field, unit, digits = 0 }: { rows: any[]; field: string; unit: string; digits?: number }) {
  const max = Math.max(1, ...rows.map(r => Number(r[field]) || 0));
  return <div className="flex h-28 items-end gap-2">{rows.map(r => <div key={r.month} className="flex flex-1 flex-col items-center gap-1">
    <div className="text-[10px] text-slate-600">{r[field] == null ? '-' : num(r[field], digits)}</div>
    <div className="w-full rounded-t bg-sky-600" style={{ height: `${Math.max(2, ((Number(r[field]) || 0) / max) * 80)}px` }} title={`${r.month}: ${num(r[field], digits)} ${unit}`} />
    <div className="text-[10px] text-slate-500">{r.month.slice(5)}/{r.month.slice(2, 4)}</div>
  </div>)}</div>;
}

export function FleetAnalyticsPage() {
  const [month, setMonth] = useState(thisMonth()), [d, setD] = useState<any>(null), [err, setErr] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true); setErr('');
    api(`/api/tracking/analytics?month=${month}`).then(setD).catch(e => { setD(null); setErr(errorText(e, 'Could not load the analytics')); }).finally(() => setLoading(false));
  }, [month]);
  const t = d?.total || {};
  const k = (name: string, value: string) => <div className="rounded-xl bg-white p-3 shadow-sm"><div className="text-sm text-slate-500">{name}</div><div className="text-xl font-bold">{value}</div></div>;

  return <>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><BarChart3 className="h-8 w-8 text-sky-700" />Fleet Analytics</h1>
        <p className="text-slate-600">Use, idle and waiting time, fuel, reefer hours and on-time share of each truck, by month.</p>
      </div>
      <div className="flex items-end gap-2">
        <label className="text-sm">Month<input type="month" className={`${input} block`} value={month} max={thisMonth()} onChange={e => setMonth(e.target.value || thisMonth())} /></label>
        <button className={btnLight} onClick={() => apiDownload(`/api/tracking/analytics.csv?month=${month}`, `fleet-analytics-${month}.csv`).catch(e => setErr(errorText(e, 'Not downloaded')))}>CSV</button>
      </div>
    </div>
    <Banner error={err} />
    {loading && <p className="mt-3 text-slate-500">Loading...</p>}
    {d && <>
      {d.partMonth && <p className="mt-2 text-sm text-slate-500">This month so far ({num(d.hoursInMonth)} hours).</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {k('Trucks used', num(t.trucks))}{k('Use', t.usePct != null ? `${num(t.usePct, 1)} %` : '-')}{k('Kilometres', num(t.km))}
        {k('Km per litre', t.kmPerLitre != null ? num(t.kmPerLitre, 2) : '-')}{k('Trips completed', num(t.trips))}{k('On time', t.onTimePct != null ? `${num(t.onTimePct)} %` : '-')}
        {k('Idle hours', num(t.idleHours, 1))}{k('Waiting at stops', minutesText(t.waitingMinutes))}{k('Detention', minutesText(t.detentionMinutes))}
        {k('Truck fuel', `${num(t.truckLitres)} L`)}{k('Reefer fuel', `${num(t.reeferLitres)} L`)}{k('Reefer hours', num(t.reeferHours, 1))}
      </div>
      {!d.fuelData && <p className="mt-2 text-sm text-amber-800">Fuel entries are not in the database yet, so litres and km per litre are empty.</p>}
      <Section title="Per truck">
        <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>Hours on trips</th><th className={th}>Use</th><th className={th}>Km</th><th className={th}>Idle h</th><th className={th}>Waiting</th><th className={th}>Detention</th><th className={th}>Truck L</th><th className={th}>Km/L</th><th className={th}>Reefer L</th><th className={th}>Reefer h</th><th className={th}>Trips</th><th className={th}>On time</th></tr></thead>
          <tbody>
            {(d.trucks || []).length === 0 && <tr><td colSpan={13} className="p-6 text-center text-slate-400">No truck worked in this month.</td></tr>}
            {(d.trucks || []).map((r: any) => <tr key={r.vehicleId} className="border-t border-slate-200">
              <td className={td}><b>{r.vehicleNumber}</b><div className="text-xs text-slate-500">{r.ownership}</div></td>
              <td className={td}>{num(r.tripHours, 1)}</td>
              <td className={td}><div className="flex items-center gap-2"><div className="h-2 w-16 rounded bg-slate-100"><div className="h-2 rounded bg-sky-600" style={{ width: `${Math.min(100, Number(r.usePct) || 0)}%` }} /></div>{num(r.usePct, 1)} %</div></td>
              <td className={td}>{num(r.km)}</td>
              <td className={td}>{num(r.idleHours, 1)}</td>
              <td className={td}>{minutesText(r.waitingMinutes)}</td>
              <td className={td}>{Number(r.detentionMinutes) > 0 ? <span className="text-red-700">{minutesText(r.detentionMinutes)}</span> : '-'}</td>
              <td className={td}>{num(r.truckLitres)}</td>
              <td className={td}>{r.kmPerLitre != null ? num(r.kmPerLitre, 2) : '-'}</td>
              <td className={td}>{num(r.reeferLitres)}</td>
              <td className={td}>{r.reeferHours != null ? num(r.reeferHours, 1) : '-'}</td>
              <td className={td}>{num(r.trips)}</td>
              <td className={td}>{r.onTimePct != null ? `${num(r.onTimePct)} %` : '-'}</td>
            </tr>)}
          </tbody>
        </table></div>
        <p className="mt-2 text-xs text-slate-500">On time: arrived by the promised time plus {d.onTimeMarginMinutes} minutes. Idle: on a trip below 5 km/h. Kilometres leave out FASTAG toll positions and jumps over 2 hours.</p>
      </Section>
      <Section title="Last six months">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div><div className="mb-1 text-sm font-semibold">Kilometres</div><Bars rows={d.trend || []} field="km" unit="km" /></div>
          <div><div className="mb-1 text-sm font-semibold">Use %</div><Bars rows={d.trend || []} field="usePct" unit="%" digits={1} /></div>
          <div><div className="mb-1 text-sm font-semibold">On time %</div><Bars rows={d.trend || []} field="onTimePct" unit="%" /></div>
          <div><div className="mb-1 text-sm font-semibold">Km per litre</div><Bars rows={d.trend || []} field="kmPerLitre" unit="km/L" digits={2} /></div>
        </div>
      </Section>
    </>}
  </>;
}
