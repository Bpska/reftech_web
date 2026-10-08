/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-016 -- warehouse reports: space used, stock, ageing, expiry, dwell time, movements, staff productivity,
//   chamber temperature and inbound deliveries. Choose a report and the filters, see it on screen or download it as
//   CSV (opens in Excel).
// A Partner login gets stock, ageing, expiry, dwell and movements for its own goods.
//
// Backend: WarehouseReportController (/api/warehouse/reports/**).
import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, NotReady, Section } from '@/shared/components/FormKit';
import { btn, btnLight, day, input, label, num, who } from './wms';
import { OPS_SCRIPT, Table, monthStart, today, usePartners, useRunner, useWarehouses } from './wmsOps';

const REPORTS: Record<string, [string, string]> = {
  space: ['Space used', 'Positions used and free by chamber, pallets not good, kg stored and the last 24 hours of temperature. Now.'],
  stock: ['Stock', 'Stock by partner and product: pallets, quantity, kg, not good, reserved, nearest expiry. Now.'],
  ageing: ['Stock ageing', 'Stock by partner in bands of days since it was received. Now.'],
  expiry: ['Expiry', 'Stock by partner in bands of days to expiry. Now.'],
  dwell: ['Dwell time', 'Pallets that left in the period: average, shortest and longest stay.'],
  movements: ['Movements', 'Pallets and quantity in and out, by day.'],
  productivity: ['Productivity', 'Receipts, putaways, moves, picks, loads and counts per person.'],
  temperature: ['Temperature', 'Readings, out of range, alerts and minutes out of range per chamber.'],
  inbound: ['Inbound deliveries', 'On time, late, not arrived, unloading time and receipt differences.'],
};
const NOW = new Set(['space', 'stock', 'ageing', 'expiry']);
const isDay = (k: string) => /(Day|Expiry|date|Date)$/.test(k) || k === 'day';

export function WarehouseReportsPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [name, setName] = useState('stock');
  const [f, setF] = useState({ warehouseId: '', partnerId: '', from: monthStart(), to: today() });
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api('/api/warehouse/reports').then(d => { setReady(d.ready !== false); setNames(d.reports || []); }).catch(x => r.setError(String((x as Error).message)));
  }, []);
  const query = () => new URLSearchParams(Object.entries(f).filter(([k, v]) => v && !(me.partner && k === 'partnerId')) as [string, string][]).toString();
  const show = () => r.run(() => api(`/api/warehouse/reports/${name}?${query()}`), d => setData(d));
  const csv = () => r.run(async () => { await apiDownload(`/api/warehouse/reports/${name}.csv?${query()}`, `warehouse-${name}-${f.from}-to-${f.to}.csv`); return { message: 'The CSV is downloaded.' }; });
  useEffect(() => { setData(null); }, [name]);
  if (!me.staff && !me.partner) return null;
  const cols = (data?.columns || []).map((c: any) => ({
    key: c.key, label: c.label, right: typeof data.rows?.[0]?.[c.key] === 'number',
    render: (x: any) => x[c.key] == null ? '-' : typeof x[c.key] === 'number' ? num(x[c.key], 2) : isDay(c.key) ? day(String(x[c.key])) : String(x[c.key]),
  }));
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><BarChart3 className="h-8 w-8 text-sky-700" />Warehouse Reports</h1>
    <p className="text-slate-600">{me.partner ? 'Your stock, its age and expiry, how long it stays and what moved.' : 'Space, stock, ageing, expiry, dwell time, movements, productivity, temperature and inbound deliveries.'}</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    <div className="mt-3 flex flex-wrap gap-2">{names.map(n => <button key={n} type="button" onClick={() => setName(n)}
      className={`rounded-xl px-4 py-2 font-semibold ${name === n ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{REPORTS[n]?.[0] || n}</button>)}</div>
    <Section title={REPORTS[name]?.[0] || name}>
      <p className="mb-3 text-sm text-slate-600">{REPORTS[name]?.[1]}</p>
      <div className="grid gap-3 md:grid-cols-5">
        <div><label className={label}>Warehouse</label><select className={input} value={f.warehouseId} onChange={e => setF({ ...f, warehouseId: e.target.value })}>
          <option value="">Every warehouse</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
        {me.staff && <div><label className={label}>Partner</label><select className={input} value={f.partnerId} onChange={e => setF({ ...f, partnerId: e.target.value })}>
          <option value="">Every partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        {!NOW.has(name) && <>
          <div><label className={label}>From</label><input type="date" className={input} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
          <div><label className={label}>To</label><input type="date" className={input} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
        </>}
        <div className="flex items-end gap-2"><button className={btn} disabled={r.busy} onClick={show}>Show</button><button className={btnLight} disabled={r.busy} onClick={csv}>CSV</button></div>
      </div>
      {data && <div className="mt-4">
        {!NOW.has(name) && <div className="mb-2 text-sm text-slate-500">{day(data.from)} to {day(data.to)} · {(data.rows || []).length} row(s)</div>}
        <Table rows={data.rows || []} cols={cols} empty="Nothing in this report for these filters." />
      </div>}
    </Section>
  </>;
}
