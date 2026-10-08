/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-022 -- Plant & Equipment: the register of compressors, condensers, evaporators, generators, forklifts,
// racks and doors per warehouse (and chamber), preventive schedules by run hours or days, breakdown and preventive
// tickets (priority, chambers affected, technician, spare parts, downtime and cost) and the cost report.
// A compressor fault seen by the chamber sensors opens a P1 ticket by itself (the plant sweep timer).
// RefTech staff; the register and schedules are kept by a Manager or an Admin.
//
// Backend: PlantController (/api/warehouse/plant/**).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, input, num, pill, when, who } from './wms';
import { StaffOnly, Table, Tabs, monthStart, opts, post, put, today, useRunner, useWarehouses } from './wmsOps';
import { ASSET_TYPE_NAMES, BOND_SCRIPT, downtime, everyText, nextSteps, priorityPill, rupees, serviceStyle, serviceText, words } from './bondPlantPlug';

const API = '/api/warehouse/plant';
const TYPES: [string, string][] = Object.entries(ASSET_TYPE_NAMES);

export function PlantPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const [o, setO] = useState<any>(null);
  const [tab, setTab] = useState('tickets');
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [due, setDue] = useState<any[]>([]);
  const [asset, setAsset] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const chambers = useMemo(() => warehouses.flatMap((w: any) => (w.chambers || []).map((c: any) => ({ ...c, warehouseId: w.id, warehouseName: w.name }))), [warehouses]);

  const load = useCallback(async () => {
    try {
      const op = await api(`${API}/options`); setO(op);
      if (op.ready === false) return;
      const [a, t, d] = await Promise.all([api(`${API}/assets?warehouseId=${warehouseId}`), api(`${API}/tickets?status=${status}&warehouseId=${warehouseId}`), api(`${API}/due?warehouseId=${warehouseId}`)]);
      setAssets(a.assets || []); setTickets(t.tickets || []); setDue(d.due || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [warehouseId, status]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  const openAsset = async (id: number) => { const d = await r.run(() => api(`${API}/assets/${id}`)); if (d) setAsset(d); };
  const openTicket = async (id: number) => { const d = await r.run(() => api(`${API}/tickets/${id}`)); if (d) setTicket(d); };
  const afterTicket = async (d: any) => { if (d?.id) setTicket(d.ticketNo ? d : await api(`${API}/tickets/${d.id}`)); await load(); };

  if (!me.staff) return <StaffOnly title="Plant & Equipment" />;
  const manager = !!o?.manager;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Wrench className="h-8 w-8 text-sky-700" />Plant & Equipment</h1>
    <p className="text-slate-600">Compressors, condensers, evaporators, generators, forklifts, racks and doors: preventive service and breakdown tickets with downtime and cost.</p>
    <Banner msg={r.msg} error={r.error} />
    {o?.ready === false && <NotReady script={BOND_SCRIPT} />}
    {o?.ready && <>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} max-w-xs`} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">All warehouses</option>{warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        {manager && <button className={btnLight} onClick={() => r.run(() => post(`${API}/sweep`), load)}>Check sensors and schedules now</button>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['tickets', 'Tickets'], ['due', `Due service (${due.length})`], ['assets', 'Register'], ['costs', 'Downtime & cost']]} />

      {tab === 'tickets' && <>
        <Section title="Open a ticket">
          <QuickForm cols={4} busy={r.busy} submitText="Open ticket" fields={[
            { name: 'assetId', label: 'Equipment', type: 'select', required: true, options: assets.filter(a => a.status !== 'RETIRED').map(a => [String(a.id), `${a.assetCode} · ${a.name}`]) },
            { name: 'ticketType', label: 'Type', type: 'select', required: true, options: [['BREAKDOWN', 'Breakdown'], ['PREVENTIVE', 'Preventive']] },
            { name: 'priority', label: 'Priority', type: 'select', options: [['P1', 'P1 (4 h)'], ['P2', 'P2 (24 h)'], ['P3', 'P3 (3 days)'], ['P4', 'P4 (7 days)']], hint: 'Empty: worked out from the equipment and the chambers' },
            { name: 'technicianName', label: 'Technician' }, { name: 'title', label: 'What is wrong', required: true, wide: true },
            { name: 'chamberIds', label: 'Chambers affected', type: 'select', options: chambers.filter(c => !warehouseId || String(c.warehouseId) === warehouseId).map(c => [String(c.id), `${c.warehouseName} / ${c.name}`]) },
            { name: 'technicianPhone', label: 'Technician phone' }, { name: 'vendorName', label: 'Service vendor' }, { name: 'description', label: 'Details', wide: true }]}
            onSubmit={(v, f) => r.run(() => post(`${API}/tickets`, { ...v, chamberIds: v.chamberIds ? [v.chamberIds] : [] }), async (d: any) => { f.reset(); await afterTicket(d); })} />
        </Section>
        <Section title="Tickets" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
          {[['OPEN', 'Open'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed'], ['ALL', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
          <Table rows={tickets} selected={ticket?.id} onRow={x => openTicket(x.id)} empty="No tickets." cols={[
            { key: 'ticketNo', label: 'Ticket' }, { key: 'priority', label: 'Pri', render: x => <span className={priorityPill(x.priority)}>{x.priority}</span> },
            { key: 'assetCode', label: 'Equipment', render: x => `${x.assetCode} · ${x.assetName}` }, { key: 'title', label: 'Title' },
            { key: 'source', label: 'From', render: x => x.source === 'SENSOR' ? 'Chamber sensor' : x.source === 'SCHEDULE' ? 'Schedule' : 'Typed in' },
            { key: 'chambers', label: 'Chambers' }, { key: 'technicianName', label: 'Technician' },
            { key: 'dueBy', label: 'Due by', render: x => when(x.dueBy) }, { key: 'downtimeMinutes', label: 'Down', render: x => downtime(x.downtimeMinutes) },
            { key: 'status', label: 'Status', render: x => <span className={pill(x.status === 'IN_PROGRESS' ? 'RUNNING' : x.status === 'WAITING_PARTS' ? 'HOLD' : x.status)}>{words(x.status)}</span> },
          ]} />
        </Section>
        {ticket && <TicketDetail k={ticket} r={r} onChanged={afterTicket} />}
      </>}

      {tab === 'due' && <Section title="Preventive service due">
        <Table rows={due} empty="Nothing is due." cols={[
          { key: 'assetCode', label: 'Equipment', render: x => `${x.assetCode} · ${x.assetName}` }, { key: 'warehouseName', label: 'Place', render: x => `${x.warehouseName}${x.chamberName ? ' / ' + x.chamberName : ''}` },
          { key: 'task', label: 'Task' }, { key: 'every', label: 'Every', render: x => everyText(x.everyHours, x.everyDays) },
          { key: 'nextDate', label: 'Next', render: x => [x.nextDate ? day(x.nextDate) : '', x.nextHours != null ? `${num(x.nextHours)} h` : ''].filter(Boolean).join(' / ') },
          { key: 'state', label: 'State', render: x => <span className={serviceStyle(x.state)}>{serviceText(x.state)} {x.reason ? `(${x.reason})` : ''}</span> },
          { key: 'openTicket', label: 'Ticket' },
        ]} />
      </Section>}

      {tab === 'assets' && <Assets assets={assets} asset={asset} manager={manager} warehouses={warehouses} chambers={chambers} r={r} onOpen={openAsset}
        onChanged={async (id?: number) => { await load(); if (id) await openAsset(id); }} />}
      {tab === 'costs' && <Costs warehouseId={warehouseId} r={r} />}
    </>}
  </>;
}

function TicketDetail({ k, r, onChanged }: any) {
  const [step, setStep] = useState('');
  const open = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'].includes(k.status);
  const move = (status: string, extra: any = {}) => r.run(() => post(`${API}/tickets/${k.id}/status`, { status, ...extra }), async (d: any) => { setStep(''); await onChanged(d); });
  return <Section title={<>{k.ticketNo} <span className={priorityPill(k.priority)}>{k.priority}</span> <span className={pill(k.status)}>{words(k.status)}</span></>} right={<div className="flex flex-wrap gap-2">
    {nextSteps(k.status).map(([s, t]) => <button key={s} className={s === 'CANCELLED' ? btnRed : btnLight} onClick={() => {
      if (s === 'RESOLVED' || s === 'ASSIGNED') { setStep(s); return; }
      if (s === 'CANCELLED') { const note = window.prompt('Why is the ticket cancelled?'); if (note) void move(s, { note }); return; }
      if (s === 'IN_PROGRESS' && !k.technicianName) { const technicianName = window.prompt('Who works on it?'); if (technicianName) void move(s, { technicianName }); return; }
      void move(s);
    }}>{t}</button>)}
  </div>}>
    <div className="grid gap-1 text-sm md:grid-cols-3">
      <div><b>{k.assetCode}</b> · {k.assetName} ({ASSET_TYPE_NAMES[k.assetType] || k.assetType})</div>
      <div>{k.warehouseName}{k.chambers ? ` · chambers ${k.chambers}` : ''}</div>
      <div>{words(k.ticketType)} · {k.source === 'SENSOR' ? 'opened by the chamber sensors' : k.source === 'SCHEDULE' ? 'from the preventive schedule' : `by ${k.createdByName || '-'}`}</div>
      <div className="md:col-span-3 font-semibold">{k.title}</div>
      {k.description && <div className="md:col-span-3 text-slate-700">{k.description}</div>}
      {k.alert && <div className="md:col-span-3 rounded-lg bg-red-50 p-2 text-red-800">Sensor alert {k.alert.alertType}: {k.alert.message} (since {when(k.alert.firstAt)}, {k.alert.status})</div>}
      <div>Reported {when(k.reportedAt)} · due by {when(k.dueBy)}</div>
      <div>Technician {k.technicianName || '-'} {k.technicianPhone || ''}{k.vendorName ? ` · ${k.vendorName}` : ''}</div>
      <div>Down {downtime(k.downtimeMinutes)}{k.downFrom ? ` since ${when(k.downFrom)}` : ''}</div>
      <div>Labour {rupees(k.labourCost)} · parts {rupees(k.partsCost)} · other {rupees(k.otherCost)} · <b>total {rupees(k.totalCost)}</b></div>
      {k.cause && <div className="md:col-span-2">Cause: {k.cause} · {k.actionTaken}</div>}
    </div>
    {step === 'ASSIGNED' && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm cols={3} busy={r.busy} submitText="Assign" onCancel={() => setStep('')} fields={[
      { name: 'technicianName', label: 'Technician', required: true }, { name: 'technicianPhone', label: 'Phone' }, { name: 'vendorName', label: 'Service vendor' }]} onSubmit={v => move('ASSIGNED', v)} /></div>}
    {step === 'RESOLVED' && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm cols={3} busy={r.busy} submitText="Resolve" onCancel={() => setStep('')} fields={[
      { name: 'cause', label: 'Cause', required: true }, { name: 'labourCost', label: 'Labour cost (₹)', type: 'number' }, { name: 'otherCost', label: 'Other cost (₹)', type: 'number' },
      { name: 'runHours', label: 'Run hours now', type: 'number' }, { name: 'actionTaken', label: 'What was done', required: true, wide: true }]} onSubmit={v => move('RESOLVED', v)} /></div>}
    <div className="mt-3"><div className="font-semibold">Spare parts</div>
      <Table rows={k.parts || []} empty="No parts." cols={[
        { key: 'partName', label: 'Part' }, { key: 'partNo', label: 'Part no.' }, { key: 'quantity', label: 'Qty', right: true, render: x => num(x.quantity) },
        { key: 'unitCost', label: 'Rate', right: true, render: x => rupees(x.unitCost) }, { key: 'amount', label: 'Amount', right: true, render: x => rupees(x.amount) },
        { key: 'id', label: '', render: x => open ? <button className="text-red-700" onClick={() => r.run(() => api(`${API}/tickets/${k.id}/parts/${x.id}`, { method: 'DELETE' }), () => onChanged({ id: k.id }))}>✕</button> : null },
      ]} />
      {open && <div className="mt-2"><QuickForm cols={4} busy={r.busy} submitText="Add part" fields={[
        { name: 'partName', label: 'Part', required: true }, { name: 'partNo', label: 'Part no.' }, { name: 'quantity', label: 'Quantity', type: 'number', required: true }, { name: 'unitCost', label: 'Rate (₹)', type: 'number' }]}
        onSubmit={(v, f) => r.run(() => post(`${API}/tickets/${k.id}/parts`, v), async () => { f.reset(); await onChanged({ id: k.id }); })} /></div>}
    </div>
  </Section>;
}

function Assets({ assets, asset, manager, warehouses, chambers, r, onOpen, onChanged }: any) {
  const [edit, setEdit] = useState<any>(null);
  const fields = [
    { name: 'assetCode', label: 'Code', required: true }, { name: 'assetType', label: 'Kind', type: 'select' as const, required: true, options: TYPES },
    { name: 'name', label: 'Name', required: true }, { name: 'warehouseId', label: 'Warehouse', type: 'select' as const, required: true, options: opts(warehouses) },
    { name: 'chamberId', label: 'Chamber', type: 'select' as const, options: chambers.map((c: any) => [String(c.id), `${c.warehouseName} / ${c.name}`] as [string, string]) },
    { name: 'make', label: 'Make' }, { name: 'model', label: 'Model' }, { name: 'serialNo', label: 'Serial no.' }, { name: 'capacityText', label: 'Capacity', placeholder: '40 TR, 250 kVA, 1.6 t' },
    { name: 'installedOn', label: 'Installed on', type: 'date' as const }, { name: 'warrantyTo', label: 'Warranty to', type: 'date' as const }, { name: 'runHours', label: 'Run hours', type: 'number' as const },
    { name: 'notes', label: 'Notes', wide: true }];
  return <>
    {manager && <Section title={edit ? `Change ${edit.assetCode}` : 'Add equipment'}>
      <QuickForm key={edit?.id || 'new'} cols={4} busy={r.busy} submitText="Save" initial={edit || undefined} onCancel={edit ? () => setEdit(null) : undefined} fields={fields}
        onSubmit={(v, f) => r.run(() => edit ? put(`${API}/assets/${edit.id}`, v) : post(`${API}/assets`, v), async (d: any) => { f.reset(); setEdit(null); await onChanged(d?.id); })} />
    </Section>}
    <Section title="Register">
      <Table rows={assets} selected={asset?.id} onRow={x => onOpen(x.id)} empty="No equipment yet." cols={[
        { key: 'assetCode', label: 'Code' }, { key: 'assetType', label: 'Kind', render: x => ASSET_TYPE_NAMES[x.assetType] || x.assetType }, { key: 'name', label: 'Name' },
        { key: 'warehouseName', label: 'Place', render: x => `${x.warehouseName}${x.chamberName ? ' / ' + x.chamberName : ''}` },
        { key: 'runHours', label: 'Run h', right: true, render: x => num(x.runHours, 1) }, { key: 'serviceState', label: 'Service', render: x => <span className={serviceStyle(x.serviceState)}>{serviceText(x.serviceState)}</span> },
        { key: 'openTickets', label: 'Open tickets', right: true }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status === 'DOWN' ? 'DAMAGED' : x.status === 'RETIRED' ? 'CLOSED' : 'GOOD')}>{words(x.status)}</span> },
      ]} />
    </Section>
    {asset && <Section title={`${asset.assetCode} · ${asset.name}`} right={<div className="flex gap-2">
      {manager && <button className={btnLight} onClick={() => setEdit(assets.find((a: any) => a.id === asset.id))}>Edit</button>}
      {manager && <button className={btnLight} onClick={() => r.run(() => post(`${API}/assets/${asset.id}/retire`, { retired: asset.status !== 'RETIRED' }), () => onChanged(asset.id))}>{asset.status === 'RETIRED' ? 'Back in use' : 'Retire'}</button>}
    </div>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div><div className="font-semibold">Preventive schedules</div>
          <Table rows={asset.schedules || []} empty="No schedule." cols={[
            { key: 'task', label: 'Task' }, { key: 'every', label: 'Every', render: x => everyText(x.everyHours, x.everyDays) },
            { key: 'lastDoneOn', label: 'Last done', render: x => `${day(x.lastDoneOn)}${x.lastDoneHours != null ? ' at ' + num(x.lastDoneHours) + ' h' : ''}` },
            { key: 'state', label: 'State', render: x => <span className={serviceStyle(x.state)}>{serviceText(x.state)} {x.reason || ''}</span> },
            { key: 'active', label: '', render: x => manager ? <button className={btnLight} onClick={() => r.run(() => post(`${API}/schedules/${x.id}/active`, { active: !x.active }), () => onChanged(asset.id))}>{x.active ? 'Switch off' : 'Switch on'}</button> : null },
          ]} />
          {manager && <div className="mt-2"><QuickForm cols={3} busy={r.busy} submitText="Add schedule" fields={[
            { name: 'task', label: 'Task', required: true, wide: true }, { name: 'everyHours', label: 'Every (run hours)', type: 'number' }, { name: 'everyDays', label: 'Every (days)', type: 'number' },
            { name: 'lastDoneOn', label: 'Last done on', type: 'date' }, { name: 'lastDoneHours', label: 'Last done at (hours)', type: 'number' }]}
            onSubmit={(v, f) => r.run(() => post(`${API}/assets/${asset.id}/schedules`, v), async () => { f.reset(); await onChanged(asset.id); })} /></div>}
        </div>
        <div><div className="font-semibold">Run hours</div>
          <div className="text-sm">Now {num(asset.runHours, 1)} h</div>
          <div className="mt-2"><QuickForm cols={2} busy={r.busy} submitText="Record hours" fields={[{ name: 'reading', label: 'Hour meter reading', type: 'number', required: true }]}
            onSubmit={(v, f) => r.run(() => post(`${API}/assets/${asset.id}/hours`, v), async () => { f.reset(); await onChanged(asset.id); })} /></div>
          <Table rows={(asset.hours || []).slice(0, 10)} empty="No readings." cols={[{ key: 'readAt', label: 'When', render: x => when(x.readAt) }, { key: 'reading', label: 'Hours', right: true }, { key: 'enteredBy', label: 'By' }]} />
        </div>
      </div>
      <div className="mt-3"><div className="font-semibold">Tickets</div><Table rows={asset.tickets || []} empty="No tickets." cols={[
        { key: 'ticketNo', label: 'Ticket' }, { key: 'title', label: 'Title' }, { key: 'reportedAt', label: 'Reported', render: x => when(x.reportedAt) },
        { key: 'downtimeMinutes', label: 'Down', render: x => downtime(x.downtimeMinutes) }, { key: 'totalCost', label: 'Cost', right: true, render: x => rupees(x.totalCost) }, { key: 'status', label: 'Status', render: x => words(x.status) }]} /></div>
    </Section>}
  </>;
}

function Costs({ warehouseId, r }: any) {
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const [rows, setRows] = useState<any[]>([]);
  const load = () => r.run(() => api(`${API}/costs?warehouseId=${warehouseId}&from=${f.from}&to=${f.to}`), (d: any) => setRows(d.rows || []));
  useEffect(() => { void load(); }, [warehouseId]);
  return <Section title="Downtime and cost per equipment">
    <div className="mb-3 grid gap-2 md:grid-cols-3">
      <input className={input} type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
      <input className={input} type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
      <button className={btn} onClick={load}>Show</button>
    </div>
    <Table rows={rows} empty="No tickets in the period." cols={[
      { key: 'assetCode', label: 'Equipment', render: x => `${x.assetCode} · ${x.name}` }, { key: 'warehouseName', label: 'Warehouse' },
      { key: 'tickets', label: 'Tickets', right: true }, { key: 'breakdowns', label: 'Breakdowns', right: true },
      { key: 'downtimeMinutes', label: 'Downtime', render: x => downtime(x.downtimeMinutes) }, { key: 'partsCost', label: 'Parts', right: true, render: x => rupees(x.partsCost) },
      { key: 'totalCost', label: 'Total', right: true, render: x => rupees(x.totalCost) },
    ]} />
  </Section>;
}
