/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-002 -- Live Tracking: the running trucks on a map, each coloured by its temperature state.
//
//   Red     an open temperature alert (excursion) on the trip
//   Amber   the latest reading is outside the allowed range and is being watched, no alert yet
//   Green   the latest reading is inside the allowed range
//   Grey    no reading yet, no reading for a long time, or a trip without temperature control
//
// Selecting a truck (on the map or in the list) shows its trip, driver, speed, temperature and the route
// it has driven so far. The page reads the positions again every 30 seconds, so a position sent by the
// driver's phone is on the map within a minute.
//
// Which map: Google Maps when VITE_GOOGLE_MAPS_API_KEY is set in .env, otherwise OpenStreetMap (no key
// needed). The page says which one is used. See shared/services/liveMap.ts.
//
// Who sees what is decided on the server: Admin all running trips, Manager and Employee the trips of
// their drivers, a Partner login its own trips.
//
// Backend: /api/tracking/live and /api/tracking/trips/{id}/trail (TrackingController).
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Gauge, MapPin, Navigation, RefreshCw, Search, Thermometer, Truck, UserRound } from 'lucide-react';
import { api } from '@/shared/services/api';
import { LiveMap, MapMarker, MapPoint, MapProvider, openMap, plannedProvider } from '@/shared/services/liveMap';
import { fmtDateTime, fmtTemp, fmtTempRange, fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

type Position = { latitude: number; longitude: number; speedKmph?: number | null; heading?: number | null; source?: string | null; capturedAt: string; ageSeconds: number; stale: boolean; ageText: string };
type Temperature = { temperatureC?: number | null; capturedAt?: string | null; minC?: number | null; maxC?: number | null; state: string; text: string };
type TruckRow = {
  tripId: number; tripNumber: string; stage: string; stageLabel: string; partnerName?: string | null; vehicleId?: number | null; vehicleNumber?: string | null;
  driverName?: string | null; driverMobile?: string | null; sourceCity?: string | null; destinationCity?: string | null; expectedArrivalAt?: string | null; maxSpeedKmph?: number | null;
  etaAt?: string | null; etaDelayMinutes?: number | null; etaLate?: boolean;   // REQ-TRP-005
  position: Position | null; temperature: Temperature; colour: Colour; openAlerts: number;
};
type Colour = 'RED' | 'AMBER' | 'GREEN' | 'GREY';
type Live = { asOf: string; ready: boolean; message?: string; running: number; withPosition: number; counts: Record<Colour, number>; positionStaleMinutes: number; trucks: TruckRow[] };

const REFRESH_SECONDS = 30;
const COLOUR: Record<Colour, { hex: string; name: string; meaning: string; chip: string; dot: string }> = {
  RED: { hex: '#dc2626', name: 'Red', meaning: 'Open temperature alert', chip: 'border-red-300 bg-red-50 text-red-800', dot: 'bg-red-600' },
  AMBER: { hex: '#f59e0b', name: 'Amber', meaning: 'Outside the range, being watched', chip: 'border-amber-300 bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  GREEN: { hex: '#16a34a', name: 'Green', meaning: 'Temperature in range', chip: 'border-emerald-300 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  GREY: { hex: '#64748b', name: 'Grey', meaning: 'No reading, or no temperature control', chip: 'border-slate-300 bg-slate-50 text-slate-700', dot: 'bg-slate-500' },
};
const ORDER: Colour[] = ['RED', 'AMBER', 'GREEN', 'GREY'];
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const clock = (v?: string | null) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? fmtTime(d) : '-'; };
const range = (t: Temperature) => t.minC == null && t.maxC == null ? 'not set' : fmtTempRange(t.minC, t.maxC);
const shortName = (v?: string | null) => { const s = String(v || '').replace(/\s+/g, ''); return s.length > 4 ? s.slice(-4) : s || '?'; };
// REQ-TRK-002: SIM, LINK and FASTAG positions of hired trucks; REEFER from the reefer unit.
const SOURCE: Record<string, string> = { PHONE: "driver's phone", DEVICE: 'vehicle tracker', MANUAL: 'entered by hand', SIM: 'SIM (mobile operator)', LINK: "driver's phone link", FASTAG: 'FASTag toll crossing', REEFER: 'reefer unit' };

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</dt><dd className="mt-0.5 font-semibold text-slate-900">{children}</dd></div>;
}

