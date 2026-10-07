/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-003 -- Vehicle request and eligibility list.
//   A load that needs a truck raises a vehicle request (from an open load, or typed in). Opening the request lists
//   every truck and driver: the ones that fit first, the others greyed with the reasons (too small, cannot hold the
//   temperature, busy until ..., paper expired, transporter not approved). "Give truck" makes the trip through
//   Create Trip, so all its checks apply (double booking, papers, weather, freight of a hired truck).
//
// REQ-TAL-004/005/006: below the request, the load can go to transporters as a tender, spot quotes, a reverse auction
// or by the lane's share rule (TenderPanel). REQ-TAL-012: hired trucks show their transporter's scorecard grade.
//
// Backend: AllocationController (/api/allocation/requests/**), FreightController (/api/transporters/freight/quote),
// TenderController (/api/allocation/requests/{id}/tender ...).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { OWNERSHIP } from '@/modules/transporter/transporter';
import { TenderPanel } from '@/modules/tender/TenderPanel';
import { ScoreBadge } from '@/modules/tender/ScoreBadge';
import { REQUEST_STATUS, REQUEST_STYLE, SCRIPT, freightQuote, indiaDay, isHired, iso, needsWeatherTick, role, rupees, tag, when } from './allocation';
import { fmtDate, fmtTemp, fmtTempRange, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const call = (method: string, path: string, body?: unknown) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const ownerLabel = (o?: string) => (OWNERSHIP.find(x => x[0] === o)?.[1] || o || '-');
const temp = (r: any) => r.temperatureProfileName || (r.requiredTemperatureC != null ? `${fmtTemp(r.requiredTemperatureC)}` : 'No temperature control');

export function VehicleRequestsPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('id') || 0);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [adding, setAdding] = useState<null | { loadId?: number }>(null);
  const [msg, setMsg] = useState('');
  const [trip, setTrip] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try { setList(await api(`/api/allocation/requests${status ? `?status=${status}` : ''}`)); }
    catch (x) { setError(errorText(x, 'Could not load the vehicle requests')); }
  }, [status]);
  const loadOne = useCallback(async () => {
    if (!id) { setDetail(null); return; }
    try { setDetail(await api(`/api/allocation/requests/${id}`)); }
    catch (x) { setDetail(null); setError(errorText(x, 'Could not load the request')); }
  }, [id]);
  useEffect(() => { if (me.staff) void loadList(); }, [loadList]);
  useEffect(() => { if (me.staff) void loadOne(); }, [loadOne]);

  function start() { setMsg(''); setError(''); setTrip(null); setBusy(true); }

  async function create(body: Record<string, unknown>) {
    start();
    try {
      const r = await call('POST', '/api/allocation/requests', body);
      setMsg(`Vehicle request ${r.requestNo} raised. Choose a truck and a driver below.`);
      setAdding(null); await loadList(); setParams({ id: String(r.id) });
    } catch (x) { setError(errorText(x, 'Could not raise the request')); }
    finally { setBusy(false); }
  }

  /** Returns the refusal text (the screen may ask for the weather tick), or '' when the trip was made. */
  async function assign(body: Record<string, unknown>) {
    start();
    try {
      const r = await call('POST', `/api/allocation/requests/${id}/assign`, body);
      setMsg(r.message || `Trip ${r.tripNumber} made.`); setTrip({ id: r.id, tripNumber: r.tripNumber });
      await Promise.all([loadOne(), loadList()]); return '';
    } catch (x) { const m = errorText(x, 'Could not give the truck'); setError(m); return m; }
    finally { setBusy(false); }
  }

  async function cancel() {
    const reason = window.prompt('Reason for cancelling this vehicle request:');
    if (reason === null) return;
    start();
    try { const r = await call('POST', `/api/allocation/requests/${id}/cancel`, { reason }); setMsg(`Request ${r.requestNo} cancelled.`); await Promise.all([loadOne(), loadList()]); }
    catch (x) { setError(errorText(x, 'Could not cancel the request')); }
    finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Vehicle requests</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ClipboardList className="h-8 w-8 text-sky-700" />Vehicle requests</h1>
    <p className="text-slate-600">Loads that need a truck. Open a request to see which trucks and drivers can take it, and why the others cannot. <Link to="/fleet-calendar" className="font-semibold text-sky-700 hover:underline">Truck calendar</Link></p>
    <Banner msg={msg} error={error} />
    {trip?.id && <p className="-mt-1 mb-2"><Link to={`/trips/${trip.id}`} className="font-bold text-sky-700 hover:underline">Open trip {trip.tripNumber} →</Link></p>}
    {list && !list.ready && <NotReady script={SCRIPT} />}
    {list?.ready && <>
      {adding && <NewRequest openLoads={list.openLoads || []} loadId={adding.loadId} busy={busy} onSave={create} onCancel={() => setAdding(null)} />}
      {detail && <Detail key={detail.request.id} d={detail} busy={busy} onAssign={assign} onCancel={cancel} onClose={() => setParams({})} />}
      {detail && <Section title="Send to transporters"><TenderPanel key={detail.request.id} requestId={detail.request.id} onChanged={() => { void loadOne(); void loadList(); }} onMsg={setMsg} onError={setError} /></Section>}
      <Section title="Requests" right={<div className="flex gap-2">
        <select value={status} onChange={x => setStatus(x.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
          {Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="">All</option></select>
        <button onClick={() => { setAdding({}); setMsg(''); setError(''); }} className={btn}>New request</button></div>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Request</th><th className={th}>Partner</th><th className={th}>Route</th><th className={th}>Load</th>
            <th className={th}>Pickup</th><th className={th}>Deliver by</th><th className={th}>Status</th></tr></thead>
          <tbody>{list.requests.map((r: any) => <tr key={r.id} onClick={() => { setParams({ id: String(r.id) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`cursor-pointer border-t hover:bg-sky-50 ${r.id === id ? 'bg-sky-50' : ''}`}>
            <td className={td}><b>{r.requestNo}</b><div className="text-xs text-slate-500">{r.loadNumber ? `Load ${r.loadNumber}` : 'Typed in'} · {r.createdByName || ''}</div></td>
            <td className={td}>{r.partnerName}</td><td className={td}>{r.originCity} → {r.destinationCity}</td>
            <td className={td}>{fmtWeight(r.loadTons)}<div className="text-xs text-slate-500">{temp(r)}</div></td>
            <td className={`${td} whitespace-nowrap`}>{when(r.pickupAt)}</td><td className={`${td} whitespace-nowrap`}>{when(r.deliverBy)}</td>
            <td className={td}><span className={tagOf(r.status)}>{REQUEST_STATUS[r.status] || r.status}</span>
              {r.tripId && <div className="text-xs text-slate-600">{r.vehicleNumber}{r.driverName ? `, ${r.driverName}` : ''} · <Link to={`/trips/${r.tripId}`} onClick={e => e.stopPropagation()} className="font-semibold text-sky-700 hover:underline">{r.tripNumber}</Link>{r.tripStatus === 'CANCELLED' ? ' (trip cancelled)' : ''}</div>}
              {r.cancelReason && <div className="text-xs text-slate-500">{r.cancelReason}</div>}
              {r.tender && <div className="text-xs font-semibold text-violet-700">{r.tender.tenderNo}: {r.tender.status === 'AWARDED' ? `awarded to ${r.tender.awardedTransporterName} ${rupees(r.tender.awardedAmount)}${r.tender.truckGiven ? ', truck given' : ', waiting for truck'}` : `${String(r.tender.kind).toLowerCase()} open${r.tender.closesAt ? ` till ${when(r.tender.closesAt)}` : ''}`}</div>}</td>
          </tr>)}
            {list.requests.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No requests.</td></tr>}</tbody></table></div>
      </Section>
      {list.openLoads?.length > 0 && <Section title="Open loads without a vehicle request">
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Load</th><th className={th}>Partner</th><th className={th}>Route</th><th className={th}>Weight</th><th className={th}>Pickup from</th><th className={th}></th></tr></thead>
          <tbody>{list.openLoads.map((l: any) => <tr key={l.id} className="border-t">
            <td className={`${td} font-semibold`}>{l.loadNumber}</td><td className={td}>{l.partnerName}</td><td className={td}>{l.pickupCity} → {l.deliveryCity}</td>
            <td className={td}>{fmtWeight(l.weightTons)}<div className="text-xs text-slate-500">{temp(l)}</div></td><td className={`${td} whitespace-nowrap`}>{when(l.pickupFrom)}</td>
            <td className={`${td} text-right`}><button onClick={() => { setAdding({ loadId: l.id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={btnLight}>Ask for a truck</button></td>
          </tr>)}</tbody></table></div>
      </Section>}
    </>}
  </>;
}

const tagOf = (s: string) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${REQUEST_STYLE[s] || 'bg-slate-100 text-slate-700'}`;

function NewRequest({ openLoads, loadId, busy, onSave, onCancel }: { openLoads: any[]; loadId?: number; busy: boolean; onSave: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [fromLoad, setFromLoad] = useState(loadId !== undefined || openLoads.length > 0);
  const [partners, setPartners] = useState<any[]>([]), [partner, setPartner] = useState(''), [profiles, setProfiles] = useState<any[]>([]);
  useEffect(() => { if (!fromLoad && partners.length === 0) api('/api/admin/partners').then(p => setPartners((Array.isArray(p) ? p : []).filter((x: any) => x.active !== false))).catch(() => setPartners([])); }, [fromLoad]);
  useEffect(() => { if (!fromLoad) api(`/api/temperature-profiles${partner ? `?partnerId=${partner}` : ''}`).then(x => setProfiles((Array.isArray(x) ? x : []).filter((p: any) => p.active !== false))).catch(() => setProfiles([])); }, [fromLoad, partner]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget));
    b.pickupAt = iso(String(b.pickupAt || '')); b.deliverBy = iso(String(b.deliverBy || ''));
    for (const k of Object.keys(b)) if (b[k] === '') delete b[k];
    onSave(b);
  }
  const times = <>
    <div><label className={label}>Pickup time{!fromLoad && <span className="text-red-600"> *</span>}</label><input name="pickupAt" type="datetime-local" required={!fromLoad} className={input} />
      {fromLoad && <div className="mt-0.5 text-xs text-slate-500">Empty: the pickup time of the load</div>}</div>
    <div><label className={label}>Deliver by</label><input name="deliverBy" type="datetime-local" className={input} /><div className="mt-0.5 text-xs text-slate-500">Empty: the usual trip length is assumed</div></div>
    <div className="md:col-span-full"><label className={label}>Notes</label><textarea name="notes" rows={2} className={input} /></div>
  </>;
  return <Section title="New vehicle request" right={<div className="flex gap-2">
    <button onClick={() => setFromLoad(true)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${fromLoad ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`}>From an open load</button>
    <button onClick={() => setFromLoad(false)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!fromLoad ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`}>Type it in</button></div>}>
    <form key={String(fromLoad)} onSubmit={submit} className="grid gap-3 md:grid-cols-3">
      {fromLoad
        ? <div className="md:col-span-full"><label className={label}>Open load <span className="text-red-600">*</span></label>
          <select name="loadRequestId" required defaultValue={loadId ?? ''} className={input}><option value="">Select load</option>
            {openLoads.map(l => <option key={l.id} value={l.id}>{l.loadNumber} - {l.partnerName}, {l.pickupCity} → {l.deliveryCity}, {fmtWeight(l.weightTons)}{l.temperatureProfileName ? `, ${l.temperatureProfileName}` : ''}</option>)}</select>
          {openLoads.length === 0 && <div className="mt-0.5 text-xs text-amber-700">No open load is waiting for a truck. Type the request in instead.</div>}</div>
        : <>
          <div><label className={label}>Partner <span className="text-red-600">*</span></label><select name="partnerId" required value={partner} onChange={e => setPartner(e.target.value)} className={input}>
            <option value="">Select partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className={label}>From city <span className="text-red-600">*</span></label><input name="originCity" required className={input} placeholder="Bhubaneswar" /></div>
          <div><label className={label}>To city <span className="text-red-600">*</span></label><input name="destinationCity" required className={input} placeholder="Kolkata" /></div>
          <div><label className={label}>Load (tons) <span className="text-red-600">*</span></label><input name="loadTons" type="number" step="0.001" min="0.001" required className={input} /></div>
          <div><label className={label}>Temperature profile</label><select name="temperatureProfileId" className={input}><option value="">No temperature control</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({fmtTempRange(p.effectiveMinC, p.effectiveMaxC)})</option>)}</select></div>
        </>}
      {times}
      <div className="flex gap-2 md:col-span-full"><button disabled={busy} className={btn}>Raise request</button><button type="button" onClick={onCancel} className={btnLight}>Cancel</button></div>
    </form>
  </Section>;
}

function Detail({ d, busy, onAssign, onCancel, onClose }: { d: any; busy: boolean; onAssign: (b: Record<string, unknown>) => Promise<string>; onCancel: () => void; onClose: () => void }) {
  const r = d.request;
  const [vehicleId, setVehicleId] = useState(''), [driverId, setDriverId] = useState('');
  const [quote, setQuote] = useState<any>(null), [laneId, setLaneId] = useState(''), [agreed, setAgreed] = useState(''), [note, setNote] = useState('');
  const [weather, setWeather] = useState(''), [ack, setAck] = useState(false), [reason, setReason] = useState('');
  const fitFirst = (a: any[]) => [...(a || [])].sort((x, y) => Number(!!y.fits) - Number(!!x.fits));
  const trucks = fitFirst(d.trucks), drivers = fitFirst(d.drivers);
  const truck = trucks.find(t => String(t.id) === vehicleId);
  const hired = isHired(truck?.ownershipType);

  useEffect(() => {
    setQuote(null); setLaneId('');
    if (!truck || !hired) return;
    freightQuote({ vehicleId: truck.id, from: r.originCity, to: r.destinationCity, tons: r.loadTons, temperatureProfileId: r.temperatureProfileId, targetC: r.requiredTemperatureC, date: indiaDay(r.pickupAt) })
      .then(setQuote).catch(x => setQuote({ hired: true, needsAgreedFreight: true, message: errorText(x, 'The contract rate could not be read') + '. Enter the agreed freight' }));
  }, [vehicleId]);
  const priced = (quote?.rates || []).filter((x: any) => x.estimate != null);
  const needFreight = hired && (!quote || quote.needsAgreedFreight);

  async function give() {
    const b: Record<string, unknown> = { vehicleId: Number(vehicleId) };
    if (driverId) b.driverId = Number(driverId);
    if (hired && laneId) b.contractLaneId = Number(laneId);
    if (needFreight && agreed) { b.agreedFreight = Number(agreed); if (note.trim()) b.freightNote = note.trim(); }
    if (ack) { b.weatherAcknowledged = true; b.weatherReason = reason.trim(); }
    const m = await onAssign(b);
    if (m && needsWeatherTick(m)) setWeather(m);
    else if (!m) setWeather('');
  }

  const fitText = (x: any) => x.fits
    ? <span className="font-semibold text-emerald-700">Fits{x.warnings?.length ? <span className="block text-xs font-normal text-amber-700">{x.warnings.join('. ')}</span> : null}</span>
    : <span className="text-xs text-red-700">{x.reasons.join('. ')}{x.freeFromText ? <span className="block text-slate-600">Free from {x.freeFromText}</span> : null}{x.warnings?.length ? <span className="block text-amber-700">{x.warnings.join('. ')}</span> : null}</span>;

  return <Section id="request" title={<>{r.requestNo} <span className={tagOf(r.status)}>{REQUEST_STATUS[r.status] || r.status}</span></>} right={<div className="flex gap-2">
    {r.canAssign && <button disabled={busy} onClick={onCancel} className={btnRed}>Cancel request</button>}
    <button onClick={onClose} className={btnLight}>Close</button></div>}>
    <div className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-3">
      <div><span className="text-slate-500">Partner:</span> <b>{r.partnerName}</b></div>
      <div><span className="text-slate-500">Route:</span> <b>{r.originCity} → {r.destinationCity}</b></div>
      <div><span className="text-slate-500">Load:</span> <b>{fmtWeight(r.loadTons)}</b>, {temp(r)}{r.requiredTempMinC != null && r.requiredTempMaxC != null ? ` (${fmtTempRange(r.requiredTempMinC, r.requiredTempMaxC)})` : ''}</div>
      <div><span className="text-slate-500">Pickup:</span> {when(r.pickupAt)}</div>
      <div><span className="text-slate-500">Deliver by:</span> {when(r.deliverBy)} ({d.hours} hours)</div>
      <div><span className="text-slate-500">{r.loadNumber ? 'Load:' : 'Raised by:'}</span> {r.loadNumber || r.createdByName || '-'}</div>
      {r.notes && <div className="md:col-span-3"><span className="text-slate-500">Notes:</span> {r.notes}</div>}
      {r.tripId && <div className="md:col-span-3"><span className="text-slate-500">Given to:</span> <b>{r.vehicleNumber}</b>{r.driverName ? `, ${r.driverName}` : ''} by {r.assignedByName} on {when(r.assignedAt)} · <Link to={`/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">Trip {r.tripNumber}</Link>{r.tripStatus === 'CANCELLED' ? ' (the trip was cancelled: give another truck)' : ''}</div>}
      {r.cancelReason && <div className="md:col-span-3"><span className="text-slate-500">Cancelled:</span> {r.cancelReason}</div>}
    </div>

    {r.canAssign && <>
      <h3 className="mt-4 font-bold">Trucks <span className="text-sm font-normal text-slate-500">({d.trucksThatFit} of {trucks.length} fit)</span></h3>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}></th><th className={th}>Truck</th><th className={th}>Capacity</th><th className={th}>Temperature</th><th className={th}>Owner</th><th className={th}>Fits?</th></tr></thead>
        <tbody>{trucks.map(t => <tr key={t.id} onClick={() => t.fits && setVehicleId(String(t.id))} className={`border-t ${t.fits ? 'cursor-pointer hover:bg-sky-50' : 'bg-slate-50 text-slate-500'} ${String(t.id) === vehicleId ? 'bg-sky-50' : ''}`}>
          <td className={td}><input type="radio" name="truck" disabled={!t.fits} checked={String(t.id) === vehicleId} onChange={() => setVehicleId(String(t.id))} /></td>
          <td className={td}><b>{t.vehicleNumber}</b><div className="text-xs">{String(t.vehicleType || '').replace(/_/g, ' ').toLowerCase()}</div></td>
          <td className={td}>{fmtWeight(t.capacityTons)}</td>
          <td className={td}>{t.minTemperatureC == null && t.maxTemperatureC == null ? '-' : `${fmtTempRange(t.minTemperatureC, t.maxTemperatureC)}`}</td>
          <td className={td}><span className={tag(t.ownershipType)}>{ownerLabel(t.ownershipType)}</span>{t.transporterName && <div className="text-xs">{t.transporterName} <ScoreBadge score={t.score} /></div>}</td>
          <td className={td}>{fitText(t)}</td>
        </tr>)}
          {trucks.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No trucks in the fleet.</td></tr>}</tbody></table></div>

      <h3 className="mt-4 font-bold">Drivers <span className="text-sm font-normal text-slate-500">({d.driversThatFit} of {drivers.length} free)</span></h3>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}></th><th className={th}>Driver</th><th className={th}>Licence valid till</th><th className={th}>Free?</th></tr></thead>
        <tbody>{drivers.map(x => <tr key={x.id} onClick={() => x.fits && setDriverId(String(x.id))} className={`border-t ${x.fits ? 'cursor-pointer hover:bg-sky-50' : 'bg-slate-50 text-slate-500'} ${String(x.id) === driverId ? 'bg-sky-50' : ''}`}>
          <td className={td}><input type="radio" name="driver" disabled={!x.fits} checked={String(x.id) === driverId} onChange={() => setDriverId(String(x.id))} /></td>
          <td className={td}><b>{x.name}</b><div className="text-xs">{x.mobile || ''}</div></td>
          <td className={td}>{x.licenceExpiryDate ? fmtDate(String(x.licenceExpiryDate).slice(0, 10)) : '-'}</td>
          <td className={td}>{fitText(x)}</td>
        </tr>)}
          {drivers.length === 0 && <tr><td colSpan={4} className={`${td} text-slate-500`}>No drivers found. Add them in HR with the role Driver.</td></tr>}</tbody></table></div>

      {d.rates?.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Contract rates of transporters on this lane ({d.rates.length})</summary>
        <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Transporter</th><th className={th}>Contract</th><th className={th}>Truck</th><th className={th}>Profile</th><th className={`${th} text-right`}>Freight</th></tr></thead>
          <tbody>{d.rates.map((x: any) => <tr key={x.laneId} className="border-t"><td className={td}>{x.transporterName}</td><td className={td}>{x.contractNo}</td>
            <td className={td}>{String(x.vehicleType || '-').replace(/_/g, ' ').toLowerCase()}{x.capacityTons ? `, ${fmtWeight(x.capacityTons)}` : ''}</td><td className={td}>{x.temperatureProfileName || 'Any'}</td>
            <td className={`${td} text-right`}>{rupees(x.estimate ?? x.rate)}</td></tr>)}</tbody></table></details>}

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <div className="text-sm">Chosen: <b>{truck?.vehicleNumber || 'no truck'}</b>, <b>{drivers.find(x => String(x.id) === driverId)?.name || 'no driver'}</b></div>
        {hired && <div className="mt-2 text-sm">
          {!quote ? <span className="text-slate-500">Reading the contract rate of {truck.transporterName}...</span>
            : <p className={quote.needsAgreedFreight ? 'font-semibold text-amber-800' : 'text-emerald-800'}>{quote.message}</p>}
          {priced.length > 1 && <label className="mt-2 block">Price line <select value={laneId} onChange={e => setLaneId(e.target.value)} className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1">
            <option value="">Cheapest ({rupees(priced[0].estimate)})</option>
            {priced.map((x: any) => <option key={x.laneId} value={x.laneId}>{x.contractNo} {x.temperatureProfileName || ''} - {rupees(x.estimate)}</option>)}</select></label>}
          {needFreight && <div className="mt-2 grid gap-2 md:grid-cols-3">
            <div><label className={label}>Agreed freight (₹) <span className="text-red-600">*</span></label><input type="number" min="1" step="0.01" value={agreed} onChange={e => setAgreed(e.target.value)} className={input} /></div>
            <div className="md:col-span-2"><label className={label}>Freight note</label><input value={note} onChange={e => setNote(e.target.value)} className={input} placeholder="Agreed on phone with the owner, includes loading" /></div>
          </div>}
        </div>}
        {weather && <div className="mt-3 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
          <p>{weather}</p>
          <label className="mt-2 flex items-center gap-2 font-bold"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="h-4 w-4" />I have seen these warnings (weather checked)</label>
          {ack && <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500} className={`${input} mt-2`} placeholder="Why the trip must run, and what the driver will do if the warning stays" />}
        </div>}
        <button disabled={busy || !vehicleId || (drivers.length > 0 && !driverId) || (needFreight && !(Number(agreed) > 0)) || (ack && reason.trim().length < 10)} onClick={() => void give()} className={`${btn} mt-3`}>Give truck</button>
        {ack && reason.trim().length < 10 && <span className="ml-2 text-xs text-slate-500">Write a reason of at least 10 letters.</span>}
      </div>
    </>}
  </Section>;
}
