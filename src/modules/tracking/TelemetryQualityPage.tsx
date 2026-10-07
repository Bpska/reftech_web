/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-007 -- Telemetry Quality: for every running trip, how fresh its position and each temperature sensor are,
// gaps of the last 24 hours, open "sensor silent" alerts, and the readings and positions that were refused as
// impossible (out of range, a jump no box can make, a truck that would have flown). Staff only.
// Backend: GET /api/tracking/quality (QualityController). Needs database_v2/51_tracking_telematics.sql.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btnLight, errorText, td, th } from '@/shared/components/FormKit';
import { TELEMATICS_SCRIPT, minutesText, num, pill, sourceText, when } from './telematics';
import { fmtTemp, fmtTempDelta, fmtTempRange } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const STATE: Record<string, ['green' | 'amber' | 'red' | 'grey', string]> = {
  FRESH: ['green', 'Fresh'], LATE: ['amber', 'Late'], SILENT: ['red', 'Silent'], NO_DATA: ['grey', 'No data yet'],
};

export function TelemetryQualityPage() {
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [filter, setFilter] = useState('ALL');
  const load = useCallback(() => api('/api/tracking/quality').then(x => { setD(x); setErr(''); }).catch(e => setErr(errorText(e, 'Could not load telemetry quality'))), []);
  useEffect(() => { void load(); const t = window.setInterval(() => { void load(); }, 60000); return () => window.clearInterval(t); }, [load]);

  if (d && d.ready === false) return <NotReady script={TELEMATICS_SCRIPT} />;
  const trips: any[] = (d?.trips || []).filter((t: any) => filter === 'ALL' || t.state === filter);
  const s = d?.settings || {};
  const card = (key: string, n: number, text: string, tone: string) => <button type="button" onClick={() => setFilter(filter === key ? 'ALL' : key)}
    className={`rounded-2xl border p-4 text-left ${tone} ${filter === key ? 'ring-2 ring-sky-500' : ''}`}><div className="text-3xl font-black">{n}</div><div className="text-sm font-semibold">{text}</div></button>;

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Activity className="h-8 w-8 text-sky-700" />Telemetry Quality</h1>
        <p className="text-slate-600">How fresh the positions and temperature sensors of the running trips are. A sensor silent for {s.sensorSilentMinutes ?? 30} minutes while the truck still reports raises an alert in the Control Tower.</p>
      </div>
      <button type="button" className={btnLight} onClick={() => { void load(); }}><RefreshCw className="mr-1 inline h-4 w-4" />Refresh</button>
    </div>
    <Banner error={err} />
    {!d ? <p className="mt-4 text-slate-500">Loading...</p> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {card('FRESH', d.counts?.fresh ?? 0, 'Fresh (under 10 min)', 'border-emerald-200 bg-emerald-50 text-emerald-900')}
        {card('LATE', d.counts?.late ?? 0, 'Late (10 min or more)', 'border-amber-200 bg-amber-50 text-amber-900')}
        {card('SILENT', d.counts?.silent ?? 0, `Silent or no data`, 'border-red-200 bg-red-50 text-red-900')}
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-3xl font-black">{d.counts?.rejected24h ?? 0}</div><div className="text-sm font-semibold text-slate-600">Refused in the last 24 hours</div></div>
      </div>

      <Section title={`Running trips${filter === 'ALL' ? '' : ` (${STATE[filter]?.[1] || filter})`}`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>State</th><th className={th}>Last position</th><th className={th}>Sensors</th><th className={th}>Gaps (24 h)</th><th className={th}>Refused (24 h)</th><th className={th}>Alerts</th></tr></thead>
          <tbody>
            {trips.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No running trip{filter === 'ALL' ? '' : ' in this state'}.</td></tr>}
            {trips.map(t => {
              const [tone, text] = STATE[t.state] || ['grey', t.state];
              return <tr key={t.tripId} className="border-t border-slate-200">
                <td className={td}><Link to={`/trips/${t.tripId}`} className="font-semibold text-sky-700 hover:underline">{t.tripNumber}</Link><div className="text-xs text-slate-500">{t.partnerName}</div></td>
                <td className={td}>{t.vehicleNumber || '-'}</td>
                <td className={td}>{pill(tone, text)}</td>
                <td className={td}>{t.positionAt ? <>{minutesText(t.positionAgeMinutes)} ago<div className="text-xs text-slate-500">{sourceText(t.positionSource)}, {num(t.positions24h)} in 24 h</div></> : <span className="text-slate-400">none</span>}</td>
                <td className={td}>{(t.sensors || []).length === 0
                  ? <span className="text-slate-400">{t.temperatureControlled ? 'no reading' : 'not a cold trip'}</span>
                  : (t.sensors || []).map((x: any) => <div key={x.sensorId} className={x.silent ? 'font-semibold text-red-700' : ''}>
                    {x.sensorId || 'sensor'}{x.manual ? ' (typed by driver)' : ''}: {minutesText(x.ageMinutes)} ago, {num(x.readings24h)} in 24 h</div>)}</td>
                <td className={td}>{Number(t.gaps24h) > 0 ? <span className="text-amber-800">{t.gaps24h} gap{Number(t.gaps24h) === 1 ? '' : 's'}, {minutesText(t.gapMinutes24h)}</span> : <span className="text-slate-400">none</span>}</td>
                <td className={td}>{Number(t.rejected24h) > 0 ? <span className="font-semibold text-red-700">{t.rejected24h}</span> : '0'}</td>
                <td className={td}>{t.silentAlertId && pill('red', 'Sensor silent')} {t.noSignalAlertId && pill('red', 'No GPS signal')}{!t.silentAlertId && !t.noSignalAlertId && <span className="text-slate-400">-</span>}
                  {(t.silentAlertId || t.noSignalAlertId) && <div><Link to="/control-tower" className="text-xs text-sky-700 hover:underline">Control Tower</Link></div>}</td>
              </tr>;
            })}
          </tbody>
        </table></div>
      </Section>

      <Section title="Refused readings and positions">
        <p className="mb-2 text-sm text-slate-600">Kept apart and not used: temperatures outside {fmtTempRange(s.tempMinC, s.tempMaxC)} or jumping more than {fmtTempDelta(s.maxJumpPerMinute)} a minute,
          and positions the truck could only reach above {num(s.maxImpliedSpeedKmph)} km/h. On the cold-chain certificate, stretches over {num(s.maxGapMinutes)} minutes without a reading are shown as gaps.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Received</th><th className={th}>Kind</th><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Value</th><th className={th}>Taken at</th><th className={th}>Why refused</th></tr></thead>
          <tbody>
            {(d.rejected || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Nothing refused.</td></tr>}
            {(d.rejected || []).map((r: any) => <tr key={r.id} className="border-t border-slate-200">
              <td className={td}>{when(r.receivedAt)}</td>
              <td className={td}>{r.kind === 'TEMPERATURE' ? 'Temperature' : 'Position'}</td>
              <td className={td}>{r.tripId ? <Link to={`/trips/${r.tripId}`} className="text-sky-700 hover:underline">{r.tripNumber}</Link> : '-'}</td>
              <td className={td}>{r.vehicleNumber || '-'}</td>
              <td className={td}>{r.kind === 'TEMPERATURE' ? `${fmtTemp(r.temperatureC)}${r.sensorId ? ` (${r.sensorId})` : ''}` : `${num(r.latitude, 5)}, ${num(r.longitude, 5)}${r.source ? ` (${sourceText(r.source)})` : ''}`}</td>
              <td className={td}>{when(r.capturedAt)}</td>
              <td className={td}>{r.reason}</td>
            </tr>)}
          </tbody>
        </table></div>
      </Section>
    </>}
  </>;
}
