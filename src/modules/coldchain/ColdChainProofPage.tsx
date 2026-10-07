/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-002 -- Cold-Chain Proof: the temperature graph of a trip with the allowed band, the summary
// (minimum, maximum, average, minutes out of range, excursions and actions) and the PDF certificate.
//
// Backend: /api/coldchain (ColdChainProofController). The page only reads; alerts are closed on the
// Temperature Alerts page (REQ-CC-001). /cold-chain lists the trips, /cold-chain?trip=<id> opens one.
// The graph is plain SVG, so no chart package is added to the project.
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, FileCheck2, RefreshCw, Search } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { fmtDateTime, fmtTemp, fmtTempNumber, fmtTempRange, fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

type Result = 'WITHIN_RANGE' | 'SHORT_DEVIATION' | 'EXCURSION' | 'NO_LIMITS' | 'NO_DATA';
type TripRow = {
  id: number; tripNumber?: string; partnerName?: string; vehicleNumber?: string; sourceCity?: string; destinationCity?: string;
  status?: string; plannedStartAt?: string | null; actualCompletedAt?: string | null;
  requiredTempMinC?: number | null; requiredTempMaxC?: number | null;
  readingCount: number; minC?: number | null; maxC?: number | null; lastReadingAt?: string | null;
  alertCount: number; quickResult: Result; quickResultLabel: string;
};
type Point = { t: string; c: number; out: boolean; flag?: string | null };   // REQ-CC-010: flag CAL_OVERDUE
type Period = {
  kind: 'EXCURSION' | 'SHORT_DEVIATION'; direction: 'HIGH' | 'LOW'; startedAt?: string | null; endedAt?: string | null;
  ongoing?: boolean; endedBy?: string; minutes: number; peakC?: number | null; limitC?: number | null;
  alertId?: number | null; alertStatus?: string | null; cause?: string | null; causeNotes?: string | null;
  correctiveAction?: string | null; acknowledgedBy?: string | null; resolvedBy?: string | null; resolvedAt?: string | null; escalatedTo?: string | null;
};
type Proof = {
  certificateNumber: string; final: boolean; result: Result; resultLabel: string; resultText: string; generatedAt?: string;
  trip: {
    id: number; tripNumber?: string; partnerName?: string; vehicleNumber?: string; driverName?: string | null;
    sourceCity?: string; destinationCity?: string; status?: string; plannedStartAt?: string | null; actualCompletedAt?: string | null;
    requiredTempMinC?: number | null; requiredTempMaxC?: number | null; temperatureProfileName?: string | null;
  };
  stats: {
    readingCount: number; firstReadingAt?: string | null; lastReadingAt?: string | null; minC?: number | null; maxC?: number | null; avgC?: number | null;
    monitoredMinutes: number; minutesOutOfRange?: number | null; percentInRange?: number | null; excursionCount: number;
    longestExcursionMinutes: number; shortDeviationCount: number; shortDeviationMinutes: number; dataGapCount: number; dataGapMinutes: number; sensors: string[];
    rejectedReadings?: number;   // REQ-CC-007: readings refused as impossible
    flaggedReadings?: number;    // REQ-CC-010: readings by a sensor whose calibration was overdue
  };
  settings: { sustainedMinutes: number; maxGapMinutes: number };
  periods: Period[]; points: Point[];
  gaps?: { from: string; to: string; minutes: number; sensor?: string | null }[];   // REQ-CC-007: stretches without readings
  // REQ-CC-012: the compartments of a multi-temperature truck; with compartmentId the proof is of that compartment only.
  compartmentId?: number | null; compartment?: { id: number; code: string; label: string; minC?: number | null; maxC?: number | null } | null;
  compartments?: { id: number; code: string; label: string; readings: number }[];
};
type Filter = 'ALL' | 'COMPLETED' | 'RUNNING';

const cell = 'px-2.5 py-3';
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const degrees = (v?: number | null) => fmtTemp(v);
const range = (min?: number | null, max?: number | null) =>
  min == null && max == null ? 'not set' : fmtTempRange(min, max);
const duration = (min?: number | null) => {
  const m = Number(min || 0);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const title = (s?: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '-');
const TONE: Record<Result, { chip: string; banner: string }> = {
  WITHIN_RANGE: { chip: 'bg-emerald-100 text-emerald-800', banner: 'bg-emerald-700' },
  SHORT_DEVIATION: { chip: 'bg-amber-100 text-amber-800', banner: 'bg-amber-600' },
  EXCURSION: { chip: 'bg-red-100 text-red-800', banner: 'bg-red-700' },
  NO_LIMITS: { chip: 'bg-slate-200 text-slate-700', banner: 'bg-slate-600' },
  NO_DATA: { chip: 'bg-slate-200 text-slate-700', banner: 'bg-slate-600' },
};

export function ColdChainProofPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const [params, setParams] = useSearchParams();
  const trip = params.get('trip');
  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;
  return trip
    ? <TripProof id={trip} onBack={() => setParams({})} />
    : <TripList onOpen={id => setParams({ trip: String(id) })} />;
}

// ---------------------------------------------------------------------------------------------- list
function TripList({ onOpen }: { onOpen: (id: number) => void }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TripRow[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      api(`/api/coldchain/trips?status=${filter}${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''}`)
        .then((list: TripRow[]) => { if (live) { setRows(Array.isArray(list) ? list : []); setError(''); } })
        .catch((x: unknown) => { if (live) setError(x instanceof Error ? x.message : 'Could not load the trips'); })
        .finally(() => { if (live) setLoaded(true); });
    }, search ? 300 : 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [filter, search]);

  const tab = (f: Filter, text: string) => (
    <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === f ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{text}</button>
  );

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><FileCheck2 className="h-8 w-8 text-sky-700" />Cold-Chain Proof</h1>
    <p className="text-slate-600">Temperature graph and certificate for each trip. Open a trip to see the graph and download the PDF certificate.</p>
    {error && <div className="my-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</div>}

    <div className="mt-5 flex flex-wrap items-center gap-2">
      {tab('ALL', 'All trips')}{tab('COMPLETED', 'Completed')}{tab('RUNNING', 'Running')}
      <label className="relative ml-auto block w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Trip, truck or partner" aria-label="Search trips"
          className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-slate-900" />
      </label>
    </div>

    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600">
            <th className={cell}>Trip</th><th className={cell}>Truck</th><th className={cell}>Route</th>
            <th className={cell}>Status</th><th className={cell}>Allowed range</th><th className={cell}>Readings</th><th className={cell}>Lowest / highest</th>
            <th className={cell}>Result</th><th className={cell}></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">{loaded ? 'No trips found.' : 'Loading...'}</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className={`${cell} whitespace-nowrap`}><div className="font-semibold">{r.tripNumber || r.id}</div><div className="text-xs text-slate-500">{r.partnerName || '-'}</div></td>
                <td className={`${cell} whitespace-nowrap`}>{r.vehicleNumber || '-'}</td>
                <td className={`${cell} whitespace-nowrap`}>{r.sourceCity || '-'} → {r.destinationCity || '-'}</td>
                <td className={`${cell} whitespace-nowrap`}>{title(r.status)}{r.actualCompletedAt ? <div className="text-xs text-slate-500">{when(r.actualCompletedAt)}</div> : null}</td>
                <td className={`${cell} whitespace-nowrap`}>{range(r.requiredTempMinC, r.requiredTempMaxC)}</td>
                <td className={cell}>{r.readingCount}</td>
                <td className={`${cell} whitespace-nowrap`}>{r.readingCount ? `${fmtTemp(r.minC)} / ${fmtTemp(r.maxC)}` : '-'}</td>
                <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${TONE[r.quickResult]?.chip || ''}`}>{r.quickResultLabel}</span></td>
                <td className={`${cell} text-right`}><button onClick={() => onOpen(r.id)} className="whitespace-nowrap rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-800">View proof</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">The result in this list is a quick check. Open the trip for the exact figures. Up to 200 trips are shown, newest first.</p>
    </section>
  </>;
}

// ---------------------------------------------------------------------------------------------- one trip
function TripProof({ id, onBack }: { id: string; onBack: () => void }) {
  const [proof, setProof] = useState<Proof | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [comp, setComp] = useState('');   // REQ-CC-012: '' = whole truck, else a compartment id
  const compQ = comp ? `?compartmentId=${comp}` : '';

  const load = useCallback(async () => {
    try { setProof(await api(`/api/coldchain/trips/${encodeURIComponent(id)}${compQ}`)); setError(''); }
    catch (x) { setError(x instanceof Error ? x.message : 'Could not load the trip'); }
  }, [id, compQ]);

  useEffect(() => { setProof(null); void load(); }, [load]);
  // A running trip keeps receiving readings: refresh every minute until it is completed.
  useEffect(() => {
    if (!proof || proof.final) return;
    const timer = window.setInterval(() => { void load(); }, 60000);
    return () => window.clearInterval(timer);
  }, [proof, load]);

  async function download() {
    if (!proof) return;
    setBusy(true); setError('');
    try { await apiDownload(`/api/coldchain/trips/${proof.trip.id}/certificate.pdf${compQ}`, `ColdChainCertificate_${String(proof.trip.tripNumber || proof.trip.id).replace(/[^A-Za-z0-9-]/g, '_')}${proof.compartment ? `_${proof.compartment.code}` : ''}.pdf`); }
    catch (x) { setError(x instanceof Error ? x.message : 'Could not download the certificate'); }
    finally { setBusy(false); }
  }

  const back = <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline"><ArrowLeft className="h-4 w-4" />All trips</button>;
  if (error && !proof) return <>{back}<div className="my-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</div></>;
  if (!proof) return <>{back}<div className="p-10 text-slate-400">Loading...</div></>;

  const { trip, stats, periods } = proof;
  const tone = TONE[proof.result] || TONE.NO_DATA;
  const excursions = periods.filter(p => p.kind === 'EXCURSION');
  const tiles: [string, string][] = [
    ['Minimum', degrees(stats.minC)], ['Maximum', degrees(stats.maxC)],
    ['Average', stats.avgC == null ? '-' : fmtTemp(stats.avgC)],
    ['Out of range', stats.minutesOutOfRange == null ? '-' : `${stats.minutesOutOfRange} min`],
    ['Excursions', String(stats.excursionCount)],
    ['Time in range', stats.percentInRange == null ? '-' : `${Number(stats.percentInRange)} %`],
  ];
  const fact = (name: string, value: string) => <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</div><div className="font-semibold text-slate-900">{value}</div></div>;

  return <>
    {back}
    <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">Cold-chain proof: {trip.tripNumber || trip.id}</h1>
        <p className="text-slate-600">{trip.partnerName || '-'} · {trip.vehicleNumber || '-'} · {trip.sourceCity || '-'} → {trip.destinationCity || '-'}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => void load()} title="Refresh" className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button>
        <button onClick={download} disabled={busy || stats.readingCount === 0} className="flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"><Download className="h-4 w-4" />{busy ? 'Preparing...' : 'Download certificate (PDF)'}</button>
      </div>
    </div>
    {error && <div className="my-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</div>}
    {/* REQ-CC-012: a truck with compartments has a proof per compartment; the whole-truck PDF has one page per compartment. */}
    {(proof.compartments || []).length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-slate-700">Compartment:</span>
      {[['', 'Whole truck'] as [string, string]].concat((proof.compartments || []).map(c => [String(c.id), `${c.label} (${c.readings})`] as [string, string])).map(([k, t]) =>
        <button key={k || 'all'} onClick={() => setComp(k)} className={`rounded-xl px-3 py-1.5 font-semibold ${comp === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}
    </div>}

    {!proof.final && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>Provisional.</b> This trip is not completed yet ({title(trip.status)}). The figures change as readings arrive and the certificate is marked provisional.</div>}

    <div className={`mt-4 rounded-2xl p-4 text-white ${tone.banner}`}>
      <span className="text-lg font-black uppercase">{proof.resultLabel}</span>
      <span className="ml-3">{proof.resultText}</span>
    </div>

    <section className="mt-4 grid gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {fact('Allowed range', proof.compartment ? `${range(proof.compartment.minC, proof.compartment.maxC)} (${proof.compartment.label})` : range(trip.requiredTempMinC, trip.requiredTempMaxC) + (trip.temperatureProfileName ? ` (${trip.temperatureProfileName})` : ''))}{/* REQ-CC-003: profile name; REQ-CC-012: compartment range */}
      {fact('Trip status', proof.final ? `Completed ${when(trip.actualCompletedAt)}` : title(trip.status))}
      {fact('Driver', trip.driverName || '-')}
      {fact('Certificate no.', proof.certificateNumber)}
      {fact('Planned start', when(trip.plannedStartAt))}
      {fact('First reading', when(stats.firstReadingAt))}
      {fact('Last reading', when(stats.lastReadingAt))}
      {fact('Readings', `${stats.readingCount} over ${duration(stats.monitoredMinutes)}`)}
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(([name, value]) => <div key={name} className="rounded-2xl bg-white p-4 text-center shadow-sm"><div className="text-2xl font-black text-slate-900">{value}</div><div className="text-sm font-semibold text-slate-500">{name}</div></div>)}
    </section>

    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Temperature during the trip</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />Allowed range</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-5 bg-sky-700" />Inside</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-5 bg-red-600" />Outside</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-5 rounded-sm bg-red-100" />Excursion</span>
          {stats.dataGapCount > 0 && <span className="flex items-center gap-1"><i className="inline-block h-3 w-5 rounded-sm bg-slate-200" />No data</span>}
          {Number(stats.flaggedReadings) > 0 && <span className="flex items-center gap-1"><b className="text-amber-500">▲</b>Sensor calibration overdue</span>}{/* REQ-CC-010 */}
        </div>
      </div>
      <TemperatureChart proof={proof} />
      {stats.dataGapCount > 0 && <p className="mt-2 text-sm text-slate-600">No readings for {duration(stats.dataGapMinutes)} in {stats.dataGapCount} {stats.dataGapCount === 1 ? 'stretch' : 'stretches'} of more than {proof.settings.maxGapMinutes} minutes. That time is not counted as in range or out of range.</p>}
      {/* REQ-CC-007: each stretch without readings, as on the certificate, and the readings refused as impossible. */}
      {(proof.gaps || []).length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Stretches without readings ({(proof.gaps || []).length})</summary>
        <table className="mt-1 w-full max-w-2xl text-sm"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3">From</th><th className="py-1 pr-3">To</th><th className="py-1 pr-3">Length</th><th className="py-1">Sensor</th></tr></thead>
          <tbody>{(proof.gaps || []).map((g, i) => <tr key={i} className="border-t border-slate-100"><td className="py-1 pr-3">{when(g.from)}</td><td className="py-1 pr-3">{when(g.to)}</td><td className="py-1 pr-3">{duration(g.minutes)}</td><td className="py-1">{g.sensor || '-'}</td></tr>)}</tbody></table>
      </details>}
      {Number(stats.flaggedReadings) > 0 && <p className="mt-2 text-sm text-amber-800">{stats.flaggedReadings} reading{Number(stats.flaggedReadings) === 1 ? ' was' : 's were'} taken by a sensor whose calibration was overdue on that day (amber ▲). <Link to="/cold-chain/sensors" className="font-bold text-sky-700 hover:underline">Sensors &amp; Calibration</Link></p>}{/* REQ-CC-010 */}
      {Number(stats.rejectedReadings) > 0 && <p className="mt-2 text-sm text-amber-800">{stats.rejectedReadings} reading{Number(stats.rejectedReadings) === 1 ? ' was' : 's were'} refused as impossible (out of range or a jump no box can make) and are not counted.</p>}
    </section>

    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">Excursions and actions taken</h2>
      {periods.length === 0
        ? <p className="mt-2 text-slate-600">{stats.readingCount === 0 ? 'No temperature reading was received for this trip.' : 'Every reading stayed inside the allowed range.'}</p>
        : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead><tr className="bg-slate-50 text-left text-slate-600">
              <th className={cell}>Type</th><th className={cell}>Started</th><th className={cell}>Ended</th><th className={cell}>Duration</th><th className={cell}>Peak</th>
              <th className={cell}>Cause</th><th className={cell}>Corrective action</th><th className={cell}>Alert</th>
            </tr></thead>
            <tbody>{periods.map((p, i) => (
              <tr key={i} className="border-t border-slate-200 align-top">
                <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${p.kind === 'EXCURSION' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{p.kind === 'EXCURSION' ? 'Excursion' : 'Short deviation'}</span></td>
                <td className={`${cell} whitespace-nowrap`}>{when(p.startedAt)}</td>
                <td className={`${cell} whitespace-nowrap`}>{p.endedAt ? when(p.endedAt) : p.endedBy === 'END_OF_TRIP' ? 'Until last reading' : 'Still out of range'}</td>
                <td className={`${cell} whitespace-nowrap`}>{duration(p.minutes)}</td>
                <td className={`${cell} whitespace-nowrap`}>{degrees(p.peakC)}<div className="text-xs text-slate-500">{p.direction === 'HIGH' ? 'above' : 'below'} {degrees(p.limitC)}</div></td>
                <td className={cell}>{p.cause ? <>{p.cause}{p.causeNotes ? <div className="text-xs text-slate-500">{p.causeNotes}</div> : null}</> : p.kind === 'EXCURSION' ? <span className="text-slate-400">Not recorded yet</span> : <span className="text-slate-400">No alert under the {proof.settings.sustainedMinutes}-minute rule</span>}</td>
                <td className={cell}>{p.correctiveAction || <span className="text-slate-400">{p.kind === 'EXCURSION' ? 'Not recorded yet' : '-'}</span>}</td>
                <td className={`${cell} whitespace-nowrap`}>{p.alertId
                  ? <>{title(p.alertStatus)}{p.resolvedBy ? <div className="text-xs text-slate-500">by {p.resolvedBy}</div> : null}{p.escalatedTo ? <div className="text-xs text-slate-500">escalated to {p.escalatedTo}</div> : null}{p.alertStatus !== 'RESOLVED' ? <div><Link to="/excursions" className="text-xs font-bold text-sky-700 hover:underline">Open Temperature Alerts</Link></div> : null}</>
                  : '-'}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      <p className="mt-3 text-xs text-slate-500">
        How the figures are worked out: a reading counts until the next reading arrives. An excursion is {proof.settings.sustainedMinutes} minutes or more outside the allowed range;
        shorter periods are short deviations and raise no alert. Average is the simple average of all readings.
        {excursions.some(p => !p.cause) ? ' An excursion without a cause is still open on the Temperature Alerts page; close it there and the cause and action appear here and on the certificate.' : ''}
      </p>
    </section>
  </>;
}

// ---------------------------------------------------------------------------------------------- graph
const W = 1000, H = 330, LEFT = 46, RIGHT = 14, TOP = 14, BOTTOM = 30;

function TemperatureChart({ proof }: { proof: Proof }) {
  const [hover, setHover] = useState<number | null>(null);
  const min = proof.compartment ? proof.compartment.minC ?? null : proof.trip.requiredTempMinC, max = proof.compartment ? proof.compartment.maxC ?? null : proof.trip.requiredTempMaxC;   // REQ-CC-012
  const gapMs = proof.settings.maxGapMinutes * 60000;

  const model = useMemo(() => {
    const pts = proof.points.map(p => ({ t: new Date(p.t).getTime(), c: Number(p.c), out: p.out, flag: p.flag })).filter(p => !Number.isNaN(p.t));
    if (pts.length === 0) return null;
    let lo = Math.min(...pts.map(p => p.c)), hi = Math.max(...pts.map(p => p.c));
    if (min != null) lo = Math.min(lo, Number(min));
    if (max != null) hi = Math.max(hi, Number(max));
    const pad = Math.max(1, (hi - lo) * 0.12);
    lo -= pad; hi += pad;
    let step = 0.5;
    for (const s of [0.5, 1, 2, 5, 10, 20, 50]) { step = s; if ((hi - lo) / s <= 6) break; }
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    let t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    if (t1 <= t0) { t0 -= 60000; t1 += 60000; }
    const x = (t: number) => LEFT + ((t - t0) / (t1 - t0)) * (W - LEFT - RIGHT);
    const y = (c: number) => H - BOTTOM - ((c - lo) / (hi - lo)) * (H - TOP - BOTTOM);
    const yTicks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10);
    const sameDay = new Date(t0).toDateString() === new Date(t1).toDateString();
    const xTicks = Array.from({ length: 7 }, (_, i) => t0 + ((t1 - t0) * i) / 6);
    const tick = (t: number) => (sameDay ? fmtTime(t) : fmtDateTime(t)); // REQ-PLT-015
    return { pts, lo, hi, t0, t1, x, y, yTicks, xTicks, tick };
  }, [proof.points, min, max]);

  if (!model) return <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400">No temperature reading was received for this trip.</div>;
  const { pts, t0, t1, x, y, yTicks, xTicks, tick } = model;
  const clamp = (t: number) => Math.min(Math.max(t, t0), t1);
  const bandTop = max != null ? y(Number(max)) : TOP, bandBottom = min != null ? y(Number(min)) : H - BOTTOM;

  function move(e: MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - box.left) / box.width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - t) < Math.abs(pts[best].t - t)) best = i;
    setHover(best);
  }
  const h = hover != null && hover < pts.length ? pts[hover] : null;

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Temperature graph with the allowed range">
        {(min != null || max != null) && <rect data-band="1" x={LEFT} y={bandTop} width={W - LEFT - RIGHT} height={Math.max(0, bandBottom - bandTop)} fill="#dcf5e4" />}
        {proof.periods.filter(p => p.kind === 'EXCURSION' && p.startedAt).map((p, i) => {
          const a = x(clamp(new Date(p.startedAt as string).getTime())), b = x(clamp(p.endedAt ? new Date(p.endedAt).getTime() : t1));
          return <rect key={`e${i}`} data-excursion="1" x={a} y={TOP} width={Math.max(2, b - a)} height={H - TOP - BOTTOM} fill="#fde2e2" />;
        })}
        {pts.slice(0, -1).map((p, i) => pts[i + 1].t - p.t > gapMs
          ? <g key={`g${i}`} data-gap="1"><rect x={x(p.t)} y={TOP} width={x(pts[i + 1].t) - x(p.t)} height={H - TOP - BOTTOM} fill="#e2e8f0" /><text x={(x(p.t) + x(pts[i + 1].t)) / 2} y={H - BOTTOM - 8} textAnchor="middle" fontSize="12" fill="#64748b">no data</text></g>
          : null)}
        {yTicks.map(v => <g key={`y${v}`}><line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" /><text x={LEFT - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#64748b">{fmtTempNumber(v)}</text></g>)}
        {max != null && <><line x1={LEFT} x2={W - RIGHT} y1={y(Number(max))} y2={y(Number(max))} stroke="#15803d" strokeWidth="1.5" strokeDasharray="6 4" /><text x={W - RIGHT - 6} y={y(Number(max)) - 6} textAnchor="end" fontSize="12" fontWeight="700" fill="#15803d">Max {fmtTemp(max)}</text></>}
        {min != null && <><line x1={LEFT} x2={W - RIGHT} y1={y(Number(min))} y2={y(Number(min))} stroke="#15803d" strokeWidth="1.5" strokeDasharray="6 4" /><text x={W - RIGHT - 6} y={y(Number(min)) + 16} textAnchor="end" fontSize="12" fontWeight="700" fill="#15803d">Min {fmtTemp(min)}</text></>}
        {xTicks.map((t, i) => <text key={`x${i}`} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="12" fill="#64748b">{tick(t)}</text>)}
        <rect x={LEFT} y={TOP} width={W - LEFT - RIGHT} height={H - TOP - BOTTOM} fill="none" stroke="#94a3b8" strokeWidth="1" />
        {pts.slice(0, -1).map((p, i) => pts[i + 1].t - p.t > gapMs ? null
          : <line key={`l${i}`} data-seg={p.out || pts[i + 1].out ? 'out' : 'in'} x1={x(p.t)} y1={y(p.c)} x2={x(pts[i + 1].t)} y2={y(pts[i + 1].c)} stroke={p.out || pts[i + 1].out ? '#dc2626' : '#0369a1'} strokeWidth="2" strokeLinecap="round" />)}
        {pts.length <= 120 && pts.map((p, i) => <circle key={`c${i}`} cx={x(p.t)} cy={y(p.c)} r="2.5" fill={p.out ? '#dc2626' : '#0369a1'} />)}
        {pts.map((p, i) => p.flag ? <path key={`f${i}`} data-flag="1" d={`M ${x(p.t)} ${y(p.c) - 9} l 5 8 h -10 z`} fill="#f59e0b" /> : null)}{/* REQ-CC-010 */}
        {h && <g pointerEvents="none">
          <line x1={x(h.t)} x2={x(h.t)} y1={TOP} y2={H - BOTTOM} stroke="#0f172a" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(h.t)} cy={y(h.c)} r="5" fill={h.out ? '#dc2626' : '#0369a1'} stroke="#fff" strokeWidth="2" />
          <g transform={`translate(${Math.min(Math.max(x(h.t) - 75, LEFT), W - RIGHT - 150)}, ${TOP + 6})`}>
            <rect width="150" height="42" rx="6" fill="#0f172a" opacity="0.92" />
            <text x="10" y="17" fontSize="12" fill="#cbd5e1">{fmtDateTime(h.t)}</text>
            <text x="10" y="34" fontSize="14" fontWeight="700" fill="#fff">{fmtTemp(h.c)}{h.out ? '  outside' : ''}</text>
          </g>
        </g>}
        <rect x={LEFT} y={TOP} width={W - LEFT - RIGHT} height={H - TOP - BOTTOM} fill="transparent" onMouseMove={move} onMouseLeave={() => setHover(null)} />
      </svg>
    </div>
  );
}
