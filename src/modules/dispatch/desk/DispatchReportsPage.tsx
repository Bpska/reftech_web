/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-008 -- Dispatch reports. Staff only.
//
// For a period (default the last 30 days) and optionally one partner or truck: on time in full (OTIF) by delivery and
// by partner, fill rate of the trucks (tons, m³, pallets), the plan against what happened (start, arrival, km, cost),
// and the loads waiting for a truck now. Each report downloads as CSV or Excel.
// Backend: GET /api/dispatch/reports?from=&to=&partnerId=&vehicleId=,
// GET /api/dispatch/reports/{otif|fill|plan|waiting}/export?format=csv|xlsx, GET /api/operations/partners, /api/operations/vehicles.
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, NotReady, btnLight, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { indiaDay, plain, when } from '../dispatch';
import { SCRIPT64, addDays, asList, inr, minutes, notReady, pct } from './desk';

type Report = 'otif' | 'fill' | 'plan' | 'waiting';
const TABS: [Report, string][] = [['otif', 'On time in full'], ['fill', 'Fill rate'], ['plan', 'Plan against actual'], ['waiting', 'Loads waiting']];
const yes = (v: unknown) => (v === true ? <span className="font-semibold text-emerald-700">Yes</span> : v === false ? <span className="font-semibold text-red-700">No</span> : <span className="text-slate-400">-</span>);

export function DispatchReportsPage() {
  const today = indiaDay();
  const [f, setF] = useState({ from: addDays(today, -29), to: today, partnerId: '', vehicleId: '' });
  const [partners, setPartners] = useState<any[]>([]), [vehicles, setVehicles] = useState<any[]>([]);
  const [data, setData] = useState<any>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState<Report>('otif');

  useEffect(() => {
    api('/api/operations/partners').then(x => setPartners(asList(x))).catch(() => setPartners([]));
    api('/api/operations/vehicles').then(x => setVehicles(asList(x))).catch(() => setVehicles([]));
  }, []);

  const query = () => {
    const q = new URLSearchParams({ from: f.from, to: f.to });
    if (f.partnerId) q.set('partnerId', f.partnerId);
    if (f.vehicleId) q.set('vehicleId', f.vehicleId);
    return q.toString();
  };
  const load = () => {
    setBusy(true); setErr('');
    return api(`/api/dispatch/reports?${query()}`).then(setData).catch(e => setErr(errorText(e, 'The reports could not be read'))).finally(() => setBusy(false));
  };
  useEffect(() => { void load(); }, [f]);

  async function download(report: Report, format: 'csv' | 'xlsx') {
    setErr('');
    try { await apiDownload(`/api/dispatch/reports/${report}/export?format=${format}&${query()}`, `dispatch-${report}-${f.from}-to-${f.to}.${format}`); }
    catch (e) { setErr(errorText(e, 'The file could not be downloaded')); }
  }

  const head = <div>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><BarChart3 />Dispatch Reports</h1>
    <p className="text-slate-600">On time in full, truck fill, plan against actual and loads waiting. Times are India time.</p>
  </div>;
  if (notReady(data) || notReady(err)) return <>{head}<NotReady script={SCRIPT64} /></>;

  const o = data?.otif || {}, fl = data?.fill || {}, pl = data?.plan || {}, w = data?.waiting || {};
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return <>
    {head}
    <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
      <div><label className={label}>From</label><input type="date" className={input} value={f.from} onChange={e => e.target.value && set('from')(e)} /></div>
      <div><label className={label}>To</label><input type="date" className={input} value={f.to} onChange={e => e.target.value && set('to')(e)} /></div>
      <div><label className={label}>Partner</label><select className={input} value={f.partnerId} onChange={set('partnerId')}><option value="">All partners</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><label className={label}>Truck</label><select className={input} value={f.vehicleId} onChange={set('vehicleId')}><option value="">All trucks</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select></div>
      <div className="flex items-end"><button className={btnLight} onClick={() => void load()} disabled={busy}><RefreshCw className="mr-1 inline h-4 w-4" />Refresh</button></div>
    </div>
    <Banner error={err} />

    {data && <>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi title="OTIF" value={pct(o.otifPercent)} sub={`${o.deliveries ?? 0} deliveries`} tone={tone(o.otifPercent)} />
        <Kpi title="On time" value={pct(o.onTimePercent)} sub={`${o.withPromisedTime ?? 0} with a promised time, ${data.graceMinutes} min grace`} tone={tone(o.onTimePercent)} />
        <Kpi title="In full" value={pct(o.inFullPercent)} tone={tone(o.inFullPercent)} />
        <Kpi title="Fill (tons)" value={pct(fl.weightedTonsPercent)} sub={`average ${pct(fl.tonsPercent)}, ${fl.under60 ?? 0} trips under 60 %`} tone={tone(fl.weightedTonsPercent)} />
        <Kpi title="Fill (m³ / pallets)" value={`${pct(fl.m3Percent)} / ${pct(fl.palletPercent)}`} sub={`${fl.trips ?? 0} trips`} />
        <Kpi title="Start delay" value={minutes(pl.averageStartDelayMinutes)} sub={`${pl.startedLate ?? 0} started over 30 min late; arrival ${minutes(pl.averageArrivalDelayMinutes)}`} />
        <Kpi title="Km plan / actual" value={`${plain(pl.plannedKm)} / ${plain(pl.actualKm)}`} sub="trips with both" />
        <Kpi title="Cost plan / actual" value={`${inr(pl.plannedCost)} / ${inr(pl.actualCost)}`} sub="trips with both" />
        <Kpi title="Plans saved" value={`${pl.withSavedPlan ?? 0} of ${pl.trips ?? 0}`} />
        <Kpi title="Loads waiting" value={String(w.count ?? 0)} sub="past pickup time, no truck" tone={Number(w.count) > 0 ? 'bad' : undefined} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap overflow-hidden rounded-xl border border-slate-300">
          {TABS.map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>{t}</button>)}
        </div>
        <div className="flex gap-2">
          <button className={btnLight} onClick={() => void download(tab, 'csv')}><Download className="mr-1 inline h-4 w-4" />CSV</button>
          <button className={btnLight} onClick={() => void download(tab, 'xlsx')}><Download className="mr-1 inline h-4 w-4" />Excel</button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        {tab === 'otif' && <>
          <h2 className="text-lg font-bold">By partner</h2>
          <Table head={['Partner', 'Deliveries', 'OTIF', 'On time', 'In full']} rows={(data.otifByPartner || []).map((r: any) => [r.partnerName, r.deliveries, pct(r.otifPercent), pct(r.onTimePercent), pct(r.inFullPercent)])} />
          <h2 className="mt-5 text-lg font-bold">Deliveries</h2>
          <Table head={['Trip', 'Truck', 'Load', 'Partner', 'Delivered to', 'Due', 'Delivered', 'On time', 'In full', 'Why not']}
            rows={(data.otifRows || []).map((r: any) => [trip(r), r.vehicleNumber || '-', r.loadNumber || '-', r.partnerName || '-', r.deliveredTo || '-',
              <>{when(r.due)}{r.dueFrom && <div className="text-xs text-slate-500">{r.dueFrom}</div>}</>, when(r.deliveredAt), yes(r.onTime), yes(r.inFull), r.reason || '-'])} />
        </>}
        {tab === 'fill' && <Table head={['Day', 'Trip', 'Type', 'Truck', 'Partner', 'Route', 'Loads', 'Tons', 'Tons %', 'm³ %', 'Pallets', 'Pallets %']}
          rows={(data.fillRows || []).map((r: any) => [r.day, trip(r), r.tripType === 'PART_LOAD' ? 'Part load' : 'Full', r.vehicleNumber || '-', r.partnerName || '-', r.route,
            r.loads, `${plain(r.tons)} of ${plain(r.capacityTons)}`, <Fill v={r.tonsPercent} />, pct(r.m3Percent), `${r.pallets ?? '-'} of ${r.palletPositions ?? '-'}`, pct(r.palletPercent)])} />}
        {tab === 'plan' && <Table head={['Trip', 'Truck', 'Route', 'Stops', 'Planned start', 'Started', 'Start delay', 'Arrival delay', 'Km plan', 'Km actual', 'Km diff', 'Cost plan', 'Cost actual', 'Cost diff']}
          rows={(data.planRows || []).map((r: any) => [<>{trip(r)}{!r.planSaved && <div className="text-xs text-amber-700">no saved plan</div>}</>, r.vehicleNumber || '-', r.route, r.stops,
            when(r.plannedStart), when(r.actualStart), minutes(r.startDelayMinutes), minutes(r.arrivalDelayMinutes), plain(r.plannedKm), plain(r.actualKm),
            r.kmDifference == null ? '-' : `${plain(r.kmDifference)} (${pct(r.kmPercent)})`, inr(r.plannedCost), inr(r.actualCost), inr(r.costDifference)])} />}
        {tab === 'waiting' && <Table head={['Load', 'Partner', 'From', 'To', 'Tons', 'Pickup from', 'Waiting']}
          rows={(w.rows || []).map((r: any) => [<Link to={`/dispatch/loads/${r.id}`} className="font-semibold text-sky-700 hover:underline">{r.load_number}</Link>, r.partner_name || '-',
            r.pickup_city, r.delivery_city, plain(r.weight_tons), when(r.pickup_from), <span className="font-semibold text-red-700">{plain(r.hours_waiting)} h</span>])} />}
      </div>
    </>}
  </>;
}

