/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-023 -- Reefer Plug Points: the yard board of plug-in points for parked reefer trucks, booking a point,
// plugging in and out with the meter readings (units, hours and charge worked out at the point's tariff) and the
// bills: a customer's bill goes to Billing, a transporter's bill is recovered from its freight bill.
// RefTech staff; the points and their tariff are kept by a Manager or an Admin.
//
// Backend: PlugPointController (/api/warehouse/plug-points/**).
import { useCallback, useEffect, useState } from 'react';
import { PlugZap } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, card, day, input, num, pill, when, who } from './wms';
import { StaffOnly, Table, Tabs, iso, monthStart, opts, post, put, today, usePartners, useRunner, useWarehouses } from './wmsOps';
import { BOND_SCRIPT, billedHours, plugCharge, rupees, words } from './bondPlantPlug';

const API = '/api/warehouse/plug-points';

export function PlugPointsPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [o, setO] = useState<any>(null);
  const [tab, setTab] = useState('board');
  const [warehouseId, setWarehouseId] = useState('');
  const [points, setPoints] = useState<any[]>([]);
  const [status, setStatus] = useState('OPEN');
  const [sessions, setSessions] = useState<any[]>([]);
  const [ending, setEnding] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const op = await api(`${API}/options`); setO(op);
      if (op.ready === false) return;
      const [p, s] = await Promise.all([api(`${API}?warehouseId=${warehouseId}&all=true`), api(`${API}/sessions?status=${status}&warehouseId=${warehouseId}`)]);
      setPoints(p.points || []); setSessions(s.sessions || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [warehouseId, status]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  const act = (path: string, body: any = {}) => r.run(() => post(`${API}/sessions/${path}`, body), async () => { setEnding(null); await load(); });

  if (!me.staff) return <StaffOnly title="Reefer Plug Points" />;
  const manager = !!o?.manager;
  const free = points.filter(p => p.active && p.status === 'AVAILABLE');
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><PlugZap className="h-8 w-8 text-sky-700" />Reefer Plug Points</h1>
    <p className="text-slate-600">Book a point for a parked reefer truck, record when it is plugged in and out with the meter, and bill the transporter or the customer.</p>
    <Banner msg={r.msg} error={r.error} />
    {o?.ready === false && <NotReady script={BOND_SCRIPT} />}
    {o?.ready && <>
      <div className="flex flex-wrap items-center gap-3">
        <select className={`${input} max-w-xs`} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">All warehouses</option>{warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        {o.summary && <span className="text-sm text-slate-600">{o.summary.plugged} plugged in · {o.summary.bookedToday} booked today · {o.summary.unbilled} not billed</span>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['board', 'Yard board'], ['sessions', 'Sessions'], ['bills', 'Bills'], ...(manager ? [['points', 'Points & tariff']] as [string, string][] : [])]} />

      {tab === 'board' && <>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {points.filter(p => p.active).map(p => <div key={p.id} className={`${card} border-l-4 ${p.status !== 'AVAILABLE' ? 'border-slate-300 opacity-70' : p.current ? 'border-sky-600' : 'border-emerald-500'}`}>
            <div className="flex items-center justify-between"><b className="text-lg">{p.pointCode}</b>
              <span className={pill(p.status !== 'AVAILABLE' ? 'CLOSED' : p.current ? 'RUNNING' : 'GOOD')}>{p.status !== 'AVAILABLE' ? 'Out of service' : p.current ? 'In use' : 'Free'}</span></div>
            <div className="text-xs text-slate-500">{p.warehouseName} · {p.location || ''} · {num(p.maxKw)} kW</div>
            {p.current && <div className="mt-2 text-sm"><b>{p.current.vehicleNumber}</b> since {when(p.current.startedAt)}<br />meter {num(p.current.meterStart)} · {p.current.transporterName || p.current.partnerName}
              <div className="mt-1"><button className={btn} onClick={() => setEnding(p.current)}>Unplug</button></div></div>}
            {(p.next || []).length > 0 && <div className="mt-2 text-xs">{p.next.map((s: any) => <div key={s.id} className="flex items-center justify-between gap-1">
              <span>{s.vehicleNumber} {when(s.plannedFrom)}</span>
              {!p.current && <button className="text-sky-700 underline" onClick={() => { const m = window.prompt(`Meter reading now (kWh) for ${s.vehicleNumber}`); if (m) void act(`${s.id}/start`, { meterStart: m }); }}>Plug in</button>}</div>)}</div>}
          </div>)}
          {points.length === 0 && <div className="text-slate-500">No plug points yet{manager ? ': add them on Points & tariff' : ''}.</div>}
        </div>
        {ending && <EndSession s={ending} round={Number(o.roundMinutes || 30)} r={r} onCancel={() => setEnding(null)} onEnd={(b: any) => act(`${ending.id}/end`, b)} />}
        <Section title="Book a point">
          <QuickForm cols={4} busy={r.busy} submitText="Book" fields={[
            { name: 'pointId', label: 'Point', type: 'select', required: true, options: free.map(p => [String(p.id), `${p.pointCode} · ${p.warehouseName}`]) },
            { name: 'vehicleNumber', label: 'Truck number', required: true }, { name: 'payerType', label: 'Bill to', type: 'select', required: true, options: [['TRANSPORTER', 'Transporter'], ['CUSTOMER', 'Customer']] },
            { name: 'transporterId', label: 'Transporter', type: 'select', options: opts(o.transporters || []) }, { name: 'partnerId', label: 'Customer', type: 'select', options: opts(partners) },
            { name: 'plannedFrom', label: 'From', type: 'text', placeholder: 'yyyy-mm-ddThh:mm' }, { name: 'plannedTo', label: 'To', type: 'text', placeholder: 'yyyy-mm-ddThh:mm', hint: `At most ${o.maxBookingHours} h` },
            { name: 'setTemperatureC', label: 'Reefer set point (°C)', type: 'number' }, { name: 'driverName', label: 'Driver' }, { name: 'driverPhone', label: 'Driver phone' },
            { name: 'startNow', label: 'Plug in now (walk-in)', type: 'checkbox' }, { name: 'meterStart', label: 'Meter now (walk-in, kWh)', type: 'number' }, { name: 'notes', label: 'Notes', wide: true }]}
            onSubmit={(v, f) => r.run(() => post(`${API}/sessions`, { ...v, plannedFrom: iso(v.plannedFrom), plannedTo: iso(v.plannedTo) }), async () => { f.reset(); await load(); })} />
        </Section>
      </>}

      {tab === 'sessions' && <Section title="Sessions" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
        {[['OPEN', 'Booked and plugged in'], ['UNBILLED', 'Ended, not billed'], ['BILLED', 'Billed'], ['CANCELLED', 'Cancelled'], ['ALL', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
        <Table rows={sessions} empty="No sessions." cols={[
          { key: 'sessionNo', label: 'Session' }, { key: 'pointCode', label: 'Point' }, { key: 'vehicleNumber', label: 'Truck' },
          { key: 'payer', label: 'Bill to', render: x => x.payerType === 'CUSTOMER' ? `Customer ${x.partnerName}` : `Transporter ${x.transporterName}` },
          { key: 'plannedFrom', label: 'Booked', render: x => `${when(x.plannedFrom)} - ${when(x.plannedTo)}` },
          { key: 'startedAt', label: 'Plugged', render: x => x.startedAt ? `${when(x.startedAt)}${x.endedAt ? ' - ' + when(x.endedAt) : ''}` : '-' },
          { key: 'unitsKwh', label: 'kWh', right: true, render: x => x.unitsKwh != null ? num(x.unitsKwh) : '' }, { key: 'amount', label: 'Charge', right: true, render: x => x.amount != null ? rupees(x.amount) : '' },
          { key: 'status', label: 'Status', render: x => <><span className={pill(x.status === 'PLUGGED' ? 'RUNNING' : x.status)}>{words(x.status)}</span>{x.warning && <div className="text-xs text-amber-700">{x.warning}</div>}</> },
          { key: 'id', label: '', render: x => <div className="flex gap-1">
            {x.status === 'PLUGGED' && <button className={btnLight} onClick={() => setEnding(x)}>Unplug</button>}
            {x.status === 'BOOKED' && <><button className={btnLight} onClick={() => { const m = window.prompt('Meter reading now (kWh)'); if (m) void act(`${x.id}/start`, { meterStart: m }); }}>Plug in</button>
              <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the booking cancelled? (type NO SHOW when the truck did not come)'); if (reason) void act(`${x.id}/cancel`, { reason, noShow: /no.?show/i.test(reason) }); }}>Cancel</button></>}
          </div> },
        ]} />
        {ending && <EndSession s={ending} round={Number(o.roundMinutes || 30)} r={r} onCancel={() => setEnding(null)} onEnd={(b: any) => act(`${ending.id}/end`, b)} />}
      </Section>}

      {tab === 'bills' && <Bills o={o} warehouses={warehouses} partners={partners} r={r} />}
      {tab === 'points' && manager && <Points points={points} warehouses={warehouses} r={r} onChanged={load} />}
    </>}
  </>;
}

function EndSession({ s, round, r, onCancel, onEnd }: any) {
  const [meter, setMeter] = useState('');
  const units = meter ? Math.max(0, Number(meter) - Number(s.meterStart || 0)) : 0;
  const hours = billedHours(s.startedAt, new Date().toISOString(), round);
  const c = plugCharge(units, hours, Number(s.ratePerKwh || 0), Number(s.ratePerHour || 0), Number(s.minCharge || 0));
  return <div className="mt-4 rounded-xl bg-sky-50 p-4">
    <div className="font-semibold">Unplug {s.vehicleNumber} from {s.pointCode} (plugged in {when(s.startedAt)}, meter {num(s.meterStart)})</div>
    <div className="mt-2 flex flex-wrap items-end gap-3">
      <label className="text-sm">Meter now (kWh)<input className={input} type="number" step="any" value={meter} onChange={e => setMeter(e.target.value)} /></label>
      <div className="text-sm">{num(units)} kWh · {hours} h billed<br /><b>{rupees(c.amount)}</b>{c.minimumApplied ? ' (minimum charge)' : ''}</div>
      <button className={btn} disabled={r.busy || !meter} onClick={() => onEnd({ meterEnd: meter })}>Unplug</button>
      <button className={btnLight} onClick={onCancel}>Close</button>
    </div>
  </div>;
}

function Bills({ o, warehouses, partners, r }: any) {
  const [bills, setBills] = useState<any[]>([]);
  const [f, setF] = useState({ payerType: 'TRANSPORTER', payerId: '', warehouseId: '', from: monthStart(), to: today() });
  const [pv, setPv] = useState<any>(null);
  const [sel, setSel] = useState<any>(null);
  const load = () => api(`${API}/bills`).then(d => setBills(d.bills || [])).catch(() => setBills([]));
  useEffect(() => { void load(); }, []);
  const payers = f.payerType === 'CUSTOMER' ? partners : (o.transporters || []);
  const qs = `payerType=${f.payerType}&payerId=${f.payerId}&warehouseId=${f.warehouseId}&from=${f.from}&to=${f.to}`;
  const openBill = async (id: number) => { const d = await r.run(() => api(`${API}/bills/${id}`)); if (d) setSel(d); };
  const billAct = (path: string, body: any = {}) => r.run(() => post(`${API}/bills/${sel.id}/${path}`, body), async () => { await load(); await openBill(sel.id); });
  return <>
    <Section title="Make a bill">
      <div className="grid gap-2 md:grid-cols-6">
        <select className={input} value={f.payerType} onChange={e => setF({ ...f, payerType: e.target.value, payerId: '' })}><option value="TRANSPORTER">Transporter</option><option value="CUSTOMER">Customer</option></select>
        <select className={input} value={f.payerId} onChange={e => setF({ ...f, payerId: e.target.value })}><option value="">Choose…</option>{payers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className={input} value={f.warehouseId} onChange={e => setF({ ...f, warehouseId: e.target.value })}><option value="">Warehouse…</option>{warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <input className={input} type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
        <input className={input} type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
        <button className={btnLight} disabled={!f.payerId || !f.warehouseId} onClick={() => r.run(() => api(`${API}/bills/preview?${qs}`), setPv)}>Preview</button>
      </div>
      {f.payerType === 'CUSTOMER' && !o.billingReady && <div className="mt-2 text-sm text-amber-700">Billing is not set up yet: a customer bill can be drafted but not sent.</div>}
      {pv && <div className="mt-3">
        <Table rows={pv.sessions || []} empty="No ended sessions to bill in the period." cols={[
          { key: 'sessionNo', label: 'Session' }, { key: 'vehicleNumber', label: 'Truck' }, { key: 'endedAt', label: 'Ended', render: x => when(x.endedAt) },
          { key: 'unitsKwh', label: 'kWh', right: true, render: x => num(x.unitsKwh) }, { key: 'billedHours', label: 'Hours', right: true }, { key: 'amount', label: 'Charge', right: true, render: x => rupees(x.amount) }]} />
        <div className="mt-2 flex items-center gap-3"><b>{num(pv.unitsKwh)} kWh · {rupees(pv.amount)}</b>
          {(pv.sessions || []).length > 0 && <button className={btn} onClick={() => r.run(() => post(`${API}/bills`, f), async (d: any) => { setPv(null); await load(); if (d?.id) await openBill(d.id); })}>Draft the bill</button>}</div>
      </div>}
    </Section>
    <Section title="Bills">
      <Table rows={bills} selected={sel?.id} onRow={x => openBill(x.id)} empty="No bills yet." cols={[
        { key: 'billNo', label: 'Bill' }, { key: 'payer', label: 'Bill to', render: x => x.payerType === 'CUSTOMER' ? x.partnerName : x.transporterName },
        { key: 'period', label: 'Period', render: x => `${day(x.periodFrom)} - ${day(x.periodTo)}` }, { key: 'sessions', label: 'Sessions', right: true },
        { key: 'unitsKwh', label: 'kWh', right: true, render: x => num(x.unitsKwh) }, { key: 'amount', label: 'Amount', right: true, render: x => rupees(x.amount) },
        { key: 'invoiceNumber', label: 'Invoice / recovered', render: x => x.invoiceNumber || x.recoveredRef || '-' }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{words(x.status)}</span> },
      ]} />
    </Section>
    {sel && <Section title={`${sel.billNo} · ${sel.payerType === 'CUSTOMER' ? sel.partnerName : sel.transporterName}`} right={<div className="flex gap-2">
      {sel.status === 'DRAFT' && <button className={btn} onClick={() => billAct('send')}>{sel.payerType === 'CUSTOMER' ? 'Send to Billing' : 'Raise for recovery'}</button>}
      {sel.status === 'DRAFT' && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the bill cancelled?'); if (reason) void billAct('cancel', { reason }); }}>Cancel</button>}
      {sel.status === 'BILLED' && sel.payerType === 'TRANSPORTER' && <button className={btn} onClick={() => { const freightBillNo = window.prompt('Freight bill number it was deducted from'); if (freightBillNo) void billAct('recovered', { freightBillNo }); }}>Mark recovered</button>}
    </div>}>
      <div className="mb-2 text-sm">{sel.warehouseName} · {day(sel.periodFrom)} - {day(sel.periodTo)} · <b>{rupees(sel.amount)}</b> · {words(sel.status)}{sel.invoiceNumber ? ` · invoice ${sel.invoiceNumber}` : ''}{sel.recoveredRef ? ` · recovered on ${sel.recoveredRef}` : ''}</div>
      <Table rows={sel.lines || []} cols={[
        { key: 'sessionNo', label: 'Session' }, { key: 'pointCode', label: 'Point' }, { key: 'vehicleNumber', label: 'Truck' }, { key: 'startedAt', label: 'From', render: x => when(x.startedAt) },
        { key: 'endedAt', label: 'To', render: x => when(x.endedAt) }, { key: 'unitsKwh', label: 'kWh', right: true, render: x => num(x.unitsKwh) }, { key: 'billedHours', label: 'Hours', right: true },
        { key: 'amount', label: 'Charge', right: true, render: x => rupees(x.amount) }]} />
    </Section>}
  </>;
}

function Points({ points, warehouses, r, onChanged }: any) {
  const [edit, setEdit] = useState<any>(null);
  return <>
    <Section title={edit ? `Change ${edit.pointCode}` : 'Add a plug point'}>
      <QuickForm key={edit?.id || 'new'} cols={4} busy={r.busy} submitText="Save" initial={edit || undefined} onCancel={edit ? () => setEdit(null) : undefined} fields={[
        { name: 'warehouseId', label: 'Warehouse', type: 'select', required: true, options: opts(warehouses) }, { name: 'pointCode', label: 'Point code', required: true },
        { name: 'location', label: 'Where in the yard' }, { name: 'maxKw', label: 'Largest load (kW)', type: 'number' }, { name: 'meterNo', label: 'Meter no.' },
        { name: 'ratePerKwh', label: '₹ per kWh', type: 'number' }, { name: 'ratePerHour', label: '₹ per hour', type: 'number' }, { name: 'minCharge', label: 'Minimum charge (₹)', type: 'number' },
        { name: 'notes', label: 'Notes', wide: true }]}
        onSubmit={(v, f) => r.run(() => edit ? put(`${API}/${edit.id}`, v) : post(API, v), async () => { f.reset(); setEdit(null); await onChanged(); })} />
    </Section>
    <Section title="Points & tariff">
      <Table rows={points} cols={[
        { key: 'pointCode', label: 'Point' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'location', label: 'Where' }, { key: 'maxKw', label: 'kW', right: true },
        { key: 'tariff', label: 'Tariff', render: x => `${rupees(x.ratePerKwh)}/kWh + ${rupees(x.ratePerHour)}/h, min ${rupees(x.minCharge)}` },
        { key: 'status', label: 'Status', render: x => `${words(x.status)}${x.active ? '' : ' (off)'}` },
        { key: 'id', label: '', render: x => <div className="flex gap-1"><button className={btnLight} onClick={() => setEdit(x)}>Edit</button>
          <button className={btnLight} onClick={() => r.run(() => post(`${API}/${x.id}/status`, { status: x.status === 'AVAILABLE' ? 'OUT_OF_SERVICE' : 'AVAILABLE' }), onChanged)}>{x.status === 'AVAILABLE' ? 'Out of service' : 'Back in service'}</button></div> },
      ]} />
    </Section>
  </>;
}
