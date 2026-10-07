/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-001-FIX1 -- Trip details: the page behind the "View" button of the dashboard trip tables.
//
// Shows the trip on a Google Map (planned route, and the last GPS position when one was received),
// the trip facts and the latest temperature.
//
// REQ-TRP-001 replaces the two buttons Mark Completed and Cancel Trip of this page by the Trip status
// panel (TripStatusPanel): Planned, Loading, In transit, At delivery, Completed or Cancelled, each move
// a button, with the driver and the odometer readings.
// REQ-TRP-002 adds the link to the live map. REQ-TRP-003 adds the Deliveries panel (proof of delivery).
//
// REQ-CC-004 adds the pre-cooling and loading checklist with Start Trip (TripChecklistPanel).
// REQ-CC-005 adds door and reefer events, planned stops and the trip timeline (TripTimelinePanel).
//
// Backend: /api/operations/trips/{id} (TripDetailController).
// Map: a Google Maps embed in an <iframe>. It works without an API key. If VITE_GOOGLE_MAPS_EMBED_KEY is
// set in .env, the official Maps Embed API is used with that key instead (same picture, Google's
// supported address).
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompartmentTempsPanel } from '@/modules/coldchain/records/CompartmentTempsPanel'; // REQ-CC-012
import { AlertTriangle, ArrowLeft, ExternalLink, History, MapPin, Navigation, RefreshCw, Thermometer, Truck } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { TripChecklistPanel } from '@/modules/trip/TripChecklistPanel'; // REQ-CC-004
import { TripTimelinePanel } from '@/modules/trip/TripTimelinePanel'; // REQ-CC-005
import { STAGE_STYLE, TripStatusPanel } from '@/modules/trip/TripStatusPanel'; // REQ-TRP-001
import { TripDeliveriesPanel } from '@/modules/trip/TripDeliveriesPanel'; // REQ-TRP-003
import { TripEtaPanel } from '@/modules/trip/TripEtaPanel'; // REQ-TRP-005
import { TripWeatherPanel } from '@/modules/weather/TripWeatherPanel'; // REQ-TRP-010
import { TripCostsPanel } from '@/modules/trip/TripCostsPanel'; // REQ-TRP-007
import { TripTollsPanel } from '@/modules/gov/TripTollsPanel'; // REQ-GOV-001, 002
import { GovTripChecksPanel } from '@/modules/gov/GovTripChecksPanel'; // REQ-GOV-009
import { TripApprovalPanel } from '@/modules/dispatch/TripApprovalPanel'; // REQ-DSP-002
import { TransshipmentPanel } from '@/modules/trip/TransshipmentPanel'; // REQ-TAL-010
import { TripTrackingPanel } from '@/modules/tracking/TripTrackingPanel'; // REQ-TRK-002, 003, 004, 006, 008, 009
import { fmtDateTime, fmtTemp, fmtTempRange, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

type Reading = { temperatureC: number; capturedAt: string; sensorId?: string | null };
type Position = { latitude: number; longitude: number; speedKmph?: number | null; capturedAt: string };
type HistoryRow = { id: number; action: string; fromStatus?: string | null; toStatus: string; reason?: string | null; actionBy?: string | null; createdAt: string; odometerKm?: number | null };
type Trip = {
  id: number; tripNumber?: string; tripType?: string; status?: string; stage?: string; stageLabel?: string;
  partnerName?: string | null; vehicleNumber?: string | null; vehicleType?: string | null; capacityTons?: number | null;
  driverName?: string | null; driverMobile?: string | null;
  sourceCity?: string | null; destinationCity?: string | null;
  plannedLoadTons?: number | null; plannedVolumeM3?: number | null;
  requiredTemperatureC?: number | null; requiredTempMinC?: number | null; requiredTempMaxC?: number | null;
  maxSpeedKmph?: number | null; ratePerTon?: number | null; actualFare?: number | null;
  plannedStartAt?: string | null; expectedArrivalAt?: string | null; actualCompletedAt?: string | null;
  latestTemperature?: Reading | null; latestLocation?: Position | null;
  openAlerts?: number; openTemperatureAlerts?: number;
  history?: HistoryRow[]; historyReady?: boolean; invoiceNumbers?: string[];
  closed?: boolean; canComplete?: boolean; canCancel?: boolean;
};

const EMBED_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || '').trim();
const RUNNING = new Set(['RUNNING', 'IN_PROGRESS', 'STARTED', 'ACTIVE']);

