/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-013 -- Home Delivery: chilled and frozen orders of quick-commerce apps and brands delivered to homes in a
// promised time slot.
//   Orders: orders come in through the Open API (/api/v1/home-orders) or are entered here; each gets a 6-digit
//     delivery code and a tracking link for the customer (shown once, with a WhatsApp link to send them). Tick new
//     orders and plan a route: the drops are put in order by slot and distance with an expected time each.
//   At the door: delivered with the customer's code (a Manager may deliver without it, with a reason), or failed
//     with a reason; a failed order is tried again on a new route or returned to the warehouse as a warehouse
//     return (REQ-WMS-013) that is graded on Warehouse > Returns.
//   Routes: the day's routes; send a planned route out, close it when no drop is left.
// Staff only. Backend: /api/dispatch/home-delivery (HomeDeliveryController). Customer page: /track/order/:token.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input } from '@/shared/components/FormKit';
import { at, notReady, opts, qs, send, temp, who, words } from '@/modules/coldchain/records/records';
import { Pill, Tabs, Tiles } from '@/modules/coldchain/records/ui';
import { SCRIPT96 } from '../schedule/schedule';
import { HD, fullLink, lateRisk, orderActions, parseLines, plannable, slotText } from './homeDelivery';

export function HomeDeliveryPage() {
  const me = who();
  const [tab, setTab] = useState('ORDERS');
  const [o, setO] = useState<any>(null), [data, setData] = useState<any>(null), [open, setOpen] = useState<any>(null);
  const [filter, setFilter] = useState<{ status: string; day: string; q: string; routeId: string }>({ status: '', day: '', q: '', routeId: '' }), [ticked, setTicked] = useState<number[]>([]);
  const [form, setForm] = useState<any>(null), [made, setMade] = useState<any>(null), [act, setAct] = useState<{ kind: string; order: any } | null>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);

  useEffect(() => { api(`${HD}/options`).then(setO).catch(e => setErr(errorText(e, 'The options could not be read.'))); }, []);
  useEffect(() => {
    if (!o?.ready) return;
    setData(null);
    const fail = (e: unknown) => setErr(errorText(e, 'The list could not be read.'));
    if (tab === 'ORDERS') api(`${HD}/orders${qs(filter)}`).then(setData).catch(fail);
    if (tab === 'ROUTES') api(`${HD}/routes${qs({ day: filter.day })}`).then(setData).catch(fail);
  }, [o, tab, reload, filter]);
  useEffect(() => { setForm(null); setOpen(null); setAct(null); setTicked([]); }, [tab]);

  if (notReady(o)) return <><h1 className="text-3xl font-bold">Home Delivery</h1><NotReady script={o.script || SCRIPT96} /></>;

  async function run(fn: () => Promise<any>, after?: (x: any) => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(x); setReload(r => r + 1); if (open?.id) openOrder(open.id); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const openOrder = (id: number) => api(`${HD}/orders/${id}`).then(setOpen).catch(e => setErr(errorText(e, 'The order could not be read.')));
  const partners: [number, string][] = (o?.partners || []).map((p: any) => [p.id, p.name]);
  const warehouses: [number, string][] = (o?.warehouses || []).map((w: any) => [w.id, w.name]);
  const vehicles: [number, string][] = (o?.vehicles || []).map((v: any) => [v.id, v.number]);
  const rows: any[] = Array.isArray(data) ? data : [];
  const toPlan = plannable(rows, ticked);

  function action(kind: string, order: any) {
    if (kind === 'CANCEL') { const r = window.prompt(`Cancel order ${order.orderNo}? Reason:`); if (r) void run(() => send(`${HD}/orders/${order.id}/cancel`, { reason: r })); return; }
    if (kind === 'RESEND') { if (window.confirm('Make a new delivery code and tracking link? The old ones stop working.')) void run(() => send(`${HD}/orders/${order.id}/resend`), x => setMade(x)); return; }
    setAct({ kind, order });
  }

  return <>
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Home />Home Delivery</h1>
      <p className="text-slate-600">Chilled and frozen orders of quick-commerce apps and brands, delivered to homes in a promised slot with a delivery code and a tracking link for the customer.</p>
    </div>
    <Banner msg={msg} error={err} />
    {made && <div className="my-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="font-bold">Give these to the customer now; they are not shown again.</div>
      <div>Delivery code: <span className="font-mono text-lg font-bold">{made.deliveryCode}</span></div>
      <div>Tracking link: <a className="break-all text-sky-700 hover:underline" href={fullLink(made.trackingUrl)} target="_blank" rel="noreferrer">{fullLink(made.trackingUrl)}</a></div>
      {made.whatsappUrl && <a className="font-semibold text-emerald-700 hover:underline" href={made.whatsappUrl} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
      <div><button className={btnLight} onClick={() => setMade(null)}>Done</button></div>
    </div>}
    <Tabs value={tab} onChange={setTab} tabs={[['ORDERS', 'Orders'], ['ROUTES', 'Routes']]} />

    <div className="mt-3 flex flex-wrap items-end gap-2">
      {tab === 'ORDERS' && <select className={`${input} w-48`} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} aria-label="Status">
        <option value="">All statuses</option>{(o?.statuses || []).map((s: string) => <option key={s} value={s}>{words(s)}</option>)}</select>}
      <input className={`${input} w-44`} type="date" value={filter.day} onChange={e => setFilter({ ...filter, day: e.target.value })} aria-label="Day" />
      {tab === 'ORDERS' && <input className={`${input} w-56`} placeholder="Order, customer or phone" value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} />}
      {tab === 'ORDERS' && filter.routeId && <button className={btnLight} onClick={() => setFilter({ ...filter, routeId: '' })}>Show all routes</button>}
      {tab === 'ORDERS' && <button className={btn} onClick={() => setForm(form?.kind === 'ORDER' ? null : { kind: 'ORDER' })}>{form?.kind === 'ORDER' ? 'Cancel' : 'New order'}</button>}
      {tab === 'ORDERS' && <button className={btnLight} disabled={!toPlan.length} onClick={() => setForm({ kind: 'ROUTE' })}>Plan a route ({toPlan.length})</button>}
    </div>

    {form?.kind === 'ORDER' && <Section title="New order">
      <QuickForm cols={4} busy={busy} submitText="Save order" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${HD}/orders`, { ...v, lines: parseLines(v.linesText as string), linesText: undefined }), x => { setForm(null); setMade(x); })} fields={[
        { name: 'partnerId', label: 'Brand or app', type: 'select', options: partners, required: true }, { name: 'externalRef', label: 'Order number of the app' }, { name: 'channel', label: 'Channel' },
        { name: 'warehouseId', label: 'Dispatched from', type: 'select', options: warehouses },
        { name: 'customerName', label: 'Customer', required: true }, { name: 'customerPhone', label: 'Customer phone', required: true }, { name: 'pincode', label: 'Pincode', required: true }, { name: 'city', label: 'City' },
        { name: 'address', label: 'Address', type: 'textarea', wide: true, required: true },
        { name: 'slotStart', label: 'Slot from (YYYY-MM-DD HH:MM)', required: true }, { name: 'slotEnd', label: 'Slot to', required: true },
        { name: 'tempClass', label: 'Temperature class', type: 'select', options: opts(o?.tempClasses || []) }, { name: 'items', label: 'Items', type: 'number' },
        { name: 'weightKg', label: 'Weight (kg)', type: 'number' }, { name: 'codAmount', label: 'Cash to collect (Rs)', type: 'number' }, { name: 'latitude', label: 'Latitude', type: 'number' }, { name: 'longitude', label: 'Longitude', type: 'number' },
        { name: 'linesText', label: 'Lines: one per row "SKU, description, quantity, batch, expiry YYYY-MM-DD"', type: 'textarea', wide: true },
        { name: 'notes', label: 'Notes', wide: true },
      ]} />
      <p className="mt-1 text-xs text-slate-500">The slot may be at most {o?.maxSlotHours} hours long.</p>
    </Section>}

    {form?.kind === 'ROUTE' && <Section title={`Plan a route with ${toPlan.length} order(s)`}>
      <QuickForm cols={4} busy={busy} submitText="Plan route" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${HD}/routes`, { ...v, orderIds: toPlan }), () => { setForm(null); setTicked([]); })} fields={[
        { name: 'warehouseId', label: 'Starts from', type: 'select', options: warehouses, required: true }, { name: 'vehicleId', label: 'Vehicle', type: 'select', options: vehicles },
        { name: 'tripNumber', label: 'Trip number (optional)' }, { name: 'startAt', label: 'Starts at (blank: 30 min before the first slot)' },
        { name: 'riderName', label: 'Rider' }, { name: 'riderPhone', label: 'Rider phone' },
      ]} />
    </Section>}

    {act && <Section title={`${words(act.kind)}: ${act.order.orderNo}`} right={<button className={btnLight} onClick={() => setAct(null)}>Close</button>}>
      {act.kind === 'DELIVER' && <QuickForm cols={3} busy={busy} submitText="Delivered" onSubmit={v => run(() => send(`${HD}/orders/${act.order.id}/deliver`, v), x => { if (x?.delivered) setAct(null); })} fields={[
        { name: 'code', label: 'Delivery code from the customer' }, { name: 'temperatureC', label: 'Temperature at the door', type: 'number', unit: 'temp' }, { name: 'deliveredAt', label: 'Delivered at (blank: now)' },
        ...(me.manager ? [{ name: 'noCodeReason', label: 'Manager: deliver without the code, because', wide: true }] : []),
      ]} />}
      {act.kind === 'FAIL' && <QuickForm cols={2} busy={busy} submitText="Not delivered" onSubmit={v => run(() => send(`${HD}/orders/${act.order.id}/fail`, v), () => setAct(null))} fields={[
        { name: 'reason', label: 'Why', type: 'select', options: opts(o?.failureReasons || []), required: true }, { name: 'note', label: 'Note (needed for Other)' },
      ]} />}
      {act.kind === 'RETRY' && <QuickForm cols={2} busy={busy} submitText="Try again" onSubmit={v => run(() => send(`${HD}/orders/${act.order.id}/retry`, v), () => setAct(null))} fields={[
        { name: 'slotStart', label: 'New slot from (blank: keep)' }, { name: 'slotEnd', label: 'New slot to' },
      ]} />}
      {act.kind === 'RETURN' && <QuickForm cols={2} busy={busy} submitText="Return to the warehouse" onSubmit={v => run(() => send(`${HD}/orders/${act.order.id}/return`, v), () => setAct(null))} fields={[
        { name: 'warehouseId', label: 'Warehouse (blank: the one it came from)', type: 'select', options: warehouses },
      ]} />}
    </Section>}

    {tab === 'ORDERS' && <>
      <Tiles items={[['Orders', rows.length], ['New', rows.filter(r => r.status === 'RECEIVED').length], ['Out', rows.filter(r => r.status === 'OUT_FOR_DELIVERY').length],
        ['Delivered', rows.filter(r => r.status === 'DELIVERED').length], ['Failed', rows.filter(r => r.status === 'FAILED').length, rows.some(r => r.status === 'FAILED') ? 'FAIL' : undefined],
        ['Slot at risk', rows.filter(r => r.atRisk || lateRisk(r)).length, rows.some(r => r.atRisk || lateRisk(r)) ? 'AT_RISK' : undefined]]} />
      <Section title="Orders">
        {!data ? <p className="text-slate-500">Loading...</p> : !rows.length ? <p className="text-slate-500">No order.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2" /><th>Order</th><th>Customer</th><th>Slot</th><th>Class</th><th>Route</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.id} className="border-t align-top">
            <td className="p-2">{r.status === 'RECEIVED' && <input type="checkbox" aria-label={`Tick ${r.orderNo}`} checked={ticked.includes(r.id)} onChange={e => setTicked(e.target.checked ? [...ticked, r.id] : ticked.filter(x => x !== r.id))} />}</td>
            <td><button className="font-semibold text-sky-700 hover:underline" onClick={() => openOrder(r.id)}>{r.orderNo}</button><div className="text-xs text-slate-500">{r.partnerName}{r.externalRef ? ` · ${r.externalRef}` : ''}</div></td>
            <td>{r.customerName}<div className="text-xs text-slate-500">{r.pincode} · {r.city || ''}</div></td>
            <td>{slotText(r.slotStart, r.slotEnd)}{r.etaAt ? <div className="text-xs">Expected {at(r.etaAt)}</div> : null}{(r.atRisk || lateRisk(r)) && <div><Pill state="AT_RISK" text="Slot at risk" /></div>}</td>
            <td>{words(r.tempClass)}</td><td>{r.routeNo ? `${r.routeNo} #${r.stopSeq}` : '-'}</td>
            <td><Pill state={r.status === 'DELIVERED' ? 'OK' : r.status === 'FAILED' ? 'FAIL' : r.status} text={words(r.status)} />{r.slotResult ? <div className="text-xs">{words(r.slotResult)}</div> : null}
              {r.returnNo ? <div className="text-xs"><Link className="text-sky-700 hover:underline" to="/warehouse/returns">{r.returnNo}</Link></div> : null}</td>
            <td className="space-x-1 space-y-1">{orderActions(r.status).map(k => <button key={k} className={k === 'CANCEL' ? btnRed : btnLight} disabled={busy} onClick={() => action(k, r)}>{words(k)}</button>)}</td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {open && <Section title={`Order ${open.orderNo}`} right={<button className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
      <div className="grid gap-2 text-sm md:grid-cols-3">
        <div>{open.customerName} · {open.customerPhone}<div className="text-slate-600">{open.address}, {open.city} {open.pincode}</div></div>
        <div>Slot {slotText(open.slotStart, open.slotEnd)}<div>{open.items || '-'} items, {open.weightKg ?? '-'} kg{open.codAmount ? `, collect Rs ${open.codAmount}` : ''}</div></div>
        <div>{open.deliveredAt ? <>Delivered {at(open.deliveredAt)} by {open.deliveredByName}, {temp(open.deliveredTempC)}</> : open.failureReason ? <>Failed: {words(open.failureReason)} {open.failureNote || ''}</> : <Pill state={open.status} />}
          <div className="text-xs text-slate-500">Wrong codes: {open.codeAttempts} · Tracking page opened {open.trackOpened} time(s)</div></div>
      </div>
      {!!open.lines?.length && <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">SKU</th><th>Item</th><th>Quantity</th><th>Batch</th><th>Expiry</th></tr></thead>
        <tbody>{open.lines.map((l: any) => <tr key={l.id} className="border-t"><td className="p-2">{l.sku || '-'}</td><td>{l.description}</td><td>{l.quantity}</td><td>{l.batchNo || '-'}</td><td>{l.expiryDate || '-'}</td></tr>)}</tbody></table>}
      <h3 className="mt-3 font-semibold">History</h3>
      <ul className="text-sm">{(open.events || []).map((e: any, i: number) => <li key={i}>{at(e.at)} · <b>{words(e.status)}</b> · {e.note || ''} <span className="text-slate-500">({e.byName})</span></li>)}</ul>
    </Section>}

    {tab === 'ROUTES' && <Section title="Routes">
      {!data ? <p className="text-slate-500">Loading...</p> : !rows.length ? <p className="text-slate-500">No route. Tick new orders on the Orders tab and plan a route.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">Route</th><th>Date</th><th>From</th><th>Vehicle / rider</th><th>Starts</th><th>Drops</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-t align-top">
          <td className="p-2 font-semibold"><button className="text-sky-700 hover:underline" onClick={() => { setTab('ORDERS'); setTimeout(() => setFilter(f => ({ ...f, routeId: String(r.id), day: '' })), 0); }}>{r.routeNo}</button></td>
          <td>{r.routeDate}</td><td>{r.warehouseName}</td><td>{r.vehicleNumber || '-'}{r.tripNumber ? ` · ${r.tripNumber}` : ''}<div className="text-xs">{r.riderName || ''} {r.riderPhone || ''}</div></td>
          <td>{at(r.startAt)}</td><td>{r.drops} drops · {r.delivered} delivered · {r.failed} failed{r.late ? <div className="text-xs text-red-700">{r.late} late</div> : null}</td>
          <td><Pill state={r.status === 'CLOSED' ? 'DONE' : r.status === 'OUT' ? 'RUNNING' : r.status} text={words(r.status)} /></td>
          <td>{r.status === 'PLANNED' && <button className={btnLight} disabled={busy} onClick={() => run(() => send(`${HD}/routes/${r.id}/status`, { status: 'OUT' }))}>Send out</button>}
            {r.status === 'OUT' && <button className={btnLight} disabled={busy} onClick={() => run(() => send(`${HD}/routes/${r.id}/status`, { status: 'CLOSED' }))}>Close</button>}</td></tr>)}</tbody></table></div>}
    </Section>}
  </>;
}
