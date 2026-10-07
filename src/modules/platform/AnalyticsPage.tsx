/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-006 -- Management Analytics (/platform/analytics) for Admin, Manager or the permission ANALYTICS_VIEW,
// and My Service Report (/platform/my-report) for a customer (partner) login: its own trips, on-time rate,
// temperature excursions and bills due.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, FileBarChart } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { btn, btnLight, input, label, td, th } from '@/shared/components/FormKit';
import { day, rupee } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { BarChart, Donut, LineChart } from './charts';

const num = (v: any, digits = 0) => v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits });
const pct = (v: any) => v === null || v === undefined ? '-' : `${num(v, 1)}%`;

function Tile({ title, value, hint }: { title: string; value: ReactNode; hint?: ReactNode }) {
  return <div className="rounded-2xl bg-white p-4 shadow-sm">
    <div className="text-sm font-semibold text-slate-600">{title}</div>
    <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
  </div>;
}

function Table({ caption, columns, rows, empty = 'Nothing in this range.' }: { caption: string; columns: [string, (r: any) => ReactNode][]; rows: any[]; empty?: string }) {
  return <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
    <h2 className="text-lg font-bold">{caption}</h2>
    {!rows?.length ? <p className="mt-2 text-sm text-slate-500">{empty}</p> :
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead><tr className="bg-slate-50">{columns.map(([h]) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{columns.map(([h, f]) => <td key={h} className={td}>{f(r)}</td>)}</tr>)}</tbody>
        </table>
      </div>}
  </section>;
}

function Notes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return <div role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
    <b>Some figures are incomplete:</b>
    <ul className="ml-5 list-disc">{notes.map(n => <li key={n}>{n}</li>)}</ul>
  </div>;
}

function TrendCharts({ trend, money = true }: { trend: any[]; money?: boolean }) {
  const labels = trend.map(t => t.label);
  return <div className="mt-5 grid gap-4 lg:grid-cols-2">
    <LineChart title="Trips per period" labels={labels} series={[{ name: 'Trips', values: trend.map(t => t.trips) }, { name: 'Completed', values: trend.map(t => t.completed) }]} />
    <LineChart title="On-time delivery and temperature excursions (%)" labels={labels} unit="%" max={100}
      series={[{ name: 'On time %', values: trend.map(t => t.onTimePct) }, { name: 'Excursion %', values: trend.map(t => t.excursionPct) }]}
      note="On time: arrived by the expected arrival time (15 minutes grace). Excursion: trips with at least one temperature alert." />
    {money && <BarChart title="Revenue billed and collected (Rs.)" labels={labels}
      series={[{ name: 'Billed', values: trend.map(t => t.billed) }, { name: 'Collected', values: trend.map(t => t.collected) }]} />}
    <BarChart title="Tonnes moved (completed trips)" labels={labels} series={[{ name: 'Tonnes', values: trend.map(t => t.tonnes) }]} />
  </div>;
}

const laneColumns: [string, (r: any) => ReactNode][] = [
  ['Lane', r => r.lane], ['Trips', r => num(r.trips)], ['Completed', r => num(r.completed)],
  ['Average transit hours', r => num(r.avgTransitHours, 1)], ['On time', r => pct(r.onTimePct)],
];

