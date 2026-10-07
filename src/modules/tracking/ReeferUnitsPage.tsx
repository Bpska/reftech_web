/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-008 -- Reefer Units: the cooling unit on each truck, read from the unit maker's service (or pushed by a
// device, or typed in): set-point, return and supply air, mode, alarms, fuel and engine hours. A set-point wrong for
// the load raises an alert. Where the unit and its connection allow it, a Manager or Admin changes the set-point,
// pre-cools, starts, stops or defrosts it from here, with a reason; every command is kept.
// Backend: /api/tracking/reefers/... (ReeferController).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Snowflake } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, errorText, input, td, th } from '@/shared/components/FormKit';
import { TELEMATICS_SCRIPT, isManager, num, pill, when } from './telematics';
import { fmtTemp, fmtTempDelta, fmtTempNumber, toBaseFields, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const COMMAND_TEXT: Record<string, string> = { SET_POINT: 'Change set-point', PRE_COOL: 'Pre-cool', START: 'Start unit', STOP: 'Stop unit', DEFROST: 'Defrost' };
const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'grey'> = { CONFIRMED: 'green', SENT: 'amber', FAILED: 'red', EXPIRED: 'grey' };

export function ReeferUnitsPage() {
  const manager = isManager(currentUser());
  const [d, setD] = useState<any>(null), [vehicles, setVehicles] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [conn, setConn] = useState<any>(null), [unit, setUnit] = useState<any>(null), [open, setOpen] = useState<{ id: number; what: 'reading' | 'command' } | null>(null);

  const load = useCallback(() => api('/api/tracking/reefers').then(setD).catch(e => setErr(errorText(e, 'Could not load reefer units'))), []);
  useEffect(() => { void load(); api('/api/operations/vehicles').then(x => setVehicles(Array.isArray(x) ? x : [])).catch(() => setVehicles([])); }, [load]);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await fn(); setMsg(r?.message || done); await load(); return true; }
    catch (e) { setErr(errorText(e, 'Not done')); return false; } finally { setBusy(false); }
  }
  async function unitAction(e: FormEvent<HTMLFormElement>, u: any) {
    e.preventDefault();
    const f: any = Object.fromEntries(new FormData(e.currentTarget));
    for (const k of Object.keys(f)) if (f[k] === '') delete f[k];
    Object.assign(f, toBaseFields(f, { setPointC: 'temp', returnAirC: 'temp', supplyAirC: 'temp', valueC: 'temp' })); // REQ-PLT-015
    if (f.capturedAt) f.capturedAt = new Date(f.capturedAt).toISOString();
    if (f.unitOn !== undefined) f.unitOn = f.unitOn === 'true';
    const ok = open?.what === 'reading'
      ? await run(() => api(`/api/tracking/reefers/units/${u.id}/readings`, { method: 'POST', body: JSON.stringify(f) }), 'Reading saved')
      : await run(() => api(`/api/tracking/reefers/units/${u.id}/commands`, { method: 'POST', body: JSON.stringify(f) }), 'Command sent');
    if (ok) setOpen(null);
  }

  if (d && d.ready === false) return <NotReady script={TELEMATICS_SCRIPT} />;
  const connFields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'provider', label: 'Service', type: 'select' as const, required: true, options: [['HTTP', "Unit maker's service"], ['SAMPLE', 'Test service']] as [string, string][] },
    { name: 'make', label: 'Make', type: 'select' as const, required: true, options: (d?.makes || []).map((m: string) => [m, m.replace('_', ' ')]) as [string, string][] },
    { name: 'baseUrl', label: 'Service address', placeholder: 'https://api.example.com/v1', wide: true },
    { name: 'authType', label: 'Sign-in', type: 'select' as const, required: true, options: [['NONE', 'None'], ['API_KEY_HEADER', 'Key in a header'], ['BEARER', 'Bearer token']] as [string, string][] },
    { name: 'authHeaderName', label: 'Header name', placeholder: 'X-Api-Key' },
    { name: 'secret', label: 'Key or token', hint: 'Stored encrypted. Leave empty to keep the one saved.' },
    { name: 'pollSeconds', label: 'Read every (seconds)', type: 'number' as const, hint: '60 to 3600' },
    { name: 'canCommand', label: 'Allows commands from the office', type: 'checkbox' as const },
    { name: 'active', label: 'In use', type: 'checkbox' as const },
  ];
  const unitFields = [
    { name: 'vehicleId', label: 'Truck', type: 'select' as const, required: true, options: vehicles.map(v => [v.id, v.vehicleNumber]) as [number, string][] },
    { name: 'connectionId', label: 'Connection', type: 'select' as const, options: (d?.connections || []).map((c: any) => [c.id, c.name]) as [number, string][] },
    { name: 'make', label: 'Make', type: 'select' as const, required: true, options: (d?.makes || []).map((m: string) => [m, m.replace('_', ' ')]) as [string, string][] },
    { name: 'model', label: 'Model' }, { name: 'serialNo', label: 'Serial number' },
    { name: 'externalId', label: "Unit id at the maker's service" },
    { name: 'canRemote', label: 'Can be changed from the office', type: 'checkbox' as const },
    { name: 'feedBoxTemperature', label: 'Use return air as the box temperature', type: 'checkbox' as const },
    { name: 'active', label: 'In use', type: 'checkbox' as const },
  ];

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Snowflake className="h-8 w-8 text-sky-700" />Reefer Units</h1>
    <p className="text-slate-600">The cooling unit on each truck. A set-point more than {fmtTempDelta(d?.tolerance ?? 1)} away from what the trip needs raises an alert in the Control Tower.</p>
    <Banner msg={msg} error={err} />

    <Section title="Units" right={manager && !unit ? <button className={btnLight} onClick={() => setUnit({ make: 'OTHER', active: true })}>Add a unit</button> : undefined}>
      {unit && <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
        <QuickForm key={unit.id ?? 'new'} fields={unitFields} initial={unit} busy={busy} submitText="Save unit" onCancel={() => setUnit(null)}
          onSubmit={async v => { if (await run(() => api(unit.id ? `/api/tracking/reefers/units/${unit.id}` : '/api/tracking/reefers/units', { method: unit.id ? 'PUT' : 'POST', body: JSON.stringify({ ...v, connectionId: v.connectionId || null }) }), 'Saved')) setUnit(null); }} />
      </div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>Unit</th><th className={th}>Trip now</th><th className={th}>Set-point</th><th className={th}>Return / supply air</th><th className={th}>Mode</th><th className={th}>Alarms</th><th className={th}>Fuel / hours</th><th className={th}>Read</th><th className={th}></th></tr></thead>
        <tbody>
          {(d?.units || []).length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">{d ? 'No reefer unit yet.' : 'Loading...'}</td></tr>}
          {(d?.units || []).map((u: any) => {
            const target = u.tripTargetC != null ? Number(u.tripTargetC) : u.tripMinC != null && u.tripMaxC != null ? (Number(u.tripMinC) + Number(u.tripMaxC)) / 2 : null;
            const wrong = target != null && u.setPointC != null && Math.abs(Number(u.setPointC) - target) > Number(d.tolerance);
            return [<tr key={u.id} className={`border-t border-slate-200 ${u.active ? '' : 'opacity-60'}`}>
              <td className={td}><b>{u.vehicleNumber}</b></td>
              <td className={td}>{String(u.make).replace('_', ' ')}{u.model ? ` ${u.model}` : ''}<div className="text-xs text-slate-500">{u.connectionName || 'no connection'}{u.canCommand ? ', remote control' : ''}</div></td>
              <td className={td}>{u.tripId ? <><Link to={`/trips/${u.tripId}`} className="text-sky-700 hover:underline">{u.tripNumber}</Link><div className="text-xs text-slate-500">needs {target != null ? fmtTemp(target) : '-'}</div></> : '-'}</td>
              <td className={td}><span className={wrong ? 'font-bold text-red-700' : ''}>{u.setPointC != null ? fmtTemp(u.setPointC) : '-'}</span></td>
              <td className={td}>{u.returnAirC != null ? fmtTempNumber(u.returnAirC) : '-'} / {u.supplyAirC != null ? fmtTempNumber(u.supplyAirC) : '-'} {unitNow('temp')}</td>
              <td className={td}>{u.unitOn === false ? pill('red', 'Off') : u.mode || '-'}</td>
              <td className={td}>{u.alarmActive ? pill('red', u.alarms || 'Alarm') : u.lastAt ? pill('green', 'None') : '-'}</td>
              <td className={td}>{u.fuelPct != null ? `${num(u.fuelPct)} %` : '-'} / {u.engineHours != null ? `${num(u.engineHours, 1)} h` : '-'}</td>
              <td className={td}>{when(u.lastAt)}<div className="text-xs text-slate-500">{u.source}</div></td>
              <td className={`${td} text-right`}><div className="flex flex-wrap justify-end gap-1">
                <button className={btnLight} onClick={() => setOpen({ id: u.id, what: 'reading' })}>Enter reading</button>
                {manager && u.canCommand && <button className={btnLight} onClick={() => setOpen({ id: u.id, what: 'command' })}>Command</button>}
                {manager && <button className={btnLight} onClick={() => setUnit(u)}>Change</button>}
              </div></td>
            </tr>,
            open?.id === u.id && <tr key={`${u.id}-f`} className="bg-sky-50/50"><td colSpan={10} className="p-3">
              <form onSubmit={e => unitAction(e, u)} className="flex flex-wrap items-end gap-3 text-sm">
                {open?.what === 'reading' ? <>
                  <label>Set-point {unitNow('temp')}<input name="setPointC" type="number" step="any" className={`${input} block w-28`} /></label>
                  <label>Return air {unitNow('temp')}<input name="returnAirC" type="number" step="any" className={`${input} block w-28`} /></label>
                  <label>Supply air {unitNow('temp')}<input name="supplyAirC" type="number" step="any" className={`${input} block w-28`} /></label>
                  <label>Unit<select name="unitOn" className={`${input} block`}><option value="true">On</option><option value="false">Off</option></select></label>
                  <label>Alarms<input name="alarms" placeholder="codes, comma separated" className={`${input} block w-44`} /></label>
                  <label>Fuel %<input name="fuelPct" type="number" step="1" className={`${input} block w-24`} /></label>
                  <label>Engine hours<input name="engineHours" type="number" step="0.1" className={`${input} block w-28`} /></label>
                  <label>Time (empty = now)<input name="capturedAt" type="datetime-local" className={`${input} block`} /></label>
                </> : <>
                  <label>Command<select name="command" className={`${input} block`}>{Object.entries(COMMAND_TEXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                  <label>Set-point {unitNow('temp')} (change / pre-cool)<input name="valueC" type="number" step="any" defaultValue={toShown('temp', target)} className={`${input} block w-32`} /></label>
                  <label className="min-w-[18rem]">Why *<input name="reason" required minLength={5} className={`${input} block`} placeholder="Set-point wrong for frozen load" /></label>
                </>}
                <button disabled={busy} className={btn}>{open?.what === 'reading' ? 'Save reading' : 'Send'}</button>
                <button type="button" className={btnLight} onClick={() => setOpen(null)}>Cancel</button>
              </form>
            </td></tr>];
          })}
        </tbody>
      </table></div>
    </Section>

    <Section title="Recent commands">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>When</th><th className={th}>Truck</th><th className={th}>Trip</th><th className={th}>Command</th><th className={th}>Why</th><th className={th}>By</th><th className={th}>Result</th></tr></thead>
        <tbody>
          {(d?.commands || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No command sent yet.</td></tr>}
          {(d?.commands || []).map((c: any) => <tr key={c.id} className="border-t border-slate-200">
            <td className={td}>{when(c.requestedAt)}</td><td className={td}>{c.vehicleNumber}</td><td className={td}>{c.tripNumber || '-'}</td>
            <td className={td}>{COMMAND_TEXT[c.command] || c.command}{c.valueC != null ? ` to ${fmtTemp(c.valueC)}` : ''}</td>
            <td className={td}>{c.reason}</td><td className={td}>{c.requestedByName}</td>
            <td className={td}>{pill(STATUS_TONE[c.status] || 'grey', c.status)}<div className="text-xs text-slate-500">{c.message}</div></td>
          </tr>)}
        </tbody>
      </table></div>
    </Section>

    <Section title="Connections to unit makers" right={manager && !conn ? <button className={btnLight} onClick={() => setConn({ provider: 'HTTP', make: 'OTHER', authType: 'NONE', pollSeconds: 300, active: true })}>Add a connection</button> : undefined}>
      {conn && <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
        <QuickForm key={conn.id ?? 'new'} fields={connFields} initial={conn} busy={busy} submitText="Save connection" onCancel={() => setConn(null)}
          onSubmit={async v => { if (await run(() => api(conn.id ? `/api/tracking/reefers/connections/${conn.id}` : '/api/tracking/reefers/connections', { method: conn.id ? 'PUT' : 'POST', body: JSON.stringify({ ...v, secret: v.secret || undefined }) }), 'Saved')) setConn(null); }} />
      </div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Name</th><th className={th}>Service</th><th className={th}>Every</th><th className={th}>Commands</th><th className={th}>Last read</th><th className={th}></th></tr></thead>
        <tbody>
          {(d?.connections || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No connection. Units can still push readings with a device key, or be typed in.</td></tr>}
          {(d?.connections || []).map((c: any) => <tr key={c.id} className={`border-t border-slate-200 ${c.active ? '' : 'opacity-60'}`}>
            <td className={td}><b>{c.name}</b><div className="text-xs text-slate-500">{c.make}</div></td>
            <td className={td}>{c.provider === 'SAMPLE' ? 'Test service' : c.baseUrl}</td>
            <td className={td}>{c.pollSeconds} s</td>
            <td className={td}>{c.canCommand ? 'allowed' : 'no'}</td>
            <td className={td}>{when(c.lastRunAt)} {c.lastStatus && pill(c.lastStatus === 'OK' ? 'green' : c.lastStatus === 'PARTLY' ? 'amber' : 'red', c.lastStatus)}<div className="text-xs text-slate-500">{c.lastMessage}</div></td>
            <td className={`${td} text-right`}>{manager && <button className={btnLight} onClick={() => setConn(c)}>Change</button>}</td>
          </tr>)}
        </tbody>
      </table></div>
    </Section>
  </>;
}
