/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// Trips: Create Trip and Trip Tracking.
//
// REQ-CC-003: the trip picks a temperature profile instead of three typed numbers, and a truck that cannot
// hold the profile is refused.
// REQ-CC-003-FIX1: the "Create Load Request" form is no longer on this page. It moved to its own page
// (LoadRequestsPage, /loads, menu Load Requests), so this page is about trips only. A Partner login sees
// Trip Tracking for its own trips and no form.
// REQ-CC-006: a truck with an expired fitness certificate cannot be chosen (Compliance Register).
// REQ-TRP-001: a trip needs a driver. The Driver list holds the employees with the role Driver in HR; a
// driver whose licence has expired cannot be chosen. Trip Tracking shows the stage and the driver.
// REQ-TRP-008: "Weather on this route" shows the official warnings on the route for the trip dates; Orange and Red
// need a tick and a reason (WeatherRouteCheck). REQ-TRP-010: Trip Tracking shows the weather level of the last check.
// REQ-TAL-007: the planned start is required (the truck and driver are booked from it); the truck and driver lists say
// who is free for the planned time (/api/allocation/availability). REQ-TAL-003: a hired truck shows its contract
// freight, or asks for the agreed freight when the transporter has no rate for the lane.
// REQ-DSP-011: the readiness of the chosen truck (service due, breakdown, insurance, permit); a Manager may tick
// "Use this truck anyway" with a reason. REQ-DSP-002: a new trip waits for a Manager's approval; Trip Tracking shows it.
// REQ-PLT-004: Trip Tracking is paged, searched, filtered and exported by the server (/api/operations/trips/page).
import { FormEvent, useEffect, useState } from 'react';
import { Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, currentUser } from '@/shared/services/api';
import { STAGE_STYLE } from '@/modules/trip/TripStatusPanel';
import { WeatherRouteCheck } from '@/modules/weather/WeatherRouteCheck';
import { LEVEL_LABEL, LEVEL_STYLE } from '@/modules/weather/weather';
import { freightQuote, isHired, iso } from '@/modules/allocation/allocation';
import { ReadinessNote } from '@/modules/dispatch/ReadinessNote';
import { GovTripNote } from '@/modules/gov/GovTripNote'; // REQ-GOV-009, 015
import { APPROVAL_STYLE, APPROVAL_TEXT } from '@/modules/dispatch/dispatch';
import { Column, DataTable, Filter } from '@/shared/components/DataTable'; // REQ-PLT-004: Trip Tracking paged by the server
import { fmtDateTime, fmtMoney, fmtTemp, fmtTempRange, fmtWeight, toBase, unitNow, usePrefsFormat } from '@/shared/i18n'; // REQ-PLT-015 the login's units

const c = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const l = 'mb-1.5 block text-sm font-semibold text-slate-700';
const num = (v: any) => Number(v);
// REQ-TRP-005 / REQ-PLT-015: the date and time in the login's format and time zone
const arrival = (v: any) => fmtDateTime(v);