const card = 'rounded-2xl bg-white p-5 shadow-sm';

const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const num = (v?: number | null, unit = '') => (v === null || v === undefined ? '-' : `${Number(v)}${unit}`);
const title = (s?: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '-');

// ---- Google Maps addresses --------------------------------------------------------------------
const q = encodeURIComponent;
const routeEmbed = (from: string, to: string) => EMBED_KEY
  ? `https://www.google.com/maps/embed/v1/directions?key=${q(EMBED_KEY)}&origin=${q(from)}&destination=${q(to)}&mode=driving&region=IN`
  : `https://www.google.com/maps?output=embed&saddr=${q(from)}&daddr=${q(to)}&gl=in`;
const pointEmbed = (lat: number, lng: number) => EMBED_KEY
  ? `https://www.google.com/maps/embed/v1/place?key=${q(EMBED_KEY)}&q=${lat},${lng}&zoom=11`
  : `https://www.google.com/maps?output=embed&q=${lat},${lng}&z=11`;
const routeLink = (from: string, to: string) => `https://www.google.com/maps/dir/?api=1&origin=${q(from)}&destination=${q(to)}&travelmode=driving`;
const pointLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** REQ-TRP-001: the badge shows the stage of the trip (Loading, In transit, ...) when the server sends one. */
function StatusBadge({ status, stage, stageLabel }: { status?: string; stage?: string; stageLabel?: string }) {
  if (stage && STAGE_STYLE[stage]) return <span data-testid="trip-badge" className={`rounded-full px-3 py-1 text-xs font-bold ${STAGE_STYLE[stage]}`}>{(stageLabel || stage).toUpperCase()}</span>;
  const s = String(status || '').toUpperCase();
  const style = RUNNING.has(s) ? 'bg-emerald-100 text-emerald-800'
    : s === 'COMPLETED' ? 'bg-sky-100 text-sky-800'
      : s === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
  return <span data-testid="trip-badge" className={`rounded-full px-3 py-1 text-xs font-bold ${style}`}>{s || '-'}</span>;
}

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</dt><dd className="mt-0.5 font-semibold text-slate-900">{children}</dd></div>;
}