export function LiveTrackingPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const [params, setParams] = useSearchParams();
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(() => { const t = Number(params.get('trip')); return t > 0 ? t : null; });
  const [trail, setTrail] = useState<{ tripId: number; points: MapPoint[]; total: number; shown: number } | null>(null);
  const [filter, setFilter] = useState<Colour | ''>('');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState<MapProvider | ''>('');
  const [mapNote, setMapNote] = useState('');       // why OpenStreetMap is shown although a key is set
  const [tileNote, setTileNote] = useState('');     // the map background could not be loaded
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LiveMap | null>(null);
  const fitted = useRef(false);                     // the map is fitted to the trucks once, then left where the user put it
  const focused = useRef<number | null>(null);      // the truck the map was last centred on
  const selectRef = useRef<(id: number) => void>(() => {});
  const planned = useMemo(plannedProvider, []);

  // ---------------------------------------------------------------- data
  const load = useCallback(async () => {
    setBusy(true);
    try { setLive(await api('/api/tracking/live')); setError(''); }
    catch (x) { setError(x instanceof Error ? x.message : 'The live positions could not be loaded'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, REFRESH_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const select = useCallback((id: number | null) => {
    setSelected(id);
    setParams(id ? { trip: String(id) } : {}, { replace: true });
  }, [setParams]);
  selectRef.current = id => select(id);

  // The route so far of the selected truck; read again whenever the positions are read again.
  const asOf = live?.asOf;
  useEffect(() => {
    if (!selected) { setTrail(null); return; }
    let gone = false;
    api(`/api/tracking/trips/${selected}/trail?max=600`)
      .then((r: { points: [number, number, number, number | null][]; total: number; shown: number }) => {
        if (!gone) setTrail({ tripId: selected, points: (r.points || []).map(p => [Number(p[0]), Number(p[1])] as MapPoint), total: r.total, shown: r.shown });
      })
      .catch(() => { if (!gone) setTrail({ tripId: selected, points: [], total: 0, shown: 0 }); });
    return () => { gone = true; };
  }, [selected, asOf]);

  // ---------------------------------------------------------------- the map
  useEffect(() => {
    if (!box.current) return;
    let gone = false;
    const handlers = {
      onSelect: (id: number) => selectRef.current(id),
      onNote: (text: string) => setTileNote(text),
      onReplaced: (next: LiveMap, why: string) => { map.current = next; fitted.current = false; focused.current = null; setProvider(next.provider); setMapNote(why); },
    };
    openMap(box.current, handlers).then(r => {
      if (gone) { r.map.destroy(); return; }
      map.current = r.map; setProvider(r.map.provider); setMapNote(r.note);
    });
    return () => { gone = true; map.current?.destroy(); map.current = null; };
  }, []);

  const trucks = live?.trucks || [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    // red first, then amber, green, grey; inside a colour by truck number
    return trucks.filter(t => (!filter || t.colour === filter)
      && (!q || [t.vehicleNumber, t.tripNumber, t.driverName, t.partnerName, t.sourceCity, t.destinationCity].some(v => String(v || '').toLowerCase().includes(q))))
      .sort((x, y) => ORDER.indexOf(x.colour) - ORDER.indexOf(y.colour) || String(x.vehicleNumber || '').localeCompare(String(y.vehicleNumber || '')));
  }, [trucks, filter, search]);
  const current = trucks.find(t => t.tripId === selected) || null;

  // A new filter shows its trucks: the map is fitted to them again (unless one truck is selected).
  useEffect(() => { fitted.current = false; }, [filter]);

  // Put the trucks, and the route of the selected one, on the map. Runs when the data, the filter, the selection or the map changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const withPosition = visible.filter(t => t.position);
    const markers: MapMarker[] = withPosition.map(t => ({
      id: t.tripId, lat: Number(t.position!.latitude), lng: Number(t.position!.longitude), colour: COLOUR[t.colour].hex, label: shortName(t.vehicleNumber),
      title: `${t.vehicleNumber || 'Truck'} · ${t.tripNumber} · ${t.temperature.text}`, stale: t.position!.stale, selected: t.tripId === selected,
    }));
    m.setMarkers(markers);
    const line = trail && trail.tripId === selected ? trail.points : [];
    m.setTrail(line);
    if (current?.position && focused.current !== current.tripId) {
      focused.current = current.tripId; fitted.current = true;
      if (line.length > 1) m.fit(line); else m.focus(Number(current.position.latitude), Number(current.position.longitude));
    } else if (!selected && !fitted.current && markers.length > 0) {
      fitted.current = true;
      m.fit(markers.map(x => [x.lat, x.lng] as MapPoint));
    }
    if (!selected) focused.current = null;
  }, [visible, selected, trail, current, provider]);

  // When the route of the selected truck arrives after the truck was centred, show the whole route once.
  const routeShown = useRef<number | null>(null);
  useEffect(() => {
    if (!trail || trail.tripId !== selected || trail.points.length < 2 || routeShown.current === selected) return;
    routeShown.current = selected;
    map.current?.fit(trail.points);
  }, [trail, selected, provider]);
  useEffect(() => { if (!selected) routeShown.current = null; }, [selected]);

  function showAll() {
    select(null); fitted.current = true;
    const pts = visible.filter(t => t.position).map(t => [Number(t.position!.latitude), Number(t.position!.longitude)] as MapPoint);
    map.current?.fit(pts);
  }

  const pos = current?.position || null;
  const temp = current?.temperature;
  const overSpeed = pos?.speedKmph != null && current?.maxSpeedKmph != null && Number(pos.speedKmph) > Number(current.maxSpeedKmph);
  const noPosition = trucks.filter(t => !t.position).length;

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Navigation className="h-7 w-7 text-sky-700" />Live Tracking</h1>
        <p className="mt-1 text-slate-600">Running trucks on the map, coloured by temperature state. Positions are read again every {REFRESH_SECONDS} seconds.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600" data-testid="live-updated">Updated {clock(live?.asOf)}</span>
        <button type="button" onClick={() => { void load(); }} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button>
      </div>
    </div>

    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 font-semibold text-red-800">{error}</p>}
    {live && !live.ready && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{live.message}</p>}

    {/* ---------------------------------------------------------------- colour counts, also the filter */}
    <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by temperature state">
      <button type="button" onClick={() => setFilter('')} aria-pressed={!filter} className={`rounded-xl border px-3 py-2 text-sm font-bold ${!filter ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'}`}>All running <span data-testid="count-all">{live?.running ?? 0}</span></button>
      {ORDER.map(c => <button key={c} type="button" onClick={() => setFilter(filter === c ? '' : c)} aria-pressed={filter === c} title={COLOUR[c].meaning}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${COLOUR[c].chip} ${filter === c ? 'ring-2 ring-sky-600' : ''}`}>
        <span className={`h-3 w-3 rounded-full ${COLOUR[c].dot}`} />{COLOUR[c].meaning} <span data-testid={`count-${c}`}>{live?.counts?.[c] ?? 0}</span></button>)}
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      {/* ---------------------------------------------------------------- map */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-sky-50/70 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><MapPin className="h-5 w-5 text-sky-700" />Map</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span data-testid="map-provider" data-provider={provider} className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200" title={provider === 'OSM' && !mapNote ? `OpenStreetMap is used because ${planned.reason}.` : undefined}>
              {provider === 'GOOGLE' ? 'Google Maps' : provider === 'OSM' ? 'OpenStreetMap' : 'Loading the map...'}</span>
            <button type="button" onClick={showAll} className="font-bold text-sky-700 hover:underline">Show all trucks</button>
          </div>
        </div>
        {provider === 'OSM' && !mapNote && planned.provider === 'OSM' && <p className="border-b bg-slate-50 px-4 py-2 text-xs text-slate-600" data-testid="map-reason">OpenStreetMap is used because {planned.reason}. Put the key in the portal's .env file to get Google Maps.</p>}
        {mapNote && <p className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900" data-testid="map-note"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{mapNote}</p>}
        {tileNote && <p className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900" data-testid="tile-note"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{tileNote}</p>}
        <div className="relative h-[68vh] min-h-[460px] w-full" ref={box} data-testid="live-map" aria-label="Map of the running trucks" />
        <div className="border-t px-4 py-3 text-sm text-slate-600">
          {trucks.length === 0
            ? 'No trip is running now. A truck appears here when its trip has started and a position was received.'
            : <>{live?.withPosition ?? 0} of {live?.running ?? 0} running truck{(live?.running ?? 0) === 1 ? '' : 's'} on the map.{noPosition > 0 ? ` ${noPosition} ha${noPosition === 1 ? 's' : 've'} not sent a position yet.` : ''} A truck with a dashed, pale marker has not sent a position for {live?.positionStaleMinutes ?? 10} minutes or more.</>}
        </div>
      </section>

      {/* ---------------------------------------------------------------- selected truck, and the list */}
      <div className="space-y-4">
        {current && <section className="rounded-2xl bg-white p-5 shadow-sm ring-2 ring-sky-200" data-testid="truck-details">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Truck className="h-5 w-5 text-sky-700" />{current.vehicleNumber || 'Truck'}</h2>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${COLOUR[current.colour].chip}`}><span className={`h-2.5 w-2.5 rounded-full ${COLOUR[current.colour].dot}`} />{COLOUR[current.colour].name}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact name="Trip"><Link to={`/trips/${current.tripId}`} className="text-sky-700 hover:underline">{current.tripNumber}</Link> <span className="font-normal text-slate-500">{current.stageLabel}</span></Fact>
            <Fact name="Partner">{current.partnerName || '-'}</Fact>
            <Fact name="Driver"><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-slate-500" />{current.driverName || 'Not assigned'}</span>{current.driverMobile ? <><br /><span className="font-normal">{current.driverMobile}</span></> : null}</Fact>
            <Fact name="Route">{current.sourceCity || '-'} → {current.destinationCity || '-'}</Fact>
            <Fact name="Speed">{pos?.speedKmph != null
              ? <span className={overSpeed ? 'text-red-700' : ''}><Gauge className="mr-1 inline h-3.5 w-3.5" />{Number(pos.speedKmph)} km/h{current.maxSpeedKmph != null ? <span className="font-normal text-slate-500"> (limit {Number(current.maxSpeedKmph)})</span> : null}</span>
              : '-'}</Fact>
            <Fact name="Temperature">{temp?.temperatureC != null
              ? <span className={current.colour === 'RED' || temp.state === 'OUT_OF_RANGE' ? 'text-red-700' : ''}><Thermometer className="mr-1 inline h-3.5 w-3.5" />{fmtTemp(temp.temperatureC)}</span>
              : 'No reading'}<br /><span className="font-normal text-slate-500">allowed {temp ? range(temp) : '-'}</span></Fact>
            <Fact name="Temperature state">{temp?.text}{temp?.capturedAt ? <><br /><span className="font-normal text-slate-500">read {when(temp.capturedAt)}</span></> : null}</Fact>
            <Fact name="Last position">{pos ? <>{pos.ageText} ago{pos.stale ? <span className="text-amber-700"> (old)</span> : null}<br /><span className="font-normal text-slate-500">{when(pos.capturedAt)}{pos.source ? `, ${SOURCE[pos.source] || pos.source.toLowerCase()}` : ''}</span></> : 'No position received yet'}</Fact>
            <Fact name="Promised arrival">{when(current.expectedArrivalAt)}</Fact>
            {/* REQ-TRP-005: the arrival time calculated last from this position */}
            <Fact name="Expected now">{current.etaAt ? <span className={current.etaLate ? 'text-red-700' : ''}>{when(current.etaAt)}{current.etaLate ? ' (late)' : ''}</span> : '-'}</Fact>
            <Fact name="Route so far">{trail && trail.tripId === current.tripId ? (trail.total === 0 ? 'No position stored' : `${trail.total} position${trail.total === 1 ? '' : 's'}${trail.shown < trail.total ? `, ${trail.shown} drawn` : ''}`) : 'Loading...'}</Fact>
          </dl>
          {current.openAlerts > 0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{current.openAlerts} open alert{current.openAlerts === 1 ? '' : 's'} on this trip.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-bold">
            <Link to={`/trips/${current.tripId}`} className="text-sky-700 hover:underline">Open trip details</Link>
            {pos && <a href={`https://www.google.com/maps/search/?api=1&query=${pos.latitude},${pos.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">Open in Google Maps<ExternalLink className="h-3.5 w-3.5" /></a>}
            <button type="button" onClick={() => select(null)} className="text-slate-600 hover:underline">Close</button>
          </div>
        </section>}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Running trucks ({visible.length}{visible.length !== trucks.length ? ` of ${trucks.length}` : ''})</h2>
          <label className="relative mt-3 block"><span className="sr-only">Find a truck, trip, driver or partner</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Truck, trip, driver or partner" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900" />
          </label>
          <ul className="mt-3 max-h-[46vh] space-y-2 overflow-y-auto" data-testid="truck-list">
            {visible.map(t => <li key={t.tripId}>
              <button type="button" onClick={() => select(t.tripId)} data-trip={t.tripId} data-colour={t.colour} aria-pressed={t.tripId === selected}
                className={`w-full rounded-xl border p-3 text-left hover:border-sky-400 ${t.tripId === selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-slate-900"><span className={`h-3 w-3 shrink-0 rounded-full ${COLOUR[t.colour].dot}`} title={COLOUR[t.colour].meaning} />{t.vehicleNumber || 'Truck'}</span>
                  <span className="text-xs font-semibold text-slate-500">{t.tripNumber}</span>
                </div>
                <div className="mt-0.5 text-sm text-slate-700">{t.sourceCity || '-'} → {t.destinationCity || '-'} · {t.driverName || 'No driver'}</div>
                <div className="mt-0.5 text-xs text-slate-600">{t.temperature.temperatureC != null ? `${fmtTemp(t.temperature.temperatureC)} · ` : ''}{t.temperature.text} · {t.position ? <span className={t.position.stale ? 'font-semibold text-amber-700' : ''}>position {t.position.ageText} ago</span> : <span className="font-semibold text-amber-700">no position yet</span>}</div>
              </button>
            </li>)}
            {live && visible.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">{trucks.length === 0 ? 'No trip is running.' : 'No truck matches the filter.'}</li>}
            {!live && !error && <li className="p-4 text-center text-sm text-slate-500">Loading...</li>}
          </ul>
        </section>
      </div>
    </div>
  </>;
}
