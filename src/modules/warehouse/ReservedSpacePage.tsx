/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-018 -- reserved space and seasonal capacity contracts. A Manager reserves pallet positions in a chamber for
//   a partner for a season. The empty part of a reservation is held back from other partners (putaway refuses it),
//   shows on the occupancy board, and is billed as committed storage even when empty. The forecast shows the free
//   positions per chamber for the coming weeks.
//
// Backend: ReservedSpaceController (/api/warehouse/capacity/**), script 84.
import { useCallback, useEffect, useState } from 'react';
import { Warehouse } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btnLight, btnRed, input, num, pill, when, who } from './wms';
import { StaffOnly, Table, Tabs, monthStart, opts, post, today, usePartners, useRunner, useWarehouses } from './wmsOps';
import { CAPACITY_SCRIPT, freeStyle, maxCommitted, occupancyBar } from './capacityKitEcom';

export function ReservedSpacePage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [tab, setTab] = useState('occupancy');
  const [warehouseId, setWarehouseId] = useState('');
  const [ready, setReady] = useState<boolean | null>(null);
  const [manager, setManager] = useState(false);
  const [occ, setOcc] = useState<any>(null);
  const [fc, setFc] = useState<any>(null);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [chambers, setChambers] = useState<any[]>([]);
  const [committed, setCommitted] = useState<any>(null);
  const wq = warehouseId ? `warehouseId=${warehouseId}` : '';

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/warehouse/capacity/reservations?status=${status}&${wq}`);
      setReady(d.ready !== false); setManager(!!d.manager); setList(d.reservations || []);
      if (d.ready === false) return;
      const o = await api(`/api/warehouse/capacity/occupancy?${wq}`); setOcc(o); setChambers(o.chambers || []);
      setFc(await api(`/api/warehouse/capacity/forecast?${wq}`));
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [status, wq]);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/capacity/reservations/${id}`)); if (d) setSel(d); };
  const changed = async (d: any) => { setSel(d); await load(); };
  if (!me.staff) return <StaffOnly title="Reserved Space" />;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Warehouse className="h-8 w-8 text-sky-700" />Reserved Space</h1>
    <p className="text-slate-600">Pallet positions held for a partner for a season: kept free for them, shown on the occupancy board, billed as committed even when empty.</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={CAPACITY_SCRIPT} />}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <select className={`${input} max-w-xs`} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
        <option value="">All warehouses</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <button className={btnLight} onClick={() => void load()}>Refresh</button>
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[['occupancy', 'Occupancy'], ['forecast', 'Forecast'], ['reservations', 'Reservations'], ['committed', 'Committed charge']]} />

    {tab === 'occupancy' && occ && <Section title={`Occupancy today (${occ.asOf || ''})`} right={<span className="text-sm text-slate-600">
      {num(occ.used)} used · {num(occ.reservedEmpty)} reserved but empty · <b>{num(occ.freeForAnyone)}</b> free of {num(occ.positions)}</span>}>
      <div className="grid gap-3 md:grid-cols-2">{(occ.chambers || []).map((c: any) => {
        const b = occupancyBar(Number(c.positions), Number(c.used), Number(c.reservedEmpty));
        return <div key={c.id} className="rounded-xl border p-3">
          <div className="flex justify-between font-semibold"><span>{c.name} <span className="text-slate-500">{c.chamberCode}</span></span><span>{c.warehouseName}</span></div>
          <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-slate-100" title="stored / reserved but empty / free">
            <div className="bg-sky-600" style={{ width: `${b.used}%` }} /><div className="bg-amber-400" style={{ width: `${b.held}%` }} /><div className="bg-emerald-300" style={{ width: `${b.free}%` }} />
          </div>
          <div className="mt-1 text-sm">{num(c.used)} stored · {num(c.reserved)} reserved ({num(c.reservedEmpty)} empty) · <b>{num(c.freeForAnyone)}</b> free of {num(c.positions)}
            {b.over && <b className="ml-1 text-red-700">over capacity</b>}</div>
          {(c.reservations || []).length > 0 && <ul className="mt-1 text-sm text-slate-600">{c.reservations.map((x: any) =>
            <li key={x.id}>{x.reservationNo} · {x.partnerName}: {x.usedNow} of {x.positions} used{x.season ? ` · ${x.season}` : ''} · until {x.validTo}</li>)}</ul>}
        </div>;
      })}</div>
      {!(occ.chambers || []).length && <div className="text-slate-500">No chambers.</div>}
    </Section>}

    {tab === 'forecast' && fc && <Section title="Free positions per week">
      <p className="mb-2 text-sm text-slate-600">{fc.note}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-100"><tr><th className="px-2 py-2 text-left">Chamber</th><th className="px-2 py-2 text-right">Positions</th>
          {(fc.weekStarts || []).map((w: string) => <th key={w} className="px-2 py-2 text-right">{w.slice(5)}</th>)}</tr></thead>
        <tbody>{(fc.chambers || []).map((c: any) => <tr key={c.chamberId} className="border-t">
          <td className="px-2 py-2">{c.name} <span className="text-slate-500">{c.warehouseName}</span></td><td className="px-2 py-2 text-right">{c.positions}</td>
          {c.weeks.map((w: any) => <td key={w.weekStart} className={`px-2 py-2 text-right ${freeStyle(w.free, c.positions)}`} title={`${w.taken} taken, ${w.reserved} reserved`}>{w.free}</td>)}
        </tr>)}</tbody>
      </table></div>
    </Section>}

    {tab === 'reservations' && <>
      {manager && <Section title="Reserve space for a partner">
        <QuickForm cols={4} busy={r.busy} submitText="Reserve" fields={[
          { name: 'partnerId', label: 'Partner', type: 'select', options: opts(partners), required: true },
          { name: 'chamberId', label: 'Chamber', type: 'select', options: opts(chambers, c => `${c.warehouseName} · ${c.name} (${c.freeForAnyone} free)`), required: true },
          { name: 'positions', label: 'Pallet positions', type: 'number', required: true },
          { name: 'season', label: 'Season', placeholder: 'Mango 2027' },
          { name: 'validFrom', label: 'From', type: 'date', required: true }, { name: 'validTo', label: 'To', type: 'date', required: true },
          { name: 'ratePerPositionDay', label: 'Rate per position per day (empty: storage tariff)', type: 'number' },
          { name: 'notes', label: 'Notes', wide: true }]}
          onSubmit={(v, f) => r.run(() => post('/api/warehouse/capacity/reservations', v), async (d: any) => { f.reset(); await changed(d); })} />
      </Section>}
      <Section title="Reservations" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
        {[['OPEN', 'Current and upcoming'], ['CURRENT', 'Current'], ['UPCOMING', 'Upcoming'], ['ENDED', 'Ended'], ['CANCELLED', 'Cancelled'], ['', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
        <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
          { key: 'reservationNo', label: 'Reservation' }, { key: 'partnerName', label: 'Partner' }, { key: 'chamberName', label: 'Chamber', render: x => `${x.warehouseName} · ${x.chamberName}` },
          { key: 'positions', label: 'Positions', right: true }, { key: 'usedNow', label: 'Used now', right: true },
          { key: 'validFrom', label: 'Season', render: x => `${x.season ? x.season + ': ' : ''}${x.validFrom} → ${x.validTo}` },
          { key: 'ratePerPositionDay', label: 'Rate / day', right: true, render: x => x.ratePerPositionDay != null ? num(x.ratePerPositionDay, 2) : 'tariff' },
          { key: 'status', label: 'Status', render: x => <span className={pill(x.status === 'CURRENT' ? 'RUNNING' : x.status)}>{x.status}</span> },
        ]} />
      </Section>
      {sel && <Section title={<>{sel.reservationNo} · {sel.partnerName} <span className={pill(sel.status === 'CURRENT' ? 'RUNNING' : sel.status)}>{sel.status}</span></>}
        right={manager && sel.storedStatus === 'ACTIVE' && <div className="flex gap-2">
          {sel.status !== 'ENDED' && <button className={btnLight} onClick={() => { const on = window.prompt('Last day of the reservation (yyyy-mm-dd)', today()); if (on) void r.run(() => post(`/api/warehouse/capacity/reservations/${sel.id}/end`, { on }), changed); }}>End early</button>}
          <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the reservation cancelled?'); if (reason) void r.run(() => post(`/api/warehouse/capacity/reservations/${sel.id}/cancel`, { reason }), changed); }}>Cancel</button>
        </div>}>
        <div className="grid gap-1 text-sm md:grid-cols-3">
          <div>{sel.warehouseName} · {sel.chamberName}</div><div>{sel.positions} positions · {sel.days} days · {sel.validFrom} → {sel.validTo}</div>
          <div>{sel.ratePerPositionDay != null ? `At most ₹ ${num(maxCommitted(Number(sel.positions), sel.validFrom, sel.validTo, Number(sel.ratePerPositionDay)), 2)} if it stays empty` : 'Billed at the storage tariff pallet-day rate'}</div>
          <div>By {sel.createdByName} {when(sel.createdAt)}</div><div>{sel.notes || ''}</div><div>{sel.cancelledReason ? `Cancelled: ${sel.cancelledReason}` : ''}</div>
        </div>
        <div className="mt-3 font-semibold">Use per day (last 31 days)</div>
        <Table rows={sel.usage || []} empty="The season has not started." cols={[{ key: 'day', label: 'Day' }, { key: 'pallets', label: 'Pallets stored', right: true }, { key: 'empty', label: 'Empty (committed)', right: true }]} />
      </Section>}
    </>}

    {tab === 'committed' && <Section title="Committed charge of a period (preview, no bill)">
      <QuickForm cols={4} busy={r.busy} submitText="Show" initial={{ from: monthStart(), to: today() }} fields={[
        { name: 'partnerId', label: 'Partner', type: 'select', options: opts(partners), required: true },
        { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
        { name: 'from', label: 'From', type: 'date' }, { name: 'to', label: 'To', type: 'date' }]}
        onSubmit={v => r.run(() => api(`/api/warehouse/capacity/committed?partnerId=${v.partnerId}&warehouseId=${v.warehouseId}&from=${v.from || ''}&to=${v.to || ''}`), (d: any) => setCommitted(d))} />
      {committed && <div className="mt-3">
        <Table rows={committed.lines || []} empty="Nothing committed: no empty reserved positions in the period." cols={[
          { key: 'reference', label: 'Reservation' }, { key: 'description', label: 'Description' }, { key: 'quantity', label: 'Pallet-days', right: true },
          { key: 'rate', label: 'Rate', right: true, render: x => num(x.rate, 2) }, { key: 'amount', label: 'Amount', right: true, render: x => num(x.amount, 2) }]} />
        <div className="mt-2 text-right font-bold">Total ₹ {num(committed.amount, 2)}</div>
        {(committed.warnings || []).map((w: string) => <div key={w} className="text-amber-700">{w}</div>)}
        <p className="text-sm text-slate-600">{committed.note}. The storage bill (Warehouse › Storage Billing) adds these lines itself.</p>
      </div>}
    </Section>}
  </>;
}