export function OperationsPage() {
  const u = currentUser();
  usePrefsFormat(); // REQ-PLT-015: show again when the units change
  const isPartner = String(u.loginType || u.userType || u.role || '').toUpperCase() === 'PARTNER';
  const [partners, setPartners] = useState<any[]>([]), [vehicles, setVehicles] = useState<any[]>([]);
  // REQ-PLT-004: reloadKey asks the paged Trip Tracking again; options are the filter choices the server sends
  const [tripsReload, setTripsReload] = useState(0), [tripOptions, setTripOptions] = useState<any>({});
  const [msg, setMsg] = useState('');
  const [tripType, setTripType] = useState(window.location.hash === '#create-part-load' ? 'PART_LOAD' : 'FULL');
  // The profile list is asked again when the partner changes, because a partner can have its own agreed range.
  const [tripPartner, setTripPartner] = useState(''), [tripProfile, setTripProfile] = useState(''), [tripVehicle, setTripVehicle] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  // REQ-TRP-001: drivers. driversNote is set when the list cannot be read (script 20 not run): the form then works as before.
  const [drivers, setDrivers] = useState<any[]>([]), [tripDriver, setTripDriver] = useState(''), [driversNote, setDriversNote] = useState('');
  // REQ-TRP-008: the route and the dates are kept here so the weather check can follow them
  const [srcCity, setSrcCity] = useState(''), [dstCity, setDstCity] = useState(''), [startAt, setStartAt] = useState(''), [arriveAt, setArriveAt] = useState('');
  // REQ-TAL-007 / REQ-TAL-003: who is free for the planned time, and the contract freight of a hired truck
  const [tons, setTons] = useState(''), [avail, setAvail] = useState<any>(null), [quote, setQuote] = useState<any>(null);
  const loadDrivers = () => api('/api/operations/drivers').then(d => { setDrivers(Array.isArray(d) ? d : []); setDriversNote(''); }).catch(e => { setDrivers([]); setDriversNote(e.message || 'The driver list could not be read'); });

  // REQ-PLT-004: the trips are no longer read here; the Trip Tracking table pages them itself
  const load = () => Promise.all([api('/api/operations/partners'), api('/api/operations/vehicles')])
    .then(([p, v]) => { setPartners(p); setVehicles(v); }).catch(e => setMsg(e.message));
  useEffect(() => { void load(); if (!isPartner) void loadDrivers(); }, []);
  useEffect(() => {
    if (isPartner) return;
    api(`/api/temperature-profiles${tripPartner ? `?partnerId=${tripPartner}` : ''}`).then(x => setProfiles(Array.isArray(x) ? x : [])).catch(() => setProfiles([]));
  }, [tripPartner, isPartner]);

  const rangeOf = (p: any) => fmtTempRange(p.effectiveMinC, p.effectiveMaxC);
  const chosen = profiles.find(p => String(p.id) === tripProfile);
  // Same rule as the server: a truck can hold a profile when the profile's target lies inside the truck's own range.
  // Trucks that cannot hold the chosen profile are greyed out. A truck that was already picked stays selectable,
  // so the form still sends it and the server answers with its clear refusal.
  const holds = (v: any, p: any) => !p || ((v.minTemperatureC == null || num(p.effectiveTargetC) >= num(v.minTemperatureC)) && (v.maxTemperatureC == null || num(p.effectiveTargetC) <= num(v.maxTemperatureC)));
  const truckRange = (v: any) => v.minTemperatureC == null && v.maxTemperatureC == null ? 'range not recorded' : fmtTempRange(v.minTemperatureC, v.maxTemperatureC);
  const pickedTruck = vehicles.find(v => String(v.id) === tripVehicle);
  const pickedDriver = drivers.find(d => String(d.id) === tripDriver);
  useEffect(() => {
    if (isPartner || !startAt || !iso(startAt)) { setAvail(null); return; }
    const q = new URLSearchParams({ start: iso(startAt) });
    if (iso(arriveAt)) q.set('end', iso(arriveAt));
    if (Number(toBase('weight', tons)) > 0) q.set('tons', toBase('weight', tons));
    if (chosen?.effectiveTargetC != null) q.set('targetC', String(chosen.effectiveTargetC));
    const t = setTimeout(() => { api(`/api/allocation/availability?${q}`).then(setAvail).catch(() => setAvail(null)); }, 300);
    return () => clearTimeout(t);
  }, [startAt, arriveAt, tons, chosen?.effectiveTargetC, isPartner]);
  const tonsBase = toBase('weight', tons); // REQ-PLT-015: typed in the login's unit, sent in tons
  const availTruck = avail?.trucks?.find((x: any) => String(x.id) === tripVehicle);
  const availDriver = avail?.drivers?.find((x: any) => String(x.id) === tripDriver);
  const hiredTruck = isHired(availTruck?.ownershipType);
  useEffect(() => {
    setQuote(null);
    if (!hiredTruck || !srcCity.trim() || !dstCity.trim()) return;
    const t = setTimeout(() => {
      freightQuote({ vehicleId: tripVehicle, from: srcCity.trim(), to: dstCity.trim(), tons: tonsBase, temperatureProfileId: tripProfile && tripProfile !== 'NONE' ? tripProfile : null, date: startAt.slice(0, 10) })
        .then(setQuote).catch(() => setQuote({ needsAgreedFreight: true, message: 'The contract rate could not be read. Enter the agreed freight' }));
    }, 400);
    return () => clearTimeout(t);
  }, [hiredTruck, tripVehicle, srcCity, dstCity, tonsBase, tripProfile, startAt]);
  const busyText = (x: any) => (x && !x.fits ? ` - ${x.freeFromText ? `free from ${x.freeFromText}` : String(x.reasons?.[0] || 'does not fit').toLowerCase()}` : '');
  const fitNote = (x: any, what: string) => x && <p className={`mt-1 text-xs ${x.fits ? 'text-emerald-700' : 'font-semibold text-red-700'}`}>
    {x.fits ? `${what} is free for the planned time${avail?.endAssumed ? ' (arrival not entered: the usual trip length is assumed)' : ''}.` : `${x.reasons.join('. ')}.${x.freeFromText ? ` Free from ${x.freeFromText}.` : ''}`}
    {x.warnings?.length ? <span className="block font-normal text-amber-700">{x.warnings.join('. ')}.</span> : null}</p>;

  // REQ-PLT-004: the Trip Tracking columns (the cells are the same as the old table)
  const closed = (t: any) => ['COMPLETED', 'CANCELLED'].includes(String(t.stage || t.status));
  const tripColumns: Column[] = [
    { key: 'tripNumber', label: 'Trip', sort: 'tripNumber', className: 'font-semibold', render: t => <Link to={`/trips/${t.id}`} className="text-sky-700 hover:underline" title="Open trip details and map">{t.tripNumber}</Link> },
    { key: 'tripType', label: 'Type', sort: 'tripType' },
    { key: 'partnerName', label: 'Partner', sort: 'partnerName' },
    { key: 'vehicleNumber', label: 'Truck', sort: 'vehicleNumber' },
    { key: 'driverName', label: 'Driver', sort: 'driverName', render: t => t.driverName || <span className="text-slate-400">Not assigned</span> },
    { key: 'route', label: 'Route', render: t => <>{t.sourceCity} → {t.destinationCity}{t.weatherLevel && t.weatherLevel !== 'NONE' && !closed(t) ? <span title={t.weatherSummary || ''} className={`ml-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[t.weatherLevel] || ''}`}>{LEVEL_LABEL[t.weatherLevel]} weather</span> : null}</> },
    { key: 'plannedLoadTons', label: 'Load', render: t => <>{fmtWeight(t.plannedLoadTons ?? 0)}{Number(t.attachedLoadTons) > 0 ? <span className="text-slate-500"> + {fmtWeight(t.attachedLoadTons)}</span> : null}</> },
    // REQ-TRP-004: for staff, the free capacity of a part-load trip opens its planner
    { key: 'availableCapacityTons', label: 'Available', render: t => <>{fmtWeight(t.availableCapacityTons)}{t.tripType === 'PART_LOAD' && !isPartner && !closed(t) ? <Link to={`/part-load/${t.id}`} className="ml-2 font-bold text-sky-700 hover:underline">Plan</Link> : null}</> },
    { key: 'actualFare', label: 'Fare', render: t => fmtMoney(t.actualFare) },
    { key: 'status', label: 'Status', sort: 'status', render: t => t.stage && STAGE_STYLE[t.stage] ? <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STAGE_STYLE[t.stage]}`}>{t.stageLabel || t.stage}</span> : t.status },
    // REQ-DSP-002: approval of a planned trip; the trip page approves or sends it back
    { key: 'approvalStatus', label: 'Approval', render: t => t.approvalStatus && !closed(t) ? <Link to={`/trips/${t.id}`} title={t.approvedByName ? `Approved by ${t.approvedByName}` : 'Open the trip to approve it'} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${APPROVAL_STYLE[t.approvalStatus] || ''}`}>{APPROVAL_TEXT[t.approvalStatus] || t.approvalStatus}</Link> : '-' },
    // REQ-TRP-005: the arrival time calculated last from the truck's position; the promised time until there is one
    { key: 'expectedArrivalAt', label: 'Arrival', sort: 'expectedArrivalAt', className: 'whitespace-nowrap', render: t => t.etaAt ? <>{arrival(t.etaAt)}{t.etaLate ? <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">late</span> : null}</> : t.expectedArrivalAt ? <span className="text-slate-500">{arrival(t.expectedArrivalAt)}</span> : '-' },
    { key: 'temperature', label: 'Temperature', className: 'whitespace-nowrap', render: t => <>{t.temperatureProfileName ? <>{t.temperatureProfileName} </> : null}{t.requiredTempMinC != null && t.requiredTempMaxC != null ? <span className="text-slate-500">{fmtTempRange(t.requiredTempMinC, t.requiredTempMaxC)} </span> : null}<Link to={`/cold-chain?trip=${t.id}`} className="font-bold text-sky-700 hover:underline">Proof</Link></> },
  ];
  const opts = (k: string): [string, string][] => (Array.isArray(tripOptions[k]) ? tripOptions[k] : []).map((v: string) => [v, v.replace(/_/g, ' ')]);
  const tripFilters: Filter[] = [
    { name: 'status', label: 'Status', options: opts('status') },
    { name: 'tripType', label: 'Trip type', options: opts('tripType') },
    ...(isPartner ? [] : [{ name: 'partner', label: 'Partner', options: opts('partner') }]),
    { name: 'plannedStartAt', label: 'Planned start', range: 'date' as const },
  ];

  async function createTrip(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const body: any = Object.fromEntries(new FormData(f));
      if (body.temperatureProfileId === 'NONE') delete body.temperatureProfileId;
      body.plannedLoadTons = toBase('weight', body.plannedLoadTons); // REQ-PLT-015: typed in the login's unit
      // The two time fields hold the time of this computer. They are sent as one exact moment (UTC), so the
      // promised arrival does not depend on the time zone of the server (REQ-TRP-005 compares it with the clock).
      for (const k of ['plannedStartAt', 'expectedArrivalAt']) {
        if (body[k]) { const d = new Date(String(body[k])); if (!Number.isNaN(d.getTime())) body[k] = d.toISOString(); }
      }
      const r = await api('/api/operations/trips', { method: 'POST', body: JSON.stringify(body) });
      const temp = r.temperatureProfileName ? ` (${r.temperatureProfileName}, ${fmtTempRange(r.requiredTempMinC, r.requiredTempMaxC)})` : '';
      const wx = r.weatherLevel && r.weatherLevel !== 'NONE' ? `. Weather: ${LEVEL_LABEL[r.weatherLevel]} warning on the route${r.weatherLevel === 'YELLOW' ? '' : ', confirmed with your reason'}` : '';
      const ok = r.readinessOverride ? `. Truck used with a Manager's approval: ${r.readinessOverride}` : '';
      const gov = `${r.govOverride ? `. Government check approved by a Manager: ${r.govOverride}` : ''}${r.govWarning ? `. Government check: ${r.govWarning}` : ''}`;
      const wait = r.approvalStatus === 'PENDING' ? '. It waits for a Manager\'s approval before it can start (Trip > Planning Board)' : '';
      setMsg(`Trip created: ${r.tripNumber}${temp}${r.driverName ? `, driver ${r.driverName}` : ''}${r.warning ? `. Note: ${r.warning}` : ''}${r.driverNote ? `. Driver: ${String(r.driverNote).toLowerCase()}` : ''}${wx}${ok}${gov}${wait}`);
      f.reset(); setTons(''); setAvail(null); setQuote(null); setTripPartner(''); setTripProfile(''); setTripVehicle(''); setTripDriver('');
      setSrcCity(''); setDstCity(''); setStartAt(''); setArriveAt('');
      void load(); void loadDrivers(); setTripsReload(x => x + 1); // REQ-PLT-004: show the new trip in Trip Tracking
    } catch (x: any) { setMsg(x.message); }
  }

  if (!u.token && !localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;
  return <>
    <h1 className="text-3xl font-bold">Trips</h1>
    <p className="text-slate-600">{isPartner
      ? 'Your trips. Open Proof to see the temperature graph and certificate of a trip.'
      : 'Create a FULL trip for a dedicated load, or a PART_LOAD trip that can accept compatible loads along the route.'}</p>
    {msg && <div className="my-4 rounded-xl bg-blue-50 p-3 text-blue-900">{msg}</div>}

    {!isPartner && <form id="create-trip" onSubmit={createTrip} className="mt-6 max-w-4xl scroll-mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Route />Create Trip</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className={l}>Trip Type *</label><select name="tripType" value={tripType} onChange={e => setTripType(e.target.value)} className={c}><option value="FULL">FULL TRIP</option><option value="PART_LOAD">PART LOAD</option></select></div>
        <div><label className={l}>Partner / Client *</label><select name="partnerId" required value={tripPartner} onChange={e => { setTripPartner(e.target.value); setTripProfile(''); }} className={c}><option value="">Select partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className={l}>Temperature Profile *</label>
          <select name="temperatureProfileId" required value={tripProfile} onChange={e => setTripProfile(e.target.value)} className={c}>
            <option value="">Select profile</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({rangeOf(p)})</option>)}<option value="NONE">No temperature control</option>
          </select>
          {chosen && <p className="mt-1 text-xs text-slate-600">Target {fmtTemp(chosen.effectiveTargetC)}, allowed {rangeOf(chosen)}. {chosen.agreedWithPartner ? 'Range agreed with this partner.' : 'Standard range.'}</p>}
        </div>
        <div><label className={l}>Truck *</label>
          <select name="vehicleId" required value={tripVehicle} onChange={e => setTripVehicle(e.target.value)} className={c}>
            <option value="">Select truck</option>
            {/* REQ-CC-006: a truck whose fitness certificate has expired is greyed out too; the server refuses it with the date. */}
            {vehicles.map(v => <option key={v.id} value={v.id} disabled={(v.complianceBlocked || !holds(v, chosen)) && String(v.id) !== tripVehicle}>{v.vehicleNumber} ({fmtWeight(v.capacityTons)}, {truckRange(v)}){v.complianceBlocked ? ` - ${String(v.complianceNote || 'document expired').toLowerCase()}` : holds(v, chosen) ? busyText(avail?.trucks?.find((x: any) => x.id === v.id)) : ' - cannot hold this profile'}</option>)}
          </select>
          {chosen && pickedTruck && !holds(pickedTruck, chosen) && <p className="mt-1 text-xs font-semibold text-red-700">{pickedTruck.vehicleNumber} works at {truckRange(pickedTruck)} and cannot hold {chosen.name} (target {fmtTemp(chosen.effectiveTargetC)}). Choose another truck.</p>}
          {chosen && pickedTruck && pickedTruck.minTemperatureC == null && pickedTruck.maxTemperatureC == null && <p className="mt-1 text-xs text-amber-700">This truck has no temperature range recorded, so it cannot be checked against the profile.</p>}
          {pickedTruck && pickedTruck.complianceNote && <p className={`mt-1 text-xs font-semibold ${pickedTruck.complianceBlocked ? 'text-red-700' : 'text-amber-700'}`}>{pickedTruck.vehicleNumber}: {pickedTruck.complianceNote}.{pickedTruck.complianceBlocked ? ' It cannot be put on a trip until the certificate is renewed in the ' : ' Renew it in the '}<Link to="/compliance" className="underline">Compliance Register</Link>.</p>}
          {fitNote(availTruck, pickedTruck?.vehicleNumber || 'The truck')}
          <ReadinessNote vehicleId={tripVehicle} start={iso(startAt)} end={iso(arriveAt)} truckName={pickedTruck?.vehicleNumber} />
          {!startAt && tripVehicle && <p className="mt-1 text-xs text-slate-500">Enter the planned start to see whether the truck is free.</p>}
          {/* REQ-TAL-003: freight of a hired truck: from the transporter's contract, or agreed for this trip */}
          {hiredTruck && <div className="mt-2 rounded-xl bg-violet-50 p-2 text-xs text-violet-900">
            <b>{availTruck.ownershipType === 'MARKET' ? 'Market truck' : 'Attached truck'}</b>{availTruck.transporterName ? ` of ${availTruck.transporterName}` : ''}. {!srcCity || !dstCity ? 'Enter the cities to see the contract freight.' : !quote ? 'Reading the contract rate...' : quote.message}
            {quote?.needsAgreedFreight && <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div><label className={l}>Agreed freight (₹) *</label><input name="agreedFreight" required type="number" min="1" step="0.01" className={c} /></div>
              <div><label className={l}>Freight note</label><input name="freightNote" className={c} placeholder="Agreed on phone with the owner" /></div>
            </div>}
          </div>}
        </div>
        {/* REQ-TRP-001: the driver is mandatory */}
        <div className="md:col-span-2"><label className={l} htmlFor="trip-driver">Driver *</label>
          {driversNote
            ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{driversNote}</p>
            : <select id="trip-driver" name="driverId" required value={tripDriver} onChange={e => setTripDriver(e.target.value)} className={c}>
              <option value="">Select driver</option>
              {drivers.map(d => <option key={d.id} value={d.id} disabled={!d.assignable}>{d.name}{d.mobile ? ` (${d.mobile})` : ''}{d.note ? ` - ${String(d.note).toLowerCase()}` : busyText(avail?.drivers?.find((x: any) => x.id === d.id))}</option>)}
            </select>}
          {!driversNote && drivers.length === 0 && <p className="mt-1 text-xs font-semibold text-amber-700">No driver found. Add the driver in HR &gt; Add Employee / Driver with the role Driver, then come back.</p>}
          {pickedDriver && <p className={`mt-1 text-xs ${pickedDriver.note ? 'font-semibold text-amber-700' : 'text-slate-600'}`}>Licence {pickedDriver.licenceNumber || 'not recorded'}{pickedDriver.licenceExpiryDate ? `, valid until ${pickedDriver.licenceExpiryDate}` : ''}{pickedDriver.reportsTo ? `. Reports to ${pickedDriver.reportsTo}` : ''}{pickedDriver.note ? `. ${pickedDriver.note}.` : '.'}</p>}
          {!driversNote && fitNote(availDriver, pickedDriver?.name || 'The driver')}
        </div>
        <div><label className={l}>Source City *</label><input name="sourceCity" required value={srcCity} onChange={e => setSrcCity(e.target.value)} className={c} placeholder="Delhi" /></div>
        <div><label className={l}>Destination City *</label><input name="destinationCity" required value={dstCity} onChange={e => setDstCity(e.target.value)} className={c} placeholder="Bhubaneswar" /></div>
        <div><label className={l}>Planned Load ({unitNow('weight')}) *</label><input name="plannedLoadTons" required type="number" step="any" value={tons} onChange={e => setTons(e.target.value)} className={c} /></div>
        <div><label className={l}>Planned Volume (m³)</label><input name="plannedVolumeM3" type="number" step="0.001" className={c} /></div>
        <div><label className={l}>Maximum Speed (km/h)</label><input name="maxSpeedKmph" type="number" step="0.1" defaultValue="80" className={c} /></div>
        <div><label className={l}>Rate per Ton</label><input name="ratePerTon" type="number" step="0.01" className={c} /></div>
        <div><label className={l}>Planned Start *</label><input id="trip-planned-start" name="plannedStartAt" required type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={c} /></div>
        <div><label className={l}>Expected Arrival</label><input name="expectedArrivalAt" type="datetime-local" value={arriveAt} onChange={e => setArriveAt(e.target.value)} className={c} /></div>
      </div>
      {/* REQ-TRP-008: severe-weather check of the route for the trip dates */}
      <WeatherRouteCheck sourceCity={srcCity} destinationCity={dstCity} plannedStartAt={startAt} expectedArrivalAt={arriveAt}
        onChangeDates={() => { const el = document.getElementById('trip-planned-start'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); (el as HTMLInputElement | null)?.focus(); }} />
      {/* REQ-GOV-009, 015: Parivahan, permit and tax of the states, licence, FASTag and road safety of the trip */}
      <GovTripNote vehicleId={tripVehicle} driverId={tripDriver} source={srcCity} destination={dstCity} start={startAt} arrive={arriveAt} />
      <button className="mt-5 rounded-xl bg-cyan-700 px-6 py-3 font-semibold text-white">Create Trip</button>
      <p className="mt-3 text-sm text-slate-500">Goods a partner wants moved are entered under <Link to="/loads#create-load" className="font-bold text-sky-700 hover:underline">Load Requests &gt; Create Load Request</Link>.</p>
    </form>}

    {/* REQ-PLT-004: same columns and buttons as before, paged by the server with search, filters and export */}
    <section id="trip-tracking" className="mt-6 scroll-mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Trip Tracking</h2>
      <div className="mt-4 [&_table]:min-w-[1350px]">
        <DataTable path="/api/operations/trips/page" columns={tripColumns} filters={tripFilters} exportName="trips" reloadKey={tripsReload}
          searchPlaceholder="Search trip, truck, driver, partner or city" empty="No trips found" onLoaded={x => setTripOptions(x?.options || {})} />
      </div>
    </section>
  </>;
}