/** REQ-PLT-006 Management Analytics. */
export function ManagementAnalyticsPage() {
  const s = usePlatform();
  const [f, setF] = useState({ from: '', to: '', bucket: '', partnerId: '', vehicleId: '', warehouseId: '' });
  const [applied, setApplied] = useState(f);
  const [data, setData] = useState<any>(null);
  const [opts, setOpts] = useState<any>({ partners: [], vehicles: [], warehouses: [] });
  const [err, setErr] = useState(''), [forbidden, setForbidden] = useState(false), [busy, setBusy] = useState(false);

  const query = (x: typeof f) => Object.entries(x).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setData(await api('/api/platform/analytics/summary?' + query(applied))); }
    catch (e: any) { const m = e?.message || 'Not loaded'; if (/may not|Only|staff|Customer/.test(m)) setForbidden(true); setErr(m); }
    finally { setBusy(false); }
  }, [applied]);

  useEffect(() => { if (s?.ready && !s.partner) load(); }, [s?.ready, s?.partner, load]);
  useEffect(() => { if (s?.ready && !s.partner) api('/api/platform/analytics/options').then(setOpts).catch(() => undefined); }, [s?.ready, s?.partner]);

  if (!s) return <p className="p-6">Loading...</p>;
  if (s.partner) return <div className="p-6"><NotAllowed what="open Management Analytics. Your figures are in My Service Report" /></div>;
  if (!s.ready) return <div className="p-6"><PageTitle icon={<BarChart3 />} title="Management Analytics" /><ScriptMissing /></div>;
  if (forbidden) return <div className="p-6"><PageTitle icon={<BarChart3 />} title="Management Analytics" /><div role="alert" className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{err}</div></div>;

  const k = data?.kpi || {};
  const set = (key: string) => (e: any) => setF({ ...f, [key]: e.target.value });
  return <div className="p-6">
    <PageTitle icon={<BarChart3 />} title="Management Analytics">
      Trips, on-time delivery, temperature, money and trucks for the chosen period. The figures are kept for 5 minutes.
    </PageTitle>

    <form className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4 lg:grid-cols-7" onSubmit={e => { e.preventDefault(); setApplied(f); }}>
      <div><label htmlFor="an-from" className={label}>From</label><input id="an-from" type="date" className={input} value={f.from} onChange={set('from')} /></div>
      <div><label htmlFor="an-to" className={label}>To</label><input id="an-to" type="date" className={input} value={f.to} onChange={set('to')} /></div>
      <div><label htmlFor="an-bucket" className={label}>Periods</label>
        <select id="an-bucket" className={input} value={f.bucket} onChange={set('bucket')}>
          <option value="">Automatic</option><option value="MONTH">Months</option><option value="WEEK">Weeks (12 weeks or less)</option>
        </select></div>
      <div><label htmlFor="an-partner" className={label}>Customer</label>
        <select id="an-partner" className={input} value={f.partnerId} onChange={set('partnerId')}>
          <option value="">Every customer</option>{(opts.partners || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <div><label htmlFor="an-vehicle" className={label}>Vehicle</label>
        <select id="an-vehicle" className={input} value={f.vehicleId} onChange={set('vehicleId')}>
          <option value="">Every vehicle</option>{(opts.vehicles || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <div><label htmlFor="an-wh" className={label}>Warehouse</label>
        <select id="an-wh" className={input} value={f.warehouseId} onChange={set('warehouseId')}>
          <option value="">Every warehouse</option>{(opts.warehouses || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <div className="flex items-end gap-2">
        <button className={btn} disabled={busy}>{busy ? 'Loading...' : 'Show'}</button>
        <button type="button" className={btnLight} aria-label="Download every table as an Excel file" disabled={!data}
          onClick={() => apiDownload('/api/platform/analytics/export?format=xlsx&' + query(applied), 'management-analytics.xlsx').catch(e => setErr(e?.message || 'Not downloaded'))}>
          <Download className="inline h-4 w-4" aria-hidden /> Excel
        </button>
      </div>
    </form>

    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    {!data ? (busy && <p className="mt-4">Loading...</p>) : <>
      <p className="mt-3 text-sm text-slate-600">From {day(data.from)} to {day(data.to)}, by {data.bucket === 'WEEK' ? 'week' : 'month'}.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Tile title="Trips" value={num(k.trips)} hint={`${num(k.completed)} completed, ${num(k.running)} running`} />
        <Tile title="On time" value={pct(k.onTimePct)} hint={`of ${num(k.onTimeMeasured)} trips with an expected arrival`} />
        <Tile title="Temperature excursions" value={pct(k.excursionPct)} hint={`${num(k.excursionTrips)} trips, ${num(k.excursionMinutes)} min out of range`} />
        <Tile title="Revenue billed" value={rupee(k.revenue)} />
        <Tile title="Collected" value={rupee(k.collected)} />
        <Tile title="Outstanding today" value={rupee(k.outstanding)} hint={k.overdue != null ? `${rupee(k.overdue)} overdue` : undefined} />
        <Tile title="Truck utilisation" value={pct(k.utilisationPct)} hint="days with a trip / days in the range" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title="Tonnes moved" value={num(k.tonnes, 1)} />
        <Tile title="Cost per km / per ton" value={k.costPerKm == null && k.costPerTon == null ? '-' : `${rupee(k.costPerKm)} / ${rupee(k.costPerTon)}`} hint={k.expenses != null ? `vehicle expenses ${rupee(k.expenses)}` : 'no vehicle expenses in the range'} />
        <Tile title="Warehouse occupancy" value={pct(k.warehouseOccupancyPct)} hint="pallets stored / bin capacity, today" />
        <Tile title="Driver safety score" value={k.driverSafetyScore == null ? '-' : num(k.driverSafetyScore, 1)} hint={data.drivers?.drivers ? `average of ${data.drivers.drivers} drivers, ${data.drivers.atRisk} at risk` : undefined} />
      </div>
      <Notes notes={data.notes} />
      <TrendCharts trend={data.trend || []} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Donut title="Revenue by customer (top 10)" unit="" parts={(data.customersByRevenue || []).map((c: any) => ({ label: c.partnerName, value: Number(c.revenue || 0) }))} />
        <BarChart title="Truck utilisation % (busiest 12)" unit="%" labels={(data.vehicles || []).slice(0, 12).map((v: any) => v.vehicleNumber)}
          series={[{ name: 'Utilisation %', values: (data.vehicles || []).slice(0, 12).map((v: any) => v.utilisationPct) }]} />
      </div>
      <Table caption="Lanes (from city -> to city)" rows={data.lanes} columns={laneColumns} />
      <div className="grid gap-x-4 lg:grid-cols-2">
        <Table caption="Top 10 customers by revenue" rows={data.customersByRevenue}
          columns={[['Customer', r => r.partnerName], ['Revenue', r => rupee(r.revenue)], ['Trips', r => num(r.trips)], ['Tonnes', r => num(r.tonnes, 1)]]} />
        <Table caption="Top 10 customers by trips" rows={data.customersByTrips}
          columns={[['Customer', r => r.partnerName], ['Trips', r => num(r.trips)], ['Revenue', r => rupee(r.revenue)], ['Tonnes', r => num(r.tonnes, 1)]]} />
      </div>
      <Table caption="Vehicle utilisation" rows={data.vehicles} columns={[
        ['Vehicle', r => r.vehicleNumber], ['Trips', r => num(r.trips)], ['Days with a trip', r => `${num(r.daysWithTrip)} of ${num(r.daysInRange)}`],
        ['Utilisation', r => pct(r.utilisationPct)], ['Km', r => num(r.km)], ['Tonnes', r => num(r.tonnes, 1)], ['Expenses', r => rupee(r.expenses)],
        ['Cost per km', r => rupee(r.costPerKm)], ['Cost per ton', r => rupee(r.costPerTon)]]} />
      {(data.warehouses || []).length > 0 && <Table caption="Warehouse occupancy today" rows={data.warehouses} columns={[
        ['Warehouse', r => r.warehouseName], ['Capacity (pallets)', r => num(r.capacityPallets)], ['Pallets stored', r => num(r.palletsStored)], ['Occupancy', r => pct(r.occupancyPct)]]} />}
    </>}
  </div>;
}

/** REQ-PLT-006 the customer's own service report (partner login). */
export function MyServiceReportPage() {
  const s = usePlatform();
  const [f, setF] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState(f);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!s?.ready || !s.partner) return;
    setBusy(true); setErr('');
    api('/api/platform/analytics/partner?' + Object.entries(applied).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&'))
      .then(setData).catch(e => setErr(e?.message || 'Not loaded')).finally(() => setBusy(false));
  }, [s?.ready, s?.partner, applied]);

  if (!s) return <p className="p-6">Loading...</p>;
  if (!s.partner) return <div className="p-6"><NotAllowed what="open My Service Report: it is for customer logins. Staff use Management Analytics" /></div>;
  if (!s.ready) return <div className="p-6"><PageTitle icon={<FileBarChart />} title="My Service Report" /><ScriptMissing /></div>;
  const k = data?.kpi || {};
  return <div className="p-6">
    <PageTitle icon={<FileBarChart />} title="My Service Report">Your trips with us: how many, how many arrived on time, temperature, and the bills that are due.</PageTitle>
    <form className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm" onSubmit={e => { e.preventDefault(); setApplied(f); }}>
      <div><label htmlFor="mr-from" className={label}>From</label><input id="mr-from" type="date" className={input} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
      <div><label htmlFor="mr-to" className={label}>To</label><input id="mr-to" type="date" className={input} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
      <button className={btn} disabled={busy}>{busy ? 'Loading...' : 'Show'}</button>
    </form>
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    {data && <>
      <p className="mt-3 text-sm text-slate-600">From {day(data.from)} to {day(data.to)}.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile title="Trips" value={num(k.trips)} hint={`${num(k.completed)} completed, ${num(k.running)} on the road`} />
        <Tile title="On time" value={pct(k.onTimePct)} hint={`of ${num(k.onTimeMeasured)} trips with an expected arrival`} />
        <Tile title="Temperature excursions" value={pct(k.excursionPct)} hint={`${num(k.excursionTrips)} trips`} />
        <Tile title="Tonnes moved" value={num(k.tonnes, 1)} />
        <Tile title="Bills due" value={rupee(k.outstanding)} hint={k.overdue ? `${rupee(k.overdue)} past the due date` : undefined} />
      </div>
      <TrendCharts trend={data.trend || []} money={false} />
      <Table caption="Your lanes" rows={data.lanes} columns={laneColumns} />
      <Table caption="Bills not fully paid" rows={data.billsDue} empty="No bill is due. Thank you." columns={[
        ['Bill', r => r.invoiceNumber], ['Date', r => day(r.invoiceDate)], ['Due', r => <span className={r.overdue ? 'font-bold text-red-700' : ''}>{day(r.dueDate)}{r.overdue ? ' (overdue)' : ''}</span>],
        ['Total', r => rupee(r.totalAmount)], ['Still to pay', r => rupee(r.outstanding)]]} />
    </>}
  </div>;
}