const trip = (r: any) => <Link to={`/dispatch/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">{r.tripNumber}</Link>;
const tone = (v: unknown) => (v === null || v === undefined ? undefined : Number(v) >= 90 ? 'good' : Number(v) >= 70 ? undefined : 'bad');

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return <div className={`rounded-2xl p-3 shadow-sm ${tone === 'good' ? 'bg-emerald-50' : tone === 'bad' ? 'bg-red-50' : 'bg-white'}`}>
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    <div className={`mt-1 text-2xl font-bold ${tone === 'good' ? 'text-emerald-800' : tone === 'bad' ? 'text-red-800' : 'text-slate-900'}`}>{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
  </div>;
}

function Fill({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <>-</>;
  const n = Math.min(Number(v), 100);
  return <div className="flex items-center gap-2"><div className="h-2 w-16 rounded bg-slate-200"><div className={`h-2 rounded ${n < 60 ? 'bg-red-500' : n < 85 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${n}%` }} /></div>{pct(v)}</div>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className="mt-2 text-sm text-slate-500">Nothing in this period.</p>;
  return <div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-slate-50 text-slate-600"><tr>{head.map(h => <th key={h} className={`${th} whitespace-nowrap`}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className={td}>{c ?? '-'}</td>)}</tr>)}</tbody>
  </table>{rows.length >= 500 && <p className="mt-2 text-xs text-slate-500">The first 500 rows are shown. Download the report for all of them.</p>}</div>;
}
