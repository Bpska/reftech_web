/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-016 -- Eutectic Plates: trucks cooled by frozen plates instead of a running reefer.
//   Trips: the coming and running trips of eutectic trucks with the plates' hold time against the planned arrival
//     (fits, tight, runs out on the way). Staff are told once when a planned route does not fit; a running trip gets
//     an EUTECTIC_HOLD alert on the Control Tower before the plates run out.
//   Charges: each overnight charge with the plate temperature reached and the hours; a charge counts only when the
//     plates reached the target and charged long enough; the hold time is shorter on a hot day.
//   Trucks: the plate setup per truck (target temperature, minimum charge hours, qualified hold time, reference
//     ambient, warning minutes) from the qualification test.
// Staff only. Backend: /api/coldchain/eutectic (EutecticController). Needs database_v2/96.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Snowflake } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText } from '@/shared/components/FormKit';
import { at, day, notReady, send, temp, who, words } from '@/modules/coldchain/records/records';
import { Pill, Tabs, Tiles } from '@/modules/coldchain/records/ui';
import { SCRIPT96 } from '@/modules/dispatch/schedule/schedule';
import { EU, STATE_TEXT, hoursText, stateTone } from './eutectic';

export function EutecticPage() {
  const me = who();
  const [tab, setTab] = useState('TRIPS');
  const [o, setO] = useState<any>(null), [data, setData] = useState<any>(null), [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);

  useEffect(() => { api(`${EU}/options`).then(setO).catch(e => setErr(errorText(e, 'The options could not be read.'))); }, []);
  useEffect(() => {
    if (!o?.ready) return;
    setData(null);
    const fail = (e: unknown) => setErr(errorText(e, 'The list could not be read.'));
    if (tab === 'TRIPS') api(`${EU}/trips`).then(setData).catch(fail);
    if (tab === 'CHARGES') api(`${EU}/charges`).then(setData).catch(fail);
    if (tab === 'TRUCKS') api(`${EU}/trucks`).then(setData).catch(fail);
  }, [o, tab, reload]);
  useEffect(() => { setForm(null); }, [tab]);

  if (notReady(o)) return <><h1 className="text-3xl font-bold">Eutectic Plates</h1><NotReady script={o.script || SCRIPT96} /></>;

  async function run(fn: () => Promise<any>, after?: (x: any) => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(x); setReload(r => r + 1); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const vehicles: [number, string][] = (o?.vehicles || []).map((v: any) => [v.id, v.number]);
  const rows: any[] = Array.isArray(data) ? data : [];
  const linkTrip = (c: any) => { const n = window.prompt(`Trip number for the charge of ${c.vehicleNumber}:`, c.tripNumber || ''); if (n) void run(() => send(`${EU}/charges/${c.id}/trip`, { tripNumber: n })); };
  const cancel = (c: any) => { const r = window.prompt('Why is this charge record wrong?'); if (r) void run(() => send(`${EU}/charges/${c.id}/cancel`, { reason: r })); };

  return <>
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Snowflake />Eutectic Plates</h1>
      <p className="text-slate-600">Plate trucks: the overnight charge, the hold time it gives (shorter on a hot day) and whether each trip arrives before the plates run out.</p>
    </div>
    <Banner msg={msg} error={err} />
    <Tabs value={tab} onChange={setTab} tabs={[['TRIPS', 'Trips'], ['CHARGES', 'Charges'], ['TRUCKS', 'Trucks']]} />

    {tab === 'TRIPS' && <>
      <Tiles items={[['Trips', rows.length], ['Fit', rows.filter(r => r.state === 'OK').length], ['Tight', rows.filter(r => r.state === 'TIGHT').length, rows.some(r => r.state === 'TIGHT') ? 'DUE_SOON' : undefined],
        ['Will not last / no charge', rows.filter(r => !['OK', 'TIGHT'].includes(r.state)).length, rows.some(r => !['OK', 'TIGHT'].includes(r.state)) ? 'OVER' : undefined]]} />
      <Section title="Trips of eutectic trucks">
        {!data ? <p className="text-slate-500">Loading...</p> : !rows.length ? <p className="text-slate-500">No coming or running trip on a truck with plates set up.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Trip</th><th>Truck</th><th>Planned</th><th>Charged until</th><th>Plates hold until</th><th>Left now</th><th>State</th><th>Alert</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.tripId} className="border-t align-top">
            <td className="p-2 font-semibold"><Link className="text-sky-700 hover:underline" to={`/trips/${r.tripId}`}>{r.tripNumber}</Link><div className="text-xs font-normal text-slate-500">{r.from} to {r.to} · {words(r.stage)}</div></td>
            <td>{r.vehicleNumber}</td><td>{at(r.plannedStartAt)}<div className="text-xs">to {at(r.plannedEndAt)}</div></td><td>{at(r.chargeEndedAt)}</td><td>{at(r.holdUntil)}</td>
            <td>{r.minutesLeft == null ? '-' : r.minutesLeft < 0 ? <span className="text-red-700">ran out {hoursText(r.minutesLeft, true)}</span> : hoursText(r.minutesLeft)}</td>
            <td><Pill state={stateTone(r.state)} text={STATE_TEXT[r.state] || words(r.state)} /><div className="max-w-xs text-xs">{r.message}</div></td>
            <td>{r.alertId ? <Link className="text-xs font-bold text-red-700 hover:underline" to="/control-tower">Alert raised</Link> : '-'}</td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'CHARGES' && <>
      <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Record a charge'}</button></div>
      {form && <Section title="Record a charge of the plates"><QuickForm cols={4} busy={busy} submitText="Save charge" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${EU}/charges`, v), () => setForm(null))} fields={[
        { name: 'vehicleId', label: 'Truck', type: 'select', options: vehicles, required: true },
        { name: 'chargeStartedAt', label: 'Charge started (YYYY-MM-DD HH:MM)', required: true }, { name: 'chargeEndedAt', label: 'Charge ended', required: true },
        { name: 'plateTempC', label: 'Plate temperature reached', type: 'number', unit: 'temp', required: true }, { name: 'ambientC', label: 'Expected ambient on the trip', type: 'number', unit: 'temp' },
        { name: 'tripNumber', label: 'For trip (optional)' }, { name: 'chargedBy', label: 'Charged by' }, { name: 'note', label: 'Note' },
      ]} /></Section>}
      <Section title="Charges">
        {!data ? <p className="text-slate-500">Loading...</p> : !rows.length ? <p className="text-slate-500">No charge recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Truck</th><th>Charged</th><th>Plates / ambient</th><th>Hold time</th><th>Holds until</th><th>Trip</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map(c => <tr key={c.id} className="border-t align-top">
            <td className="p-2 font-semibold">{c.vehicleNumber}<div className="text-xs font-normal text-slate-500">{c.chargedBy || ''} · {c.recordedByName}</div></td>
            <td>{at(c.chargeStartedAt)}<div className="text-xs">to {at(c.chargeEndedAt)}</div></td><td>{temp(c.plateTempC)} / {temp(c.ambientC)}</td><td>{hoursText(c.holdMinutes)}</td><td>{at(c.holdUntil)}</td>
            <td>{c.tripId ? <Link className="text-sky-700 hover:underline" to={`/trips/${c.tripId}`}>{c.tripNumber}</Link> : '-'}</td>
            <td><Pill state={stateTone(c.status)} text={words(c.status)} />{c.reason ? <div className="max-w-xs text-xs">{c.reason}</div> : null}</td>
            <td className="space-x-1">{['CHARGED', 'NOT_QUALIFIED'].includes(c.status) && <button className={btnLight} disabled={busy} onClick={() => linkTrip(c)}>{c.tripId ? 'Change trip' : 'Link trip'}</button>}
              {me.manager && c.status !== 'CANCELLED' && <button className={btnRed} disabled={busy} onClick={() => cancel(c)}>Cancel</button>}</td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'TRUCKS' && <>
      {me.manager && <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Set up a truck'}</button></div>}
      {form && <Section title={form.vehicleNumber ? `Plates of ${form.vehicleNumber}` : 'Set up the plates of a truck'}><QuickForm cols={4} busy={busy} submitText="Save" initial={{ active: true, warnBeforeMinutes: 60, ...form }} onCancel={() => setForm(null)}
        onSubmit={v => run(() => send(`${EU}/trucks`, v), () => setForm(null))} fields={[
          { name: 'vehicleId', label: 'Truck', type: 'select', options: vehicles, required: true }, { name: 'plateCount', label: 'Plates', type: 'number' },
          { name: 'phaseChangeC', label: 'Phase change temperature', type: 'number', unit: 'temp' }, { name: 'chargeTargetC', label: 'Charge target (plates at or below)', type: 'number', unit: 'temp', required: true },
          { name: 'minChargeHours', label: 'Minimum charge hours', type: 'number', required: true }, { name: 'holdHours', label: 'Qualified hold hours', type: 'number', required: true },
          { name: 'referenceAmbientC', label: 'Ambient of the qualification', type: 'number', unit: 'temp', required: true }, { name: 'warnBeforeMinutes', label: 'Alert minutes before they run out', type: 'number' },
          { name: 'qualifiedOn', label: 'Qualified on', type: 'date' }, { name: 'qualificationRef', label: 'Qualification report' }, { name: 'active', label: 'Active', type: 'checkbox' }, { name: 'notes', label: 'Notes', wide: true },
        ]} />
        <p className="mt-2 text-xs text-slate-500">On a day hotter than the qualification ambient the hold time is cut by {o?.deratePercentPerC} % per °C. A trip with less than {o?.marginMinutes} minutes to spare shows as tight.</p></Section>}
      <Section title="Trucks with plates">
        {!data ? <p className="text-slate-500">Loading...</p> : !rows.length ? <p className="text-slate-500">No truck set up yet.</p> : <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Truck</th><th>Plates</th><th>Charge</th><th>Hold</th><th>Alert</th><th>Qualified</th><th>Last charge</th><th /></tr></thead>
          <tbody>{rows.map(t => <tr key={t.id} className={`border-t align-top ${t.active ? '' : 'text-slate-400'}`}>
            <td className="p-2 font-semibold">{t.vehicleNumber}</td><td>{t.plateCount ?? '-'}{t.phaseChangeC != null ? <div className="text-xs">freeze at {temp(t.phaseChangeC)}</div> : null}</td>
            <td>to {temp(t.chargeTargetC)}<div className="text-xs">at least {t.minChargeHours} h</div></td><td>{t.holdHours} h<div className="text-xs">at {temp(t.referenceAmbientC)} ambient</div></td>
            <td>{t.warnBeforeMinutes} min before</td><td>{day(t.qualifiedOn)}<div className="text-xs">{t.qualificationRef || ''}</div></td><td>{at(t.lastChargeAt)}</td>
            <td>{me.manager && <button className={btnLight} onClick={() => setForm(t)}>Edit</button>}</td></tr>)}</tbody></table>}
      </Section>
    </>}
  </>;
}
