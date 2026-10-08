/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-012 -- Scheduled Routes: fixed reefer departures on set days (for example Delhi to Mumbai every Tuesday and
// Friday at 20:00) that brands book space on per consignment.
//   Departures: the coming departures with the space left; open one to see its bookings, book a consignment (the
//     price is shown first, with the ODA charge when the pincode is outside the served area), move a booking
//     through its stages, record the transfer at a hub, link a trip to each leg, and (Manager) close or cancel it.
//   Bookings: every booking; open its temperature record across the legs and the hub transfers.
//   Routes (Manager edits): the route, its days, time, cut-off, capacity, rates, hubs and served pincodes.
// Staff only. Backend: /api/dispatch/scheduled-routes (ScheduledRouteController). Brands book through the Open API
// (/api/v1/scheduled-departures, /api/v1/scheduled-bookings). Needs database_v2/96.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText } from '@/shared/components/FormKit';
import { at, day, notReady, opts, send, temp, who, words } from '@/modules/coldchain/records/records';
import { Pill, ReadingsLine, Tabs, Tiles } from '@/modules/coldchain/records/ui';
import { SCRIPT96, SR, WEEK_DAYS, canCancel, daysText, departureState, hubsText, nextMoves, quoteLines, routeBody, rupees } from './schedule';

export function ScheduledRoutesPage() {
  const me = who();
  const [tab, setTab] = useState('DEPARTURES');
  const [o, setO] = useState<any>(null), [data, setData] = useState<any>(null), [open, setOpen] = useState<any>(null);
  const [form, setForm] = useState<any>(null), [quote, setQuote] = useState<any>(null), [record, setRecord] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);

  useEffect(() => { api(`${SR}/options`).then(setO).catch(e => setErr(errorText(e, 'The options could not be read.'))); }, []);
  useEffect(() => {
    if (!o?.ready) return;
    setData(null);
    const fail = (e: unknown) => setErr(errorText(e, 'The list could not be read.'));
    if (tab === 'DEPARTURES') api(`${SR}/departures`).then(setData).catch(fail);
    if (tab === 'BOOKINGS') api(`${SR}/bookings`).then(setData).catch(fail);
    if (tab === 'ROUTES') api(`${SR}/routes`).then(setData).catch(fail);
  }, [o, tab, reload]);
  useEffect(() => {
    if (open?.id) api(`${SR}/departures/${open.id}`).then(setOpen).catch(e => setErr(errorText(e, 'The departure could not be read.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);
  useEffect(() => { setForm(null); setOpen(null); setQuote(null); setRecord(null); }, [tab]);

  if (notReady(o)) return <><h1 className="text-3xl font-bold">Scheduled Routes</h1><NotReady script={o.script || SCRIPT96} /></>;

  async function run(fn: () => Promise<any>, after?: (x: any) => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(x); setReload(r => r + 1); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const openDeparture = (id: number) => api(`${SR}/departures/${id}`).then(d => { setOpen(d); setQuote(null); setForm(null); }).catch(e => setErr(errorText(e, 'The departure could not be read.')));
  const openRecord = (id: number) => api(`${SR}/bookings/${id}/temperature`).then(setRecord).catch(e => setErr(errorText(e, 'The temperature record could not be read.')));
  const partners: [number, string][] = (o?.partners || []).map((p: any) => [p.id, p.name]);
  const askMove = (k: any, to: string) => run(() => send(`${SR}/bookings/${k.id}/status`, { status: to, note: to === 'BOOKED' ? window.prompt('Why does it go back to booked?') || '' : '' }));
  const cancel = (k: any) => { const r = window.prompt(`Cancel booking ${k.bookingNo}? Reason:`); if (r) void run(() => send(`${SR}/bookings/${k.id}/cancel`, { reason: r })); };
  const depStatus = (d: any, s: string) => { const n = window.prompt(`Set this departure to ${words(s)}. Note (optional):`, ''); if (n !== null) void run(() => send(`${SR}/departures/${d.id}/status`, { status: s, note: n })); };
  const linkTrip = (d: any, legNo: number) => { const n = window.prompt(`Trip number for leg ${legNo} (blank to unlink):`, ''); if (n !== null) void run(() => send(`${SR}/departures/${d.id}/legs/${legNo}/trip`, { tripNumber: n })); };

  return <>
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarClock />Scheduled Routes</h1>
      <p className="text-slate-600">Fixed reefer departures on set days, booked per consignment by pallet or by kg, with transfers at the hubs and one temperature record per booking.</p>
    </div>
    <Banner msg={msg} error={err} />
    <Tabs value={tab} onChange={setTab} tabs={[['DEPARTURES', 'Departures'], ['BOOKINGS', 'Bookings'], ['ROUTES', 'Routes']]} />

    {tab === 'DEPARTURES' && !open && <>
      <Tiles items={[['Departures', data?.length ?? '-'], ['Open', (data || []).filter((d: any) => d.status === 'OPEN').length],
        ['Full', (data || []).filter((d: any) => departureState(d) === 'FULL').length], ['Days shown', o?.horizonDays ?? '-']]} />
      <Section title="Coming departures">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.length ? <p className="text-slate-500">No departure in the coming days. Add a route on the Routes tab.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Departs</th><th>Route</th><th>Class</th><th>Cut-off</th><th>Arrives</th><th>Space left</th><th>Bookings</th><th>Legs</th><th>State</th></tr></thead>
          <tbody>{data.map((d: any) => <tr key={d.id} className="border-t align-top">
            <td className="p-2"><button className="font-semibold text-sky-700 hover:underline" onClick={() => openDeparture(d.id)}>{at(d.departsAt)}</button></td>
            <td>{d.routeCode}<div className="text-xs text-slate-500">{d.originCity} to {d.destinationCity}</div></td><td>{words(d.tempClass)}<div className="text-xs text-slate-500">{temp(d.tempMinC)} to {temp(d.tempMaxC)}</div></td>
            <td>{at(d.cutoffAt)}</td><td>{at(d.arrivesAt)}</td>
            <td>{d.palletsLeft} pallets · {d.kgLeft} kg<div className="mt-1 h-1.5 w-28 rounded bg-slate-200"><div className="h-1.5 rounded bg-sky-600" style={{ width: `${Math.min(100, Number(d.percentUsed) || 0)}%` }} /></div></td>
            <td>{d.bookings}</td><td className="text-xs">{(d.legs || []).map((l: any) => <div key={l.legNo}>{l.fromCity}-{l.toCity}: {l.tripNumber || 'no trip'}</div>)}</td>
            <td><Pill state={departureState(d)} /></td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'DEPARTURES' && open && <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={btnLight} onClick={() => setOpen(null)}>Back to departures</button>
        {open.status === 'OPEN' && <button className={btn} onClick={() => { setForm(form ? null : {}); setQuote(null); }}>{form ? 'Cancel' : 'Book a consignment'}</button>}
        {me.manager && ['OPEN', 'CLOSED', 'DEPARTED', 'ARRIVED'].filter(s => s !== open.status).map(s => <button key={s} className={btnLight} disabled={busy} onClick={() => depStatus(open, s)}>Set {words(s)}</button>)}
        {me.manager && open.status !== 'CANCELLED' && <button className={btnRed} disabled={busy} onClick={() => depStatus(open, 'CANCELLED')}>Cancel departure</button>}
      </div>
      <Section title={`${open.routeCode} · ${at(open.departsAt)}`} right={<Pill state={departureState(open)} />}>
        <div className="grid gap-2 text-sm md:grid-cols-4">
          <div>{open.originCity} to {open.destinationCity}<div className="text-slate-500">{words(open.tempClass)}, {temp(open.tempMinC)} to {temp(open.tempMaxC)}</div></div>
          <div>Cut-off {at(open.cutoffAt)}<div className="text-slate-500">Arrives {at(open.arrivesAt)}</div></div>
          <div>{open.palletsLeft} of {open.capacityPallets} pallets left<div className="text-slate-500">{open.kgLeft} of {open.capacityKg} kg left</div></div>
          <div>{open.statusNote || ''}</div>
        </div>
        <h3 className="mt-3 font-semibold">Legs</h3>
        <table className="w-full text-sm"><tbody>{(open.legs || []).map((l: any) => <tr key={l.legNo} className="border-t">
          <td className="p-2">Leg {l.legNo}: {l.fromCity} to {l.toCity}</td>
          <td>{l.tripId ? <Link className="text-sky-700 hover:underline" to={`/trips/${l.tripId}`}>{l.tripNumber}</Link> : 'No trip'} {l.vehicleNumber ? `(${l.vehicleNumber})` : ''} {l.tripStatus ? words(l.tripStatus) : ''}</td>
          <td>{me.staff && <button className={btnLight} disabled={busy} onClick={() => linkTrip(open, l.legNo)}>{l.tripId ? 'Change trip' : 'Link a trip'}</button>}</td></tr>)}</tbody></table>
      </Section>
      {form && <Section title="Book a consignment">
        <QuickForm cols={3} busy={busy} submitText={quote ? 'Book' : 'Show the price'} onCancel={() => { setForm(null); setQuote(null); }} initial={form}
          onSubmit={async v => {
            setForm(v);
            if (!quote) { await run(() => send(`${SR}/quote`, { ...v, departureId: open.id }), q => { setQuote(q); setMsg(''); }); return; }
            await run(() => send(`${SR}/departures/${open.id}/bookings`, v), () => { setForm(null); setQuote(null); });
          }} fields={[
            { name: 'partnerId', label: 'Brand (customer)', type: 'select', options: partners, required: true }, { name: 'pallets', label: 'Pallets', type: 'number' },
            { name: 'weightKg', label: 'Weight (kg)', type: 'number', required: true }, { name: 'pincode', label: 'Delivery pincode', required: true },
            { name: 'consigneeName', label: 'Consignee', required: true }, { name: 'consigneePhone', label: 'Consignee phone' }, { name: 'shipperRef', label: 'Shipper reference' },
            { name: 'packages', label: 'Packages', type: 'number' }, { name: 'goods', label: 'Goods' }, { name: 'deliveryAddress', label: 'Delivery address', type: 'textarea', wide: true },
          ]} />
        {quote && <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm">{quoteLines(quote).map(([k, v]) => <div key={k} className={k === 'Total' ? 'font-bold' : ''}>{k}: {v}</div>)}
          <div className="text-slate-600">Priced by {words(quote.basis)}. Space left: {quote.palletsLeft} pallets, {quote.kgLeft} kg. Change a value and press Book, or Cancel.</div></div>}
      </Section>}
      <Section title={`Bookings (${open.bookings?.length || 0})`}>
        <BookingsTable rows={open.bookings || []} busy={busy} onMove={askMove} onCancel={cancel} onRecord={openRecord} hubs={open.hubs || []}
          onTransfer={(k, b) => run(() => send(`${SR}/bookings/${k.id}/transfer`, b))} />
      </Section>
      {!!open.transfers?.length && <Section title="Hub transfers">
        <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Booking</th><th>Hub</th><th>Unloaded / loaded</th><th>Out of the reefer</th><th>Temperature out / in / dock</th><th>Result</th></tr></thead>
          <tbody>{open.transfers.map((x: any) => <tr key={x.id} className="border-t"><td className="p-2">{x.bookingNo}</td><td>{x.hubCity}</td><td>{at(x.unloadedAt)} / {at(x.loadedAt)}</td><td>{x.minutesOut} min</td>
            <td>{temp(x.tempOutC)} / {temp(x.tempInC)} / {temp(x.dockTempC)}</td><td><Pill state={x.inRange && x.withinTime ? 'OK' : 'FAIL'} text={x.inRange && x.withinTime ? 'In range' : !x.inRange ? 'Out of range' : 'Too long'} /></td></tr>)}</tbody></table>
      </Section>}
    </>}

    {tab === 'BOOKINGS' && <Section title="Bookings">
      {!data ? <p className="text-slate-500">Loading...</p> : <BookingsTable rows={data} busy={busy} onMove={askMove} onCancel={cancel} onRecord={openRecord} hubs={[]} />}
    </Section>}

    {record && <Section title={`Temperature record of ${record.booking?.bookingNo}`} right={<button className={btnLight} onClick={() => setRecord(null)}>Close</button>}>
      <p className="text-sm">Allowed {temp(record.tempMinC)} to {temp(record.tempMaxC)} · {record.readings} reading(s), {record.outOfRange} out of range · <Pill state={record.verdict} /></p>
      <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Leg</th><th>Trip</th><th>Window</th><th>Readings</th><th>Note</th></tr></thead>
        <tbody>{(record.segments || []).map((s: any) => <tr key={s.legNo} className="border-t"><td className="p-2">{s.legNo}: {s.fromCity} to {s.toCity}</td><td>{s.tripNumber || '-'}</td>
          <td>{at(s.from)} to {at(s.to)}</td><td>{s.readings?.length || 0}{s.readings?.length ? ` (${temp(Math.min(...s.readings.map((r: any) => Number(r.c))))} to ${temp(Math.max(...s.readings.map((r: any) => Number(r.c))))})` : ''}</td><td>{s.note || ''}</td></tr>)}
          {(record.transfers || []).map((x: any) => <tr key={`t${x.hubSeq}`} className="border-t bg-slate-50"><td className="p-2" colSpan={2}>Transfer at {x.hubCity}</td><td>{at(x.unloadedAt)} to {at(x.loadedAt)}</td>
            <td>{temp(x.tempOutC)} / {temp(x.tempInC)}</td><td><Pill state={x.inRange && x.withinTime ? 'OK' : 'FAIL'} text={`${x.minutesOut} min`} /></td></tr>)}</tbody></table>
      <div className="mt-3"><ReadingsLine minC={record.tempMinC} maxC={record.tempMaxC} points={(record.segments || []).flatMap((s: any) => (s.readings || []).map((r: any) => ({
        t: r.t, c: r.c, out: (record.tempMinC != null && Number(r.c) < Number(record.tempMinC)) || (record.tempMaxC != null && Number(r.c) > Number(record.tempMaxC)) })))} /></div>
    </Section>}

    {tab === 'ROUTES' && <>
      {me.manager && <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Add a route'}</button></div>}
      {form && <Section title={form.id ? `Edit ${form.code}` : 'Add a route'}><RouteForm initial={form} classes={o?.tempClasses || []} busy={busy} onCancel={() => setForm(null)}
        onSubmit={b => run(() => send(form.id ? `${SR}/routes/${form.id}` : `${SR}/routes`, b, form.id ? 'PUT' : 'POST'), () => setForm(null))} /></Section>}
      <Section title="Routes">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.length ? <p className="text-slate-500">No route yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Route</th><th>Days and time</th><th>Class</th><th>Capacity</th><th>Rates</th><th>Hubs</th><th>Served pincodes</th><th /></tr></thead>
          <tbody>{data.map((r: any) => <tr key={r.id} className={`border-t align-top ${r.active ? '' : 'text-slate-400'}`}>
            <td className="p-2 font-semibold">{r.code}<div className="text-xs font-normal">{r.name}</div><div className="text-xs font-normal text-slate-500">{r.originCity} to {r.destinationCity}</div></td>
            <td>{daysText(r.daysOfWeek)} {r.departureTime}<div className="text-xs text-slate-500">Cut-off {r.cutoffHours} h before, {r.transitHours} h transit</div></td>
            <td>{words(r.tempClass)}<div className="text-xs text-slate-500">{temp(r.tempMinC)} to {temp(r.tempMaxC)}</div></td><td>{r.capacityPallets} pallets<div className="text-xs">{r.capacityKg} kg</div></td>
            <td className="text-xs">{rupees(r.ratePerPallet)} / pallet<div>{rupees(r.ratePerKg)} / kg, min {rupees(r.minCharge)}</div><div>ODA {rupees(r.odaRatePerKg)} / kg, min {rupees(r.odaMinCharge)}</div></td>
            <td className="text-xs">{hubsText(r.hubs) || '-'}</td><td className="max-w-[10rem] text-xs">{(r.servedPincodes || []).join(', ') || 'All (no ODA)'}</td>
            <td>{me.manager && <button className={btnLight} onClick={() => setForm({ ...r, hubsText: hubsText(r.hubs), pincodesText: (r.servedPincodes || []).join(', '), ...Object.fromEntries(WEEK_DAYS.map(d => [`day${d}`, String(r.daysOfWeek || '').includes(d)])) })}>Edit</button>}</td></tr>)}</tbody></table></div>}
      </Section>
    </>}
  </>;
}

function BookingsTable({ rows, busy, hubs, onMove, onCancel, onRecord, onTransfer }: {
  rows: any[]; busy: boolean; hubs: any[]; onMove: (k: any, to: string) => void; onCancel: (k: any) => void; onRecord: (id: number) => void;
  onTransfer?: (k: any, b: Record<string, unknown>) => Promise<any>;
}) {
  const [transfer, setTransfer] = useState<any>(null);
  if (!rows.length) return <p className="text-slate-500">No booking yet.</p>;
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[1000px] text-sm">
      <thead><tr className="bg-slate-50 text-left"><th className="p-2">Booking</th><th>Departure</th><th>Brand</th><th>Consignee</th><th>Load</th><th>Price</th><th>Status</th><th>Next</th></tr></thead>
      <tbody>{rows.map(k => <tr key={k.id} className="border-t align-top">
        <td className="p-2 font-semibold">{k.bookingNo}<div className="text-xs font-normal text-slate-500">{at(k.bookedAt)} by {k.bookedByName}</div></td>
        <td>{k.routeCode}<div className="text-xs">{day(k.departureDate)}</div></td><td>{k.partnerName}{k.shipperRef ? <div className="text-xs">Ref {k.shipperRef}</div> : null}</td>
        <td>{k.consigneeName}<div className="text-xs text-slate-500">{k.pincode}{k.goods ? ` · ${k.goods}` : ''}</div></td>
        <td>{k.pallets} pallets<div className="text-xs">{k.weightKg} kg{k.packages ? `, ${k.packages} packages` : ''}</div></td>
        <td>{rupees(k.total)}{k.oda ? <div className="text-xs text-amber-700">incl. ODA {rupees(k.odaCharge)}</div> : null}</td>
        <td><Pill state={k.status} />{k.status === 'IN_TRANSIT' || k.status === 'AT_HUB' ? <div className="text-xs">Leg {k.currentLeg}</div> : null}{k.cancelReason ? <div className="max-w-[10rem] text-xs">{k.cancelReason}</div> : null}</td>
        <td className="space-x-1 space-y-1">
          {nextMoves(k.status).map(s => <button key={s} className={btnLight} disabled={busy} onClick={() => onMove(k, s)}>{words(s)}</button>)}
          {k.status === 'AT_HUB' && onTransfer && <button className={btnLight} onClick={() => setTransfer(transfer?.id === k.id ? null : k)}>Hub transfer</button>}
          {canCancel(k.status) && <button className={btnRed} disabled={busy} onClick={() => onCancel(k)}>Cancel</button>}
          <button className={btnLight} onClick={() => onRecord(k.id)}>Temperature</button>
        </td></tr>)}</tbody>
    </table>
    {transfer && onTransfer && <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <h3 className="mb-2 font-semibold">Transfer of {transfer.bookingNo} at a hub</h3>
      <QuickForm cols={4} busy={busy} submitText="Record the transfer" onCancel={() => setTransfer(null)} onSubmit={v => onTransfer(transfer, v).then(x => { if (x) setTransfer(null); })} fields={[
        { name: 'seq', label: 'Hub', type: 'select', options: hubs.map((h: any) => [h.seq, h.hubCity]), required: true },
        { name: 'unloadedAt', label: 'Unloaded at (YYYY-MM-DD HH:MM)', required: true }, { name: 'loadedAt', label: 'Loaded on the next truck at', required: true },
        { name: 'tempOutC', label: 'Temperature when unloaded', type: 'number', unit: 'temp', required: true }, { name: 'tempInC', label: 'Temperature when loaded', type: 'number', unit: 'temp', required: true },
        { name: 'dockTempC', label: 'Dock temperature', type: 'number', unit: 'temp' }, { name: 'note', label: 'Note', wide: true },
      ]} />
    </div>}
  </div>;
}

function RouteForm({ initial, classes, busy, onSubmit, onCancel }: {
  initial: any; classes: string[]; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel: () => void;
}) {
  return <QuickForm cols={4} busy={busy} submitText="Save route" initial={{ cutoffHours: 6, active: true, ...initial }} onCancel={onCancel} onSubmit={v => onSubmit(routeBody(v))} fields={[
    { name: 'code', label: 'Code', required: true, placeholder: 'DEL-MUM' }, { name: 'name', label: 'Name', required: true },
    { name: 'originCity', label: 'From city', required: true }, { name: 'destinationCity', label: 'To city', required: true },
    { name: 'tempClass', label: 'Temperature class', type: 'select', options: opts(classes), required: true },
    { name: 'tempMinC', label: 'Lowest temperature', type: 'number', unit: 'temp', required: true }, { name: 'tempMaxC', label: 'Highest temperature', type: 'number', unit: 'temp', required: true },
    { name: 'departureTime', label: 'Departure time (HH:MM)', required: true, placeholder: '20:00' },
    ...WEEK_DAYS.map(d => ({ name: `day${d}`, label: d.charAt(0) + d.slice(1).toLowerCase(), type: 'checkbox' as const })),
    { name: 'cutoffHours', label: 'Booking cut-off (hours before)', type: 'number' }, { name: 'transitHours', label: 'Transit hours', type: 'number', required: true },
    { name: 'capacityPallets', label: 'Pallet positions', type: 'number', required: true }, { name: 'capacityKg', label: 'Capacity (kg)', type: 'number', required: true },
    { name: 'ratePerPallet', label: 'Rate per pallet (Rs)', type: 'number' }, { name: 'ratePerKg', label: 'Rate per kg (Rs)', type: 'number' }, { name: 'minCharge', label: 'Minimum charge (Rs)', type: 'number' },
    { name: 'odaRatePerKg', label: 'ODA rate per kg (Rs)', type: 'number' }, { name: 'odaMinCharge', label: 'ODA minimum (Rs)', type: 'number' },
    { name: 'active', label: 'Active', type: 'checkbox' },
    { name: 'hubsText', label: 'Hubs in order (city:minutes allowed out of the reefer)', placeholder: 'Nagpur:45', wide: true },
    { name: 'pincodesText', label: 'Served pincodes or their first digits (blank: no ODA)', placeholder: '400, 401', wide: true },
    { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ]} />;
}