export function TripDetailPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const { id } = useParams();
  const user = currentUser();
  // The Temperature Alerts page is for Employee, Manager and Admin; a Partner login gets no link to it.
  const internal = ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase());
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mapView, setMapView] = useState<'route' | 'truck'>('route');
  // The panels below load their own data; these numbers tell them to load again. One number per panel,
  // so that a change made in one panel refreshes the others and not itself.
  const [statusKey, setStatusKey] = useState(0);       // REQ-TRP-001 Trip status
  const [checklistKey, setChecklistKey] = useState(0); // REQ-CC-004 loading checklist
  const [deliveryKey, setDeliveryKey] = useState(0);   // REQ-TRP-003 deliveries
  const [timelineKey, setTimelineKey] = useState(0);   // REQ-CC-005 events and timeline
  const [etaKey, setEtaKey] = useState(0);             // REQ-TRP-005 arrival time and delay alert
  const [costsKey, setCostsKey] = useState(0);         // REQ-TRP-007 fuel and trip costs
  const refresh = useCallback((except: 'status' | 'checklist' | 'delivery' | 'timeline' | '') => {
    if (except !== 'status') setStatusKey(k => k + 1);
    if (except !== 'checklist') setChecklistKey(k => k + 1);
    if (except !== 'delivery') setDeliveryKey(k => k + 1);
    if (except !== 'timeline') setTimelineKey(k => k + 1);
    setEtaKey(k => k + 1);      // a status change (arrived, completed) changes the arrival panel
    setCostsKey(k => k + 1);    // the end odometer gives the kilometres per litre
  }, []);

  const load = useCallback(async (quiet = false) => {
    try {
      const t: Trip = await api(`/api/operations/trips/${id}`);
      setTrip(t);
      setLoadError('');
    } catch (x: any) {
      // A refresh in the background keeps the last good picture; only the first load shows the error.
      if (!quiet) setLoadError(x?.message || 'Unable to load the trip');
    }
  }, [id]);

  useEffect(() => {
    setTrip(null); setMsg(null); setMapView('route');
    void load();
  }, [load]);

  // While the trip is open, fetch the latest temperature and position every minute.
  const closed = trip?.closed;
  useEffect(() => {
    if (closed !== false) return;
    const timer = window.setInterval(() => { void load(true); }, 60000);
    return () => window.clearInterval(timer);
  }, [closed, load]);

  const back = <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline"><ArrowLeft className="h-4 w-4" />Dashboard</Link>;

  if (loadError && !trip) {
    return <>{back}<div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-lg font-bold text-slate-900">{loadError}</p><p className="mt-1 text-slate-600">The trip may belong to another partner, or it was removed.</p><Link to="/operations#trip-tracking" className="mt-4 inline-block font-bold text-sky-700 hover:underline">Open Trip Tracking</Link></div></>;
  }
  if (!trip) return <>{back}<div className="mt-4 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">Loading trip…</div></>;

  const from = (trip.sourceCity || '').trim(), to = (trip.destinationCity || '').trim();
  const hasRoute = Boolean(from && to);
  const pos = trip.latestLocation || null;
  const showTruck = mapView === 'truck' && pos !== null;
  const mapSrc = showTruck && pos ? pointEmbed(Number(pos.latitude), Number(pos.longitude)) : hasRoute ? routeEmbed(from, to) : '';
  const mapLink = showTruck && pos ? pointLink(Number(pos.latitude), Number(pos.longitude)) : hasRoute ? routeLink(from, to) : '';

  const temp = trip.latestTemperature || null;
  const min = trip.requiredTempMinC, max = trip.requiredTempMaxC;
  const tempOut = temp !== null && ((max != null && Number(temp.temperatureC) > Number(max)) || (min != null && Number(temp.temperatureC) < Number(min)));
  const range = fmtTempRange(min, max);
  const tabBtn = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-bold ${on ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:border-sky-400'}`;

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {back}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">{trip.tripNumber || `Trip ${trip.id}`}</h1>
          <StatusBadge status={trip.status} stage={trip.stage} stageLabel={trip.stageLabel} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{trip.tripType === 'PART_LOAD' ? 'PART LOAD' : 'FULL TRIP'}</span>
        </div>
        <p className="mt-1 text-slate-600">{trip.partnerName || '-'} · {trip.vehicleNumber || 'No truck'} · {from || '-'} → {to || '-'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { void load(); refresh(''); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400"><RefreshCw className="h-4 w-4" />Refresh</button>
        {/* REQ-TRP-002: a running trip is on the live map */}
        {/* REQ-TRP-004: the planner of a part-load trip, for staff */}
        {internal && trip.tripType === 'PART_LOAD' && <Link to={`/part-load/${trip.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400">Part-load planner</Link>}
        {trip.closed === false && RUNNING.has(String(trip.status || '').toUpperCase()) && <Link to={`/tracking?trip=${trip.id}`} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800"><Navigation className="h-4 w-4" />Live map</Link>}
      </div>
    </div>

    {msg && <div role="status" className={`mt-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    {/* REQ-TRP-001: the steps of the trip, its driver, the odometer and the buttons that move the trip on */}
    <TripStatusPanel tripId={trip.id} refreshKey={statusKey} openAlerts={trip.openAlerts || 0} invoiceNumbers={trip.invoiceNumbers || []} onChanged={() => { setMsg(null); void load(true); refresh('status'); }} />

    {/* REQ-DSP-002: approval of the planned trip, its edits after approval and the change log. Staff only. */}
    {internal && <TripApprovalPanel tripId={trip.id} refreshKey={statusKey} onChanged={() => { void load(true); refresh(''); }} />}
    {/* REQ-DSP-003..009: route windows, load plan, stock, dock and gate pass, documents of this trip */}
    {internal && <div className="mt-3"><Link to={`/dispatch/trips/${trip.id}`} className="inline-block rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-50">Dispatch plan: route, load, documents, gate pass</Link></div>}

    {/* REQ-TAL-010: change of truck on the road (breakdown replacement, transshipment) with approval and handover. Staff only. */}
    {internal && <TransshipmentPanel tripId={trip.id} onChanged={() => { void load(true); refresh('status'); }} />}

    {/* REQ-TRP-005: promised time, the arrival time calculated from the truck's position, the delay alert */}
    <TripEtaPanel tripId={trip.id} refreshKey={etaKey} onChanged={() => { void load(true); setStatusKey(k => k + 1); }} />

    {/* REQ-TRP-010: the weather warnings on the route now, the re-checks and the confirmation of a new Orange or Red warning */}
    <TripWeatherPanel tripId={trip.id} refreshKey={etaKey} onChanged={() => setStatusKey(k => k + 1)} />

    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-sky-50/70 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><MapPin className="h-5 w-5 text-sky-700" />{showTruck ? 'Last GPS position' : 'Route'} on Google Maps</h2>
          <div className="flex flex-wrap items-center gap-2">
            {pos && <><button type="button" onClick={() => setMapView('route')} className={tabBtn(!showTruck)}>Route</button><button type="button" onClick={() => setMapView('truck')} className={tabBtn(showTruck)}>Truck position</button></>}
            {mapLink && <a href={mapLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline">Open in Google Maps<ExternalLink className="h-4 w-4" /></a>}
          </div>
        </div>
        {mapSrc
          ? <iframe key={mapSrc} title={showTruck ? `Last GPS position of ${trip.tripNumber}` : `Route of ${trip.tripNumber}: ${from} to ${to}`} src={mapSrc} className="block h-[60vh] min-h-[420px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          : <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-slate-500">The map needs a source city and a destination city. This trip has {from ? '' : 'no source city'}{!from && !to ? ' and ' : ''}{to ? '' : 'no destination city'}.</div>}
        <div className="border-t px-4 py-3 text-sm text-slate-600">
          {pos
            ? <><b className="text-slate-900">Last GPS position:</b> {Number(pos.latitude).toFixed(5)}, {Number(pos.longitude).toFixed(5)} at {when(pos.capturedAt)}{pos.speedKmph != null ? `, ${Number(pos.speedKmph)} km/h` : ''}.</>
            : <>No GPS position has been received for this trip yet, so the map shows the planned route from {from || '-'} to {to || '-'}. The truck appears here once the vehicle tracker or the driver app sends its position.</>}
        </div>
      </section>

      <div className="space-y-4">
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Truck className="h-5 w-5 text-sky-700" />Trip details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact name="Partner">{trip.partnerName || '-'}</Fact>
            <Fact name="Truck">{trip.vehicleNumber || '-'}{trip.capacityTons != null ? ` (${fmtWeight(trip.capacityTons)})` : ''}</Fact>
            <Fact name="Driver">{trip.driverName || 'Not assigned'}{trip.driverMobile ? `, ${trip.driverMobile}` : ''}</Fact>
            <Fact name="Status">{trip.stageLabel || title(trip.status)}</Fact>
            <Fact name="From">{from || '-'}</Fact>
            <Fact name="To">{to || '-'}</Fact>
            <Fact name="Planned start">{when(trip.plannedStartAt)}</Fact>
            <Fact name="Expected arrival">{when(trip.expectedArrivalAt)}</Fact>
            {trip.actualCompletedAt && <Fact name="Completed at">{when(trip.actualCompletedAt)}</Fact>}
            <Fact name="Load">{trip.plannedLoadTons == null ? '-' : fmtWeight(trip.plannedLoadTons)}{trip.plannedVolumeM3 != null ? `, ${Number(trip.plannedVolumeM3)} m³` : ''}</Fact>
            <Fact name="Speed limit">{num(trip.maxSpeedKmph, ' km/h')}</Fact>
            <Fact name="Fare">{num(trip.actualFare)}</Fact>
          </dl>
        </section>

        <section className={`${card} ${tempOut ? 'ring-2 ring-red-300' : ''}`}>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Thermometer className="h-5 w-5 text-sky-700" />Temperature</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact name="Allowed range">{range}</Fact>
            <Fact name="Target">{trip.requiredTemperatureC == null ? '-' : fmtTemp(trip.requiredTemperatureC)}</Fact>
            <Fact name="Latest reading">{temp
              ? <><span className={tempOut ? 'text-red-700' : 'text-emerald-700'}>{fmtTemp(temp.temperatureC)}</span> <span className="font-normal text-slate-500">{tempOut ? 'out of range' : 'in range'}</span></>
              : 'No reading yet'}</Fact>
            <Fact name="Reading time">{temp ? when(temp.capturedAt) : '-'}</Fact>
          </dl>
          {(trip.openTemperatureAlerts || 0) > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{trip.openTemperatureAlerts} open temperature alert{trip.openTemperatureAlerts === 1 ? '' : 's'} on this trip.{internal && <> <Link to="/excursions" className="underline">Open Temperature Alerts</Link></>}</span></p>}
        </section>
      </div>
    </div>

    {/* REQ-TRK-002, 003, 004, 006, 008, 009: position sources, customer links, stops and waiting, route, e-way bills, reefer unit. */}
    <TripTrackingPanel tripId={trip.id} refreshKey={timelineKey} />
    <CompartmentTempsPanel tripId={trip.id} />{/* REQ-CC-012: live temperature per compartment; shows nothing for a truck without compartments or before script 66 */}
    {/* REQ-CC-004: pre-cooling and loading checklist, and Start Trip. */}
    <TripChecklistPanel tripId={trip.id} refreshKey={checklistKey} onChanged={() => { void load(true); refresh('checklist'); }}
      onStarted={text => { setMsg({ ok: true, text }); void load(true); refresh(''); }} />
    {/* REQ-GOV-009: what Start Trip will find, the Manager's approval before the start, and the checks saved with the trip. Staff only. */}
    {internal && <GovTripChecksPanel tripId={trip.id} planned={['PLANNED', 'SCHEDULED'].includes(String(trip.status || '').toUpperCase())} refreshKey={statusKey} />}
    {/* REQ-TRP-003: the drops of the trip and their proof of delivery. */}
    <TripDeliveriesPanel tripId={trip.id} refreshKey={deliveryKey} onChanged={() => { setMsg(null); void load(true); refresh('delivery'); }} />
    {/* REQ-TRP-007 / REQ-TRP-006: fuel, kilometres per litre and the expenses of the trip. Staff only. */}
    {internal && <TripCostsPanel tripId={trip.id} refreshKey={costsKey} />}
    {internal && <TripTollsPanel tripId={trip.id} refreshKey={costsKey} />}
    {/* REQ-CC-005: door and reefer events, planned stops, timeline. */}
    <TripTimelinePanel tripId={trip.id} refreshKey={timelineKey} onChanged={() => { void load(true); refresh('timeline'); }} />

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><History className="h-5 w-5 text-sky-700" />Status changes</h2>
      {trip.historyReady === false
        ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">The history table is not in the database yet. Run reftech_core/database_v2/15_trip_status_history.sql on reftech_operational; until then the trip cannot be completed or cancelled.</p>
        : (trip.history || []).length === 0
          ? <p className="mt-3 text-sm text-slate-500">No status change has been recorded for this trip.</p>
          : <table className="mt-3 w-full min-w-[700px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">When</th><th>Action</th><th>By</th><th>From → To</th><th>Odometer</th><th>Reason or note</th></tr></thead>
            <tbody>{(trip.history || []).map(h => <tr key={h.id} className="border-t align-top">
              <td className="whitespace-nowrap p-2">{when(h.createdAt)}</td>
              <td className="font-semibold">{title(h.action)}</td>
              <td>{h.actionBy || '-'}</td>
              <td className="whitespace-nowrap">{h.fromStatus === h.toStatus ? title(h.toStatus) : <>{title(h.fromStatus)} → {title(h.toStatus)}</>}</td>
              <td className="whitespace-nowrap">{h.odometerKm != null ? `${Number(h.odometerKm).toLocaleString('en-IN')} km` : '-'}</td>
              <td className="py-2 pr-2">{h.reason || '-'}</td>
            </tr>)}</tbody>
          </table>}
    </section>
  </>;
}
