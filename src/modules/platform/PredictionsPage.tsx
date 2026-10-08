/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-008 -- Predictions (/platform/predictions): arrival time and delay risk of running trips, weekly demand
// per customer, temperature excursion risk per vehicle and lane, and how accurate past estimates were.
// Staff with TRIPS_VIEW, Manager or Admin; "Train now" is for an Admin.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { btn, input, label, td, th } from '@/shared/components/FormKit';
import { Tabs, when } from '@/modules/hr/hr';
import { AI_SCRIPT, NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { LineChart } from './charts';

const num = (v: any, d = 1) => v === null || v === undefined ? '-' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d });

const RISK: Record<string, string> = { LOW: 'bg-emerald-100 text-emerald-900', MEDIUM: 'bg-amber-100 text-amber-900', HIGH: 'bg-red-100 text-red-900' };
/** Risk badge: the word and the number, never colour alone. */
function Risk({ band, score }: { band: string; score?: number }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${RISK[band] || 'bg-slate-100 text-slate-700'}`}>
    {band === 'HIGH' ? '!! ' : band === 'MEDIUM' ? '! ' : ''}{band}{score !== undefined ? ` ${score}` : ''}
  </span>;
}

function Grid({ caption, columns, rows, empty }: { caption: string; columns: [string, (r: any) => ReactNode][]; rows: any[]; empty: string }) {
  if (!rows?.length) return <p className="mt-2 text-sm text-slate-500">{empty}</p>;
  return <div className="mt-2 overflow-x-auto">
    <table className="min-w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead><tr className="bg-slate-50">{columns.map(([h]) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{columns.map(([h, f]) => <td key={h} className={td}>{f(r)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function Box({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{title}</h2>{right}</div>
    {children}
  </section>;
}

export function PredictionsPage() {
  const s = usePlatform();
  const [tab, setTab] = useState('running');
  const [running, setRunning] = useState<any[] | null>(null);
  const [demand, setDemand] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any>(null);
  const [lanes, setLanes] = useState<any>(null);
  const [models, setModels] = useState<any>(null);
  const [customer, setCustomer] = useState('');
  const [err, setErr] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [forbidden, setForbidden] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const fail = (e: any) => { const m = e?.message || 'Not loaded'; if (/may not|Only|staff/.test(m)) setForbidden(m); else setErr(m); };
    api('/api/platform/predictions/running').then(setRunning).catch(fail);
    api('/api/platform/predictions/demand').then(setDemand).catch(fail);
    api('/api/platform/predictions/risk/vehicles').then(setVehicles).catch(fail);
    api('/api/platform/predictions/risk/lanes').then(setLanes).catch(fail);
    api('/api/platform/predictions/models').then(setModels).catch(fail);
  }, []);
  useEffect(() => { if (s?.aiReady && !s.partner) load(); }, [s?.aiReady, s?.partner, load]);

  if (!s) return <p className="p-6">Loading...</p>;
  if (s.partner) return <div className="p-6"><NotAllowed what="open Predictions" /></div>;
  if (!s.aiReady) return <div className="p-6"><PageTitle icon={<BrainCircuit />} title="Predictions" /><ScriptMissing script={AI_SCRIPT} /></div>;
  if (forbidden) return <div className="p-6"><PageTitle icon={<BrainCircuit />} title="Predictions" /><div role="alert" className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{forbidden}</div></div>;

  async function train() {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/platform/predictions/train', { method: 'POST', body: '{}' }); setMsg(r.message); await load(); }
    catch (e: any) { setErr(e?.message || 'Not started'); }
    finally { setBusy(false); }
  }

  const rows: any[] = demand?.rows || [];
  const chosen = rows.find(r => String(r.partnerId) === customer) || rows[0];
  const weeks: string[] = demand?.weeks || [];
  const fc: any[] = chosen?.forecast || [];
  const labels = [...weeks.slice(-12), ...fc.map(f => f.week)].map(w => w.slice(5));
  const hist = (chosen?.history || []).slice(-12);

  return <div className="p-6">
    <PageTitle icon={<BrainCircuit />} title="Predictions">
      When running trips will arrive, which may be late, next weeks' demand and temperature risk.
    </PageTitle>
    <div role="note" className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
      These are <b>estimates from your own history; check before acting.</b> Each one says why. They are worked out again every night at 02:55.
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {s.admin && <button type="button" className={btn} disabled={busy} onClick={train}><RefreshCw className="mr-1 inline h-4 w-4" aria-hidden />{busy ? 'Training...' : 'Train now'}</button>}
      <button type="button" className="text-sm font-semibold text-sky-700 underline" onClick={load}>Reload</button>
    </div>
    {msg && <div role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}

    <Tabs value={tab} onChange={setTab} tabs={[['running', 'Running trips'], ['demand', 'Demand'], ['risk', 'Temperature risk'], ['models', 'Accuracy']]} />

    {tab === 'running' && <Box title="Running trips: arrival and delay risk">
      <Grid caption="Running trips with predicted arrival" rows={running || []} empty={running ? 'No trip is on the road now.' : 'Loading...'} columns={[
        ['Trip', r => <><b>{r.tripNumber || r.tripId}</b><div className="text-xs text-slate-500">{r.vehicleNumber || ''}</div></>],
        ['Customer', r => r.partnerName || '-'], ['Lane', r => r.lane],
        ['Promised', r => when(r.promisedArrival)],
        ['Expected arrival', r => <>{when(r.predictedArrival)}{r.lateByMinutes > 0 && <div className="text-xs font-semibold text-red-700">{num(r.lateByMinutes, 0)} min late</div>}</>],
        ['80% by', r => when(r.p80Arrival)],
        ['Delay risk', r => <Risk band={r.riskBand} score={r.risk} />],
        ['Why', r => <div className="max-w-md text-xs text-slate-700">{r.explanation}{r.riskReasons?.length ? <ul className="ml-4 list-disc">{r.riskReasons.map((x: string) => <li key={x}>{x}</li>)}</ul> : null}</div>],
      ]} />
    </Box>}

    {tab === 'demand' && <Box title="Demand per customer: next 4 weeks">
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">{demand ? 'No trips with a customer in the last 26 weeks.' : 'Loading...'}</p> : <>
        <div className="mt-3 max-w-sm"><label htmlFor="pd-customer" className={label}>Customer</label>
          <select id="pd-customer" className={input} value={chosen ? String(chosen.partnerId) : ''} onChange={e => setCustomer(e.target.value)}>
            {rows.map(r => <option key={r.partnerId} value={r.partnerId}>{r.partnerName}</option>)}
          </select></div>
        <div className="mt-3">
          <LineChart title={`Trips per week - ${chosen.partnerName} (last 12 weeks and the next 4)`} labels={labels} series={[
            { name: 'Trips (past)', values: [...hist.map((h: any) => h.trips), ...fc.map(() => null)] },
            { name: 'Forecast', values: [...hist.map((_: any, i: number) => i === hist.length - 1 ? hist[i].trips : null), ...fc.map(f => f.trips)] },
            { name: 'Forecast high (80%)', values: [...hist.map(() => null), ...fc.map(f => f.high)] },
          ]} note={chosen.explanation} />
        </div>
        <Grid caption="Forecast per customer" rows={rows} empty="" columns={[
          ['Customer', r => r.partnerName],
          ...[0, 1, 2, 3].map(i => [`Week of ${(rows[0]?.forecast?.[i]?.week || '').slice(5)}`, (r: any) => r.forecast?.[i] ? `${num(r.forecast[i].trips)} (${num(r.forecast[i].low)}-${num(r.forecast[i].high)})` : '-'] as [string, (r: any) => ReactNode]),
          ['Load requests next week', r => num(r.forecast?.[0]?.loads)],
        ]} />
      </>}
    </Box>}

    {tab === 'risk' && <>
      <Box title="Temperature excursion risk per vehicle">
        {vehicles?.note && <p className="mt-1 text-sm text-slate-600">{vehicles.note}</p>}
        <Grid caption="Excursion risk per vehicle" rows={vehicles?.rows || []} empty={vehicles ? 'No data.' : 'Loading...'} columns={[
          ['Vehicle', r => r.name], ['Trips (365 days)', r => num(r.trips, 0)], ['With excursion', r => num(r.excursionTrips, 0)],
          ['Past share', r => `${num(r.pastPct)}%`], ['Risk next trip', r => <>{num(r.riskPct)}% <Risk band={r.riskBand} /></>]]} />
      </Box>
      <Box title="Temperature excursion risk per lane">
        <Grid caption="Excursion risk per lane" rows={lanes?.rows || []} empty={lanes ? 'No data.' : 'Loading...'} columns={[
          ['Lane', r => r.name], ['Trips (365 days)', r => num(r.trips, 0)], ['With excursion', r => num(r.excursionTrips, 0)],
          ['Past share', r => `${num(r.pastPct)}%`], ['Risk next trip', r => <>{num(r.riskPct)}% <Risk band={r.riskBand} /></>]]} />
      </Box>
    </>}

    {tab === 'models' && <>
      <Box title="How accurate were past estimates">
        <p className="mt-1 text-sm text-slate-600">{models?.note} Predictions still waiting for the real value: {num(models?.open, 0)}.</p>
        <Grid caption="Accuracy per model" rows={models?.accuracy || []} empty="No real values yet: they are filled in when trips finish and weeks pass." columns={[
          ['Model', r => r.modelCode], ['Checked', r => num(r.checked, 0)], ['Average error', r => `${num(r.mae, 2)} ${r.unit}`],
          ['Within the 80% band', r => r.withinBandPct == null ? '-' : `${num(r.withinBandPct)}%`]]} />
      </Box>
      <Box title="Training runs">
        <Grid caption="Training runs" rows={models?.runs || []} empty="No training yet. An Admin can press Train now." columns={[
          ['When', r => when(r.trainedAt)], ['Model', r => r.modelCode], ['Status', r => r.status], ['Rows', r => num(r.rowsUsed, 0)],
          ['Hold-out error', r => r.metricName ? `${r.metricName} ${num(r.metricValue, 3)}` : '-'],
          ['Notes', r => <div className="max-w-md text-xs">{r.notes}</div>], ['By', r => r.trainedBy || '-']]} />
      </Box>
    </>}
  </div>;
}
