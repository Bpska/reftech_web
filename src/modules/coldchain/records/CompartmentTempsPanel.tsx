/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-012 -- the live temperature of each compartment of a multi-temperature truck on one trip: current
// reading, the range (the compartment range narrowed by the goods loaded in it), state and alert, with a graph
// per compartment. Staff can type a reading taken by hand (probe) for a compartment.
// Shown on Trip Detail and on the load plan of Dispatch, and on Cold Chain > Compartment Temperatures.
// Before script 66, or for a truck without compartments, the panel shows nothing.
// Backend: /api/coldchain/compartments/trips/{tripId} (CompartmentTemperatureController).
import { FormEvent, useEffect, useState } from 'react';
import { Thermometer } from 'lucide-react';
import { api } from '@/shared/services/api';
import { btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { at, notReady, nowIndia, send, temp, who } from './records';
import { Pill, ReadingsLine } from './ui';
import { toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function CompartmentTempsPanel({ tripId, title = 'Compartment temperatures' }: { tripId: number | string; title?: string }) {
  const me = who();
  const [data, setData] = useState<any>(null), [open, setOpen] = useState<number | null>(null), [line, setLine] = useState<any>(null);
  const [typing, setTyping] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const load = () => api(`/api/coldchain/compartments/trips/${tripId}`).then(setData).catch(() => setData(null));
  useEffect(() => { if (tripId) void load(); }, [tripId]);
  useEffect(() => {
    if (open === null) { setLine(null); return; }
    api(`/api/coldchain/compartments/trips/${tripId}/${open}`).then(setLine).catch(e => setErr(errorText(e, 'The readings could not be read.')));
  }, [open, tripId, data]);

  if (!data || notReady(data) || !Array.isArray(data.compartments) || data.compartments.length === 0) return null;

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = toBaseFields(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>, { temperatureC: 'temp' }); // REQ-PLT-015
    setBusy(true); setMsg(''); setErr('');
    try { const x = await send(`/api/coldchain/compartments/trips/${tripId}/readings`, b); setMsg(x?.message || 'The reading was saved.'); setTyping(false); await load(); }
    catch (e2) { setErr(errorText(e2, 'The reading was not saved.')); } finally { setBusy(false); }
  }

  return <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Thermometer className="h-5 w-5" />{title}</h2>
      {me.staff && <button className={btnLight} onClick={() => setTyping(!typing)}>{typing ? 'Cancel' : 'Add a probe reading'}</button>}
    </div>
    {msg && <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900">{msg}</p>}
    {err && <p className="mt-2 rounded-xl bg-red-50 p-2 text-sm text-red-800">{err}</p>}
    {typing && <form onSubmit={add} className="mt-3 grid gap-3 md:grid-cols-4">
      <div><span className={label}>Compartment *</span><select name="compartmentId" required className={input}>
        {data.compartments.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div><span className={label}>Temperature ({unitNow('temp')}) *</span><input name="temperatureC" type="number" step="any" required className={input} /></div>
      <div><span className={label}>Taken at (India time)</span><input name="capturedAt" defaultValue={nowIndia()} className={input} placeholder="YYYY-MM-DD HH:MM" /></div>
      <div className="flex items-end"><button className={btn} disabled={busy}>Save reading</button></div>
    </form>}
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">Compartment</th><th>Now</th><th>Range</th><th>State</th><th>Lowest / highest</th><th>Readings</th><th>Goods</th><th /></tr></thead>
        <tbody>{data.compartments.map((c: any) => <tr key={c.id} className={`border-t align-top ${open === c.id ? 'bg-sky-50' : ''}`}>
          <td className="p-2 font-semibold">{c.label}{c.sensorRef ? <div className="text-xs font-normal text-slate-500">sensor {c.sensorRef}</div> : null}</td>
          <td className="whitespace-nowrap">{temp(c.currentC)}{c.sensorFlag ? <span title="Sensor calibration overdue" className="ml-1 text-amber-600">▲</span> : null}
            <div className="text-xs text-slate-500">{c.readAt ? `${at(c.readAt)}${c.minutesAgo != null ? ` (${c.minutesAgo} min ago)` : ''}` : 'no reading'}</div></td>
          <td className="whitespace-nowrap">{temp(c.minC)} to {temp(c.maxC)}{(String(c.minC) !== String(c.compartmentMinC) || String(c.maxC) !== String(c.compartmentMaxC)) ? <div className="text-xs text-slate-500">narrowed by the goods</div> : null}</td>
          <td><Pill state={c.state} />{c.alert ? <div className="mt-1 text-xs text-red-700">Alert: {String(c.alert.alertType || c.alert.type || '').replace(/_/g, ' ').toLowerCase()}</div> : null}</td>
          <td className="whitespace-nowrap">{temp(c.lowestC)} / {temp(c.highestC)}</td>
          <td>{c.readings}{c.flaggedReadings ? <div className="text-xs text-amber-700">{c.flaggedReadings} by an overdue sensor</div> : null}</td>
          <td className="max-w-xs text-xs">{Array.isArray(c.loads) && c.loads.length ? c.loads.map((l: any) => l.label || l.loadNumber || l.goods).join(', ') : '-'}</td>
          <td className="p-2"><button className={btnLight} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide graph' : 'Graph'}</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {open !== null && line && <div className="mt-3"><h3 className="font-semibold">{line.label}</h3><ReadingsLine points={line.points || []} minC={line.minC} maxC={line.maxC} /></div>}
    {data.staleMinutes ? <p className="mt-2 text-xs text-slate-500">A compartment with no reading for {data.staleMinutes} min is shown as stale. An alert is raised after {data.sustainedMinutes} min out of range.</p> : null}
  </section>;
}
