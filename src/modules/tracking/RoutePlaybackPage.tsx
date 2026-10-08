/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-004 -- Route Playback: open the route of any trip, running or finished, and play it back with the speed
// and the temperature at each point, the stops, and what happened on the way (route events, door and reefer
// events, alerts). Staff see every trip; a Partner login its own; a driver the trips he drives.
// Positions sent after "Complete trip" are refused, so a finished route stays as it was.
// Backend: GET /api/tracking/trips/{id}/route, GET /api/tracking/trips/recent (RouteHistoryController).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pause, Play, Route as RouteIcon, SkipBack } from 'lucide-react';
import { api } from '@/shared/services/api';
import { MapMarker, MapPoint } from '@/shared/services/liveMap';
import { Banner, Section, btnLight, errorText, input, td, th } from '@/shared/components/FormKit';
import { RouteMap } from './RouteMap';
import { minutesText, num, pill, sourceText, when } from './telematics';
import { fmtDistance, fmtTemp, fmtTempNumber, tempNow, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Point = { lat: number; lng: number; at: string; speed: number | null; source: string; temperature: number | null };
const KIND_TONE: Record<string, 'blue' | 'amber' | 'red'> = { ROUTE: 'blue', DEVICE: 'amber', ALERT: 'red' };

/** A small line chart of one value along the route, with the current point marked. */
function Chart({ values, at, unit, lo, hi, colour }: { values: (number | null)[]; at: number; unit: string; lo?: number | null; hi?: number | null; colour: string }) {
  const known = values.filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));
  if (known.length < 2) return <p className="text-xs text-slate-400">No {unit.startsWith('°') ? 'temperature' : 'speed'} along this route.</p>;
  let min = Math.min(...known), max = Math.max(...known);
  if (lo != null) min = Math.min(min, lo);
  if (hi != null) max = Math.max(max, hi);
  if (max - min < 1) { max += 0.5; min -= 0.5; }
  const W = 600, H = 90, x = (i: number) => (i / Math.max(1, values.length - 1)) * W, y = (v: number) => H - ((v - min) / (max - min)) * H;
  let d = '', pen = false;
  values.forEach((v, i) => { if (v === null || v === undefined) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
  return <svg viewBox={`0 0 ${W} ${H + 14}`} className="h-28 w-full">
    {lo != null && <line x1={0} x2={W} y1={y(lo)} y2={y(lo)} stroke="#f59e0b" strokeDasharray="4 4" />}
    {hi != null && <line x1={0} x2={W} y1={y(hi)} y2={y(hi)} stroke="#ef4444" strokeDasharray="4 4" />}
    <path d={d} fill="none" stroke={colour} strokeWidth={2} />
    <line x1={x(at)} x2={x(at)} y1={0} y2={H} stroke="#0f172a" strokeWidth={1} />
    <text x={2} y={H + 12} fontSize={10} fill="#64748b">{num(min, 1)} {unit}</text>
    <text x={W - 2} y={10} fontSize={10} fill="#64748b" textAnchor="end">{num(max, 1)} {unit}</text>
  </svg>;
}

export function RoutePlaybackPage() {
  const [params, setParams] = useSearchParams();
  const tripId = params.get('trip');
  const [q, setQ] = useState(''), [trips, setTrips] = useState<any[]>([]);
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [loading, setLoading] = useState(false);
  const [i, setI] = useState(0), [playing, setPlaying] = useState(false), [rate, setRate] = useState(4);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => api(`/api/tracking/trips/recent?days=60${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(x => setTrips(Array.isArray(x) ? x : [])).catch(() => setTrips([])), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!tripId) { setD(null); return; }
    setLoading(true); setErr(''); setPlaying(false); setI(0);
    api(`/api/tracking/trips/${tripId}/route?max=2000`).then(setD).catch(e => { setD(null); setErr(errorText(e, 'Could not load the route')); }).finally(() => setLoading(false));
  }, [tripId]);

  const points: Point[] = useMemo(() => (d?.points || []).map((p: any) => ({ ...p, lat: Number(p.lat), lng: Number(p.lng), speed: p.speed == null ? null : Number(p.speed), temperature: p.temperature == null ? null : Number(p.temperature) })), [d]);
  const route: MapPoint[] = useMemo(() => points.map(p => [p.lat, p.lng] as MapPoint), [points]);
  const cur = points[Math.min(i, Math.max(0, points.length - 1))];

  useEffect(() => {
    if (!playing) { if (timer.current) window.clearInterval(timer.current); timer.current = null; return; }
    timer.current = window.setInterval(() => setI(n => { if (n >= points.length - 1) { setPlaying(false); return n; } return Math.min(points.length - 1, n + rate); }), 250);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, rate, points.length]);

  const markers: MapMarker[] = useMemo(() => {
    const m: MapMarker[] = [];
    (d?.stops || []).forEach((s: any, k: number) => { if (s.latitude != null) m.push({ id: -1 - k, lat: Number(s.latitude), lng: Number(s.longitude), colour: '#64748b', label: String(k + 1), title: `${s.name} (${s.stopType})` }); });
    if (cur) m.push({ id: 1, lat: cur.lat, lng: cur.lng, colour: '#0369a1', label: 'T', title: `${when(cur.at)}${cur.speed != null ? `, ${cur.speed} km/h` : ''}`, selected: true });
    return m;
  }, [d, cur]);

  const jumpTo = (at: string) => {
    const t = new Date(at).getTime();
    let best = 0;
    points.forEach((p, k) => { if (Math.abs(new Date(p.at).getTime() - t) < Math.abs(new Date(points[best].at).getTime() - t)) best = k; });
    setI(best); setPlaying(false);
  };
  const s = d?.summary || {};

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><RouteIcon className="h-8 w-8 text-sky-700" />Route Playback</h1>
    <p className="text-slate-600">Pick a trip, running or finished, and play its route back with the speed and temperature at each point.</p>
    <Banner error={err} />

    <Section title="Trip" right={d ? <Link to={`/trips/${d.trip.id}`} className="text-sm font-semibold text-sky-700 hover:underline">Open trip details</Link> : undefined}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Search trip or truck<input className={`${input} block w-64`} value={q} onChange={e => setQ(e.target.value)} placeholder="TRP-... or OD02..." /></label>
        <label className="text-sm">Trip<select className={`${input} block min-w-[22rem]`} value={tripId || ''} onChange={e => setParams(e.target.value ? { trip: e.target.value } : {})}>
          <option value="">Choose a trip</option>
          {tripId && !trips.some(t => String(t.id) === tripId) && <option value={tripId}>{d?.trip?.tripNumber || `Trip ${tripId}`}</option>}
          {trips.map(t => <option key={t.id} value={t.id}>{t.tripNumber} · {t.vehicleNumber || '-'} · {t.from} to {t.to} · {t.status} · {t.positions} positions</option>)}
        </select></label>
      </div>
    </Section>

    {loading && <p className="mt-4 text-slate-500">Loading the route...</p>}
    {d && points.length === 0 && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">Trip {d.trip.tripNumber} has no position yet.</p>}
    {d && points.length > 0 && <>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[['Distance', `${fmtDistance(s.km)}`], ['Moving', minutesText(s.movingMinutes)], ['Stopped', minutesText(s.stoppedMinutes)], ['No positions', minutesText(s.gapMinutes)],
          ['Top speed', `${num(s.maxSpeed)} km/h`], ['Average moving', s.averageSpeed != null ? `${num(s.averageSpeed)} km/h` : '-']].map(([k, v]) =>
          <div key={k} className="rounded-xl bg-white p-3 shadow-sm"><div className="text-slate-500">{k}</div><div className="text-lg font-bold">{v}</div></div>)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RouteMap route={route} markers={markers} fitKey={tripId || ''} />
          <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button className={btnLight} onClick={() => { setI(0); setPlaying(false); }} title="Back to the start"><SkipBack className="h-4 w-4" /></button>
              <button className={btnLight} onClick={() => { if (i >= points.length - 1) setI(0); setPlaying(!playing); }}>{playing ? <><Pause className="mr-1 inline h-4 w-4" />Pause</> : <><Play className="mr-1 inline h-4 w-4" />Play</>}</button>
              <label className="text-sm">Speed <select className={input} value={rate} onChange={e => setRate(Number(e.target.value))}>
                {[1, 4, 10, 25].map(r => <option key={r} value={r}>{r === 1 ? 'slow' : r === 4 ? 'normal' : r === 10 ? 'fast' : 'fastest'}</option>)}</select></label>
              <span className="text-sm text-slate-600">Point {i + 1} of {points.length}{d.thinned ? ` (of ${s.positions} positions)` : ''}</span>
            </div>
            <input type="range" min={0} max={points.length - 1} value={i} onChange={e => { setI(Number(e.target.value)); setPlaying(false); }} className="mt-3 w-full" aria-label="Position on the route" />
            {cur && <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
              <div><span className="text-slate-500">Time</span><div className="font-semibold">{when(cur.at)}</div></div>
              <div><span className="text-slate-500">Speed</span><div className="font-semibold">{cur.speed != null ? `${cur.speed} km/h` : '-'}</div></div>
              <div><span className="text-slate-500">Temperature</span><div className={`font-semibold ${cur.temperature != null && ((d.trip.tempMax != null && cur.temperature > Number(d.trip.tempMax)) || (d.trip.tempMin != null && cur.temperature < Number(d.trip.tempMin))) ? 'text-red-700' : ''}`}>{cur.temperature != null ? fmtTemp(cur.temperature) : '-'}</div></div>
              <div><span className="text-slate-500">Source</span><div className="font-semibold">{sourceText(cur.source)}</div></div>
            </div>}
            <div className="mt-3 text-xs font-semibold text-slate-500">Speed (km/h)</div>
            <Chart values={points.map(p => p.speed)} at={i} unit="km/h" colour="#0369a1" />
            <div className="mt-1 text-xs font-semibold text-slate-500">Temperature ({unitNow('temp')}){d.trip.tempMin != null || d.trip.tempMax != null ? `, allowed ${d.trip.tempMin == null ? '-' : fmtTempNumber(d.trip.tempMin)} to ${d.trip.tempMax == null ? '-' : fmtTempNumber(d.trip.tempMax)}` : ''}</div>
            <Chart values={points.map(p => (p.temperature == null ? null : tempNow(Number(p.temperature))))} at={i} unit={unitNow('temp')} lo={d.trip.tempMin == null ? null : tempNow(Number(d.trip.tempMin))} hi={d.trip.tempMax == null ? null : tempNow(Number(d.trip.tempMax))} colour="#059669" />
          </div>
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">{d.trip.tripNumber}</h2>
            <p className="text-sm text-slate-600">{d.trip.vehicleNumber || '-'} · {d.trip.from} to {d.trip.to} · {d.trip.stage || d.trip.status}</p>
            <p className="mt-1 text-sm text-slate-600">From {when(s.firstAt)} to {when(s.lastAt)}. Sources: {Object.entries(s.sources || {}).map(([k, v]) => `${sourceText(k)} ${v}`).join(', ')}</p>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">On the way</h2>
            <div className="mt-2 max-h-[60vh] overflow-y-auto"><table className="w-full text-sm"><tbody>
              {(d.events || []).length === 0 && <tr><td className="p-4 text-center text-slate-400">Nothing recorded.</td></tr>}
              {(d.events || []).map((e: any, k: number) => <tr key={k} className="cursor-pointer border-t border-slate-100 hover:bg-sky-50" onClick={() => e.at && jumpTo(e.at)}>
                <td className={`${td} whitespace-nowrap`}>{when(e.at)}</td>
                <td className={td}>{pill(KIND_TONE[e.kind] || 'grey', String(e.type).replace(/_/g, ' ').toLowerCase())}<div className="text-xs text-slate-600">{e.text}</div></td>
              </tr>)}
            </tbody></table></div>
          </section>
        </div>
      </div>
    </>}
    {!tripId && <Section title="Recent trips"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Lane</th><th className={th}>Status</th><th className={th}>Positions</th></tr></thead>
      <tbody>{trips.slice(0, 30).map(t => <tr key={t.id} className="cursor-pointer border-t border-slate-200 hover:bg-sky-50" onClick={() => setParams({ trip: String(t.id) })}>
        <td className={`${td} font-semibold text-sky-700`}>{t.tripNumber}</td><td className={td}>{t.vehicleNumber || '-'}</td><td className={td}>{t.from} to {t.to}</td><td className={td}>{t.status}</td><td className={td}>{t.positions}</td>
      </tr>)}</tbody>
    </table></div></Section>}
  </>;
}
