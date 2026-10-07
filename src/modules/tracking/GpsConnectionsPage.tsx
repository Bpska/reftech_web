/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-001 -- GPS Connections: device health of every truck, the GPS provider connectors and the device keys.
//
// Staff page (Employee, Manager, Admin can see it). Only a Manager or an Admin adds or changes a connector,
// runs it, makes a device key or stops one. A key is shown only once, when it is made.
//
// Backend: GET /api/gps/overview, POST/PUT /api/gps/connectors, POST /api/gps/connectors/{id}/test|pull,
// POST /api/gps/keys, POST /api/gps/keys/{id}/revoke (GpsController). Devices send to /api/device/positions.
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Plug, RefreshCw, Satellite } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { DEVICE_STATE, GPS_SCRIPT, minutesText, pill, when } from './tower';

type Connector = {
  id: number; name: string; providerName: string; mode: 'PULL' | 'PUSH'; baseUrl?: string | null; authType: string; authHeaderName?: string | null;
  hasSecret: boolean; listPath?: string | null; fieldVehicle?: string | null; vehicleMatch: string; fieldLatitude?: string | null; fieldLongitude?: string | null;
  fieldSpeed?: string | null; fieldHeading?: string | null; fieldTime?: string | null; fieldTemperature?: string | null; pollSeconds: number; active: boolean;
  lastRunAt?: string | null; lastOkAt?: string | null; lastStatus?: string | null; lastMessage?: string | null; lastPositions?: number | null; positionsTotal?: number | null;
};
type DeviceKey = {
  id: number; kind: 'DEVICE' | 'GATEWAY'; label: string; keyPrefix: string; vehicleId?: number | null; vehicleNumber?: string | null; connectorId?: number | null;
  connectorName?: string | null; expiresAt?: string | null; lastUsedAt?: string | null; lastIp?: string | null; useCount?: number | null; revokedAt?: string | null;
  revokedByName?: string | null; revokeReason?: string | null; createdByName?: string | null; createdAt?: string | null; active: boolean;
};
type Health = {
  id: number; vehicleNumber: string; gpsProvider?: string | null; gpsDeviceId?: string | null; gpsImei?: string | null; lastPositionAt?: string | null;
  lastSource?: string | null; lastSpeedKmph?: number | null; lastConnector?: string | null; lastKey?: string | null; activeKeys?: number | null;
  runningTrip?: string | null; runningTripId?: number | null; positions24h?: number | null; state: string; minutesSinceLast?: number | null;
};
type Overview = { ready: boolean; message?: string; canManage: boolean; connectors: Connector[]; keys: DeviceKey[]; health: Health[]; staleMinutes: number };
type Vehicle = { id: number; vehicleNumber: string };
type RunResult = { connector: string; test: boolean; body: Record<string, any> };

const AUTH_TYPES: [string, string][] = [['NONE', 'None'], ['API_KEY_HEADER', 'API key in a header'], ['BEARER', 'Bearer token'], ['BASIC', 'Basic (user:password)'], ['QUERY_KEY', 'API key in the URL']];
const MATCHES: [string, string][] = [['NUMBER', 'Truck number'], ['DEVICE_ID', 'Device ID'], ['IMEI', 'IMEI']];
const STATES = ['ONLINE', 'LATE', 'SILENT', 'NEVER'];
const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || '(API address)';

export function GpsConnectionsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [editing, setEditing] = useState<Connector | 'new' | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [keyForm, setKeyForm] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/gps/overview')); }
    catch (x) { setErr(errorText(x, 'Could not load the GPS connections')); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!data?.canManage || !keyForm || vehicles.length) return;
    api('/api/admin/vehicles').then(v => setVehicles(Array.isArray(v) ? v : [])).catch(x => setErr(errorText(x, 'Could not load the trucks')));
  }, [data?.canManage, keyForm, vehicles.length]);

  const health = data?.health || [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of health) c[h.state] = (c[h.state] || 0) + 1;
    return c;
  }, [health]);
  const shownHealth = stateFilter ? health.filter(h => h.state === stateFilter) : health;

  async function act<T>(fn: () => Promise<T>, ok: (r: T) => string, fail: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await fn(); setMsg(ok(r)); await load(); return r; }
    catch (x) { setErr(errorText(x, fail)); return null; }
    finally { setBusy(false); }
  }

  async function saveConnector(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [k, v] of f.entries()) if (k !== 'active' && k !== 'secret') body[k] = String(v).trim() || null;
    const secret = String(f.get('secret') || '');
    if (secret) body.secret = secret;
    body.active = f.get('active') === 'on';
    const id = editing && editing !== 'new' ? editing.id : null;
    const r = await act(() => api(id ? `/api/gps/connectors/${id}` : '/api/gps/connectors', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }),
      (c: Connector) => `Connector ${c.name} saved.`, 'Could not save the connector');
    if (r) setEditing(null);
  }

  async function runConnector(c: Connector, test: boolean) {
    setRun(null);
    const r = await act(() => api(`/api/gps/connectors/${c.id}/${test ? 'test' : 'pull'}`, { method: 'POST' }),
      (b: Record<string, any>) => (b.status === 'OK' ? String(b.message || 'Done.') : ''), test ? 'The test did not work' : 'Could not pull the positions');
    if (r) {
      setRun({ connector: c.name, test, body: r });
      if (r.status !== 'OK') setErr(String(r.message || 'The provider call did not work.'));
    }
  }

  async function makeKey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const kind = String(f.get('kind'));
    const body: Record<string, unknown> = { kind, label: String(f.get('label') || '').trim() || null, validDays: String(f.get('validDays') || '').trim() || null };
    if (kind === 'DEVICE') body.vehicleId = f.get('vehicleId') || null;
    else body.connectorId = f.get('connectorId') || null;
    setNewKey(null); setCopied(false);
    const r = await act(() => api('/api/gps/keys', { method: 'POST', body: JSON.stringify(body) }), () => 'Key made. Copy it now.', 'Could not make the key');
    if (r) { setNewKey({ key: String(r.key), message: r.message }); setKeyForm(false); }
  }

  async function stopKey(k: DeviceKey) {
    const reason = window.prompt(`Why is the key "${k.label}" (${k.keyPrefix}) being stopped? The device can no longer send after this.`);
    if (reason === null) return;
    if (!reason.trim()) { setErr('Enter the reason for stopping the key.'); return; }
    await act(() => api(`/api/gps/keys/${k.id}/revoke`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }),
      (r: { message?: string }) => r.message || 'Key stopped.', 'Could not stop the key');
  }

  async function copyKey() {
    if (!newKey) return;
    try { await navigator.clipboard.writeText(newKey.key); setCopied(true); }
    catch { setErr('Could not copy. Select the key and copy it by hand.'); }
  }

  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;
  const manage = Boolean(data?.canManage && data?.ready);

  return <>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Satellite className="h-8 w-8 text-sky-700" />GPS Connections</h1>
        <p className="text-slate-600">Which trucks are sending their position, the GPS providers RefTech reads from, and the keys the trackers send with. Times are India time.</p>
      </div>
      <button type="button" onClick={() => { setMsg(''); setErr(''); void load(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400"><RefreshCw className="h-4 w-4" />Refresh</button>
    </div>
    <Banner msg={msg} error={err} />
    {data && !data.ready && <NotReady script={GPS_SCRIPT} />}
    {data && !data.ready && data.message && <div className="text-sm text-slate-600">{data.message}</div>}
    {!data && !err && <div className="p-8 text-center text-slate-400">Loading...</div>}

    {data && <>
      <Section id="device-health" title="Device health" right={<div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setStateFilter('')} className={`rounded-xl px-3 py-1.5 font-bold ${stateFilter === '' ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>All ({health.length})</button>
        {STATES.map(s => <button key={s} type="button" title={DEVICE_STATE[s].help} onClick={() => setStateFilter(s)}
          className={`rounded-xl px-3 py-1.5 font-bold ${stateFilter === s ? 'bg-sky-700 text-white' : `${DEVICE_STATE[s].pill} hover:opacity-80`}`}>{DEVICE_STATE[s].label} ({counts[s] || 0})</button>)}
      </div>}>
        <p className="mb-2 text-sm text-slate-600">Online means a position came in the last {data.staleMinutes} minutes. Late means older than that but within 24 hours. Silent means nothing for more than 24 hours.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>State</th><th className={th}>Last position</th><th className={th}>Since</th><th className={th}>Source</th><th className={th}>Connector / key</th><th className={th}>Running trip</th><th className={th}>Positions in 24 h</th><th className={th}>Active keys</th></tr></thead>
          <tbody>
            {shownHealth.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">No truck in this list.</td></tr>}
            {shownHealth.map(h => {
              const s = DEVICE_STATE[h.state] || { label: h.state, pill: 'bg-slate-100 text-slate-700', help: '' };
              const device = [h.gpsProvider, h.gpsDeviceId && `ID ${h.gpsDeviceId}`, h.gpsImei && `IMEI ${h.gpsImei}`].filter(Boolean).join(', ');
              return <tr key={h.id} className="border-t border-slate-200">
                <td className={`${td} whitespace-nowrap`}><b>{h.vehicleNumber}</b>{device && <div className="text-xs text-slate-500">{device}</div>}</td>
                <td className={td}><span className={`${pill} ${s.pill}`} title={s.help}>{s.label}</span></td>
                <td className={`${td} whitespace-nowrap`}>{when(h.lastPositionAt)}{h.lastSpeedKmph != null && <div className="text-xs text-slate-500">{Number(h.lastSpeedKmph)} km/h</div>}</td>
                <td className={`${td} whitespace-nowrap`}>{h.minutesSinceLast == null ? '-' : `${minutesText(h.minutesSinceLast)} ago`}</td>
                <td className={td}>{h.lastSource || '-'}</td>
                <td className={td}>{[h.lastConnector, h.lastKey].filter(Boolean).join(' / ') || '-'}</td>
                <td className={`${td} whitespace-nowrap`}>{h.runningTrip && h.runningTripId ? <Link to={`/trips/${h.runningTripId}`} className="font-semibold text-sky-700 hover:underline">{h.runningTrip}</Link> : h.runningTrip || '-'}</td>
                <td className={td}>{h.positions24h ?? 0}</td>
                <td className={td}>{h.activeKeys ?? 0}</td>
              </tr>;
            })}
          </tbody>
        </table></div>
      </Section>

      <Section id="connectors" title={<span className="flex items-center gap-2"><Plug className="h-5 w-5 text-sky-700" />Connectors</span>}
        right={manage && editing === null ? <button type="button" className={btn} onClick={() => { setEditing('new'); setRun(null); }}>Add connector</button> : null}>
        <p className="mb-2 text-sm text-slate-600">PULL: RefTech asks the provider for the positions every few minutes. PUSH: the provider sends them to RefTech with a gateway key.</p>
        {editing !== null && <ConnectorForm c={editing === 'new' ? null : editing} busy={busy} onSubmit={saveConnector} onCancel={() => setEditing(null)} />}
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Name</th><th className={th}>Mode</th><th className={th}>URL</th><th className={th}>Last run</th><th className={th}>Last result</th><th className={th}>Positions total</th><th className={th}>Active</th><th className={th}></th></tr></thead>
          <tbody>
            {data.connectors.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No connector yet.</td></tr>}
            {data.connectors.map(c => <tr key={c.id} className="border-t border-slate-200">
              <td className={td}><b>{c.name}</b><div className="text-xs text-slate-500">{c.providerName}</div></td>
              <td className={td}><span className={`${pill} ${c.mode === 'PULL' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}`}>{c.mode}</span>{c.mode === 'PULL' && <div className="text-xs text-slate-500">every {c.pollSeconds} s</div>}</td>
              <td className={`${td} max-w-[16rem] break-all`}>{c.baseUrl || '-'}<div className="text-xs text-slate-500">{AUTH_TYPES.find(a => a[0] === c.authType)?.[1] || c.authType}{c.authType !== 'NONE' && (c.hasSecret ? ', secret saved' : ', no secret yet')}</div></td>
              <td className={`${td} whitespace-nowrap`}>{when(c.lastRunAt)}{c.lastOkAt && <div className="text-xs text-slate-500">Last OK {when(c.lastOkAt)}</div>}</td>
              <td className={`${td} max-w-[20rem]`}>{c.lastStatus ? <span className={`${pill} ${c.lastStatus === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{c.lastStatus}</span> : '-'}
                {c.lastMessage && <div className="text-xs text-slate-600">{c.lastMessage}</div>}</td>
              <td className={td}>{c.positionsTotal ?? 0}{c.lastPositions != null && <div className="text-xs text-slate-500">last run {c.lastPositions}</div>}</td>
              <td className={td}><span className={`${pill} ${c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{c.active ? 'Yes' : 'No'}</span></td>
              <td className={`${td} text-right`}>{manage && <div className="flex flex-wrap justify-end gap-1.5">
                <button type="button" className={btnLight} disabled={busy} onClick={() => { setEditing(c); setRun(null); }}>Edit</button>
                {c.mode === 'PULL' && <>
                  <button type="button" className={btnLight} disabled={busy} title="Calls the provider once and shows what it read. Nothing is stored." onClick={() => runConnector(c, true)}>Test</button>
                  <button type="button" className={btnLight} disabled={busy} title="Calls the provider now and stores the positions." onClick={() => runConnector(c, false)}>Pull now</button>
                </>}
              </div>}</td>
            </tr>)}
          </tbody>
        </table></div>
        {run && <RunBox r={run} onClose={() => setRun(null)} />}
      </Section>

      <Section id="device-keys" title={<span className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-sky-700" />Device keys</span>}
        right={manage && !keyForm ? <button type="button" className={btn} onClick={() => { setKeyForm(true); setNewKey(null); }}>New key</button> : null}>
        <p className="mb-2 text-sm text-slate-600">A DEVICE key is for one tracker fitted in one truck. A GATEWAY key is for a provider's server that sends for many trucks.</p>
        {newKey && <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <div className="font-bold text-amber-900">The new key. Copy it now: it is not shown again.</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="select-all break-all rounded-lg bg-white px-3 py-2 font-mono text-base text-slate-900">{newKey.key}</code>
            <button type="button" onClick={copyKey} className={`${btnLight} inline-flex items-center gap-1`}><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" onClick={() => setNewKey(null)} className={btnLight}>I have saved it</button>
          </div>
          {newKey.message && <div className="mt-2 text-sm text-amber-900">{newKey.message}</div>}
        </div>}
        {keyForm && <KeyForm vehicles={vehicles} connectors={data.connectors} busy={busy} onSubmit={makeKey} onCancel={() => setKeyForm(false)} />}
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Label</th><th className={th}>Kind</th><th className={th}>Truck / connector</th><th className={th}>Key starts with</th><th className={th}>Last used</th><th className={th}>Uses</th><th className={th}>Expires</th><th className={th}>Status</th><th className={th}></th></tr></thead>
          <tbody>
            {data.keys.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">No device key yet.</td></tr>}
            {data.keys.map(k => <tr key={k.id} className={`border-t border-slate-200 ${k.active ? '' : 'text-slate-500'}`}>
              <td className={td}><b>{k.label}</b>{k.createdByName && <div className="text-xs text-slate-500">made by {k.createdByName}, {when(k.createdAt)}</div>}</td>
              <td className={td}><span className={`${pill} ${k.kind === 'DEVICE' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}`}>{k.kind}</span></td>
              <td className={td}>{k.vehicleNumber || k.connectorName || '-'}</td>
              <td className={`${td} font-mono`}>rtk_{k.keyPrefix}_...</td>
              <td className={`${td} whitespace-nowrap`}>{when(k.lastUsedAt)}{k.lastIp && <div className="text-xs text-slate-500">from {k.lastIp}</div>}</td>
              <td className={td}>{k.useCount ?? 0}</td>
              <td className={`${td} whitespace-nowrap`}>{k.expiresAt ? when(k.expiresAt) : 'Never'}</td>
              <td className={td}>{k.revokedAt
                ? <><span className={`${pill} bg-red-100 text-red-800`}>Stopped</span><div className="text-xs">{when(k.revokedAt)}{k.revokedByName ? ` by ${k.revokedByName}` : ''}{k.revokeReason ? `: ${k.revokeReason}` : ''}</div></>
                : k.active ? <span className={`${pill} bg-emerald-100 text-emerald-800`}>Active</span> : <span className={`${pill} bg-slate-200 text-slate-600`}>Expired</span>}</td>
              <td className={`${td} text-right`}>{manage && !k.revokedAt && <button type="button" className={btnRed} disabled={busy} onClick={() => stopKey(k)}>Stop</button>}</td>
            </tr>)}
          </tbody>
        </table></div>
      </Section>

      <Section id="how-to-send" title="How a device sends">
        <div className="space-y-2 text-sm text-slate-700">
          <p>The tracker (or the provider's server) sends each position to this address with the key in the header <code className="rounded bg-slate-100 px-1">X-Device-Key</code>:</p>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{`POST ${API_BASE}/api/device/positions
X-Device-Key: rtk_xxxxxxxx_...
Content-Type: application/json

{"latitude": 20.2961, "longitude": 85.8245, "speedKmph": 42, "capturedAt": "2026-10-05T10:15:00+05:30", "temperatureC": -18.5}

or many at once (up to 500):
{"positions": [ {...}, {...} ]}`}</pre>
          <p>A DEVICE key already knows its truck. A GATEWAY key must name the truck in each position with <code className="rounded bg-slate-100 px-1">vehicleNumber</code>, <code className="rounded bg-slate-100 px-1">deviceId</code> or <code className="rounded bg-slate-100 px-1">imei</code>, as entered in Manage Vehicles.</p>
          <p>To check a key: <code className="rounded bg-slate-100 px-1">GET {API_BASE}/api/device/ping</code> with the same header.</p>
        </div>
      </Section>
    </>}
  </>;
}

function ConnectorForm({ c, busy, onSubmit, onCancel }: { c: Connector | null; busy: boolean; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const [mode, setMode] = useState(c?.mode || 'PULL');
  const [auth, setAuth] = useState(c?.authType || 'NONE');
  const text = (name: keyof Connector, title: string, opts: { required?: boolean; placeholder?: string; hint?: string; wide?: boolean } = {}) =>
    <div className={opts.wide ? 'md:col-span-2' : ''}>
      <label className={label}>{title}{opts.required && <span className="text-red-600"> *</span>}</label>
      <input name={name} defaultValue={c?.[name] == null ? '' : String(c[name])} required={opts.required} placeholder={opts.placeholder} className={input} />
      {opts.hint && <div className="mt-0.5 text-xs text-slate-500">{opts.hint}</div>}
    </div>;
  return <form key={c?.id ?? 'new'} onSubmit={onSubmit} className="mb-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
    <div className="mb-3 font-bold">{c ? `Change connector ${c.name}` : 'New connector'}</div>
    <div className="grid gap-3 md:grid-cols-4">
      {text('name', 'Name', { required: true, placeholder: 'e.g. Fleetx Odisha' })}
      {text('providerName', 'Provider', { required: true, placeholder: 'e.g. Fleetx' })}
      <div><label className={label}>Mode</label>
        <select name="mode" value={mode} onChange={e => setMode(e.target.value as 'PULL' | 'PUSH')} className={input}><option value="PULL">PULL (RefTech asks)</option><option value="PUSH">PUSH (provider sends)</option></select></div>
      <div><label className={label}>Ask every (seconds)</label>
        <input name="pollSeconds" type="number" min={30} max={3600} defaultValue={c?.pollSeconds ?? 120} className={input} /><div className="mt-0.5 text-xs text-slate-500">30 to 3600</div></div>
      {text('baseUrl', "Provider's URL", { required: mode === 'PULL', wide: true, placeholder: 'https://...', hint: 'The address that lists the positions of all trucks.' })}
      <div><label className={label}>Sign-in type</label>
        <select name="authType" value={auth} onChange={e => setAuth(e.target.value)} className={input}>{AUTH_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
      {text('authHeaderName', 'Header / parameter name', { required: auth === 'API_KEY_HEADER' || auth === 'QUERY_KEY', placeholder: 'e.g. x-api-key' })}
      <div className="md:col-span-2"><label className={label}>Secret (API key, token or user:password)</label>
        <input name="secret" type="password" autoComplete="new-password" className={input} placeholder={c?.hasSecret ? 'Saved. Leave blank to keep it.' : ''} />
        <div className="mt-0.5 text-xs text-slate-500">{c?.hasSecret ? 'A secret is saved. Leave this blank to keep it.' : 'Kept encrypted. It is never shown again.'}</div></div>
      {text('listPath', 'Where the list is', { placeholder: 'e.g. data or result.vehicles', hint: 'Blank when the answer itself is the list.' })}
      {text('fieldVehicle', 'Truck field', { placeholder: 'vehicleNumber' })}
      <div><label className={label}>Truck field holds</label>
        <select name="vehicleMatch" defaultValue={c?.vehicleMatch || 'NUMBER'} className={input}>{MATCHES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
      {text('fieldLatitude', 'Latitude field', { placeholder: 'latitude' })}
      {text('fieldLongitude', 'Longitude field', { placeholder: 'longitude' })}
      {text('fieldSpeed', 'Speed field', { placeholder: 'e.g. speed' })}
      {text('fieldHeading', 'Heading field', { placeholder: 'e.g. heading' })}
      {text('fieldTime', 'Time field', { placeholder: 'e.g. time', hint: 'ISO time or epoch seconds / milliseconds.' })}
      {text('fieldTemperature', 'Temperature field', { placeholder: 'e.g. temp' })}
      <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="active" defaultChecked={c ? c.active : true} className="h-4 w-4" />Active</label>
    </div>
    <div className="mt-3 flex gap-2"><button disabled={busy} className={btn}>{c ? 'Save changes' : 'Add connector'}</button><button type="button" onClick={onCancel} className={btnLight}>Cancel</button></div>
  </form>;
}

function KeyForm({ vehicles, connectors, busy, onSubmit, onCancel }: { vehicles: Vehicle[]; connectors: Connector[]; busy: boolean; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<'DEVICE' | 'GATEWAY'>('DEVICE');
  return <form onSubmit={onSubmit} className="mb-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
    <div className="mb-3 font-bold">New device key</div>
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Kind</label>
        <select name="kind" value={kind} onChange={e => setKind(e.target.value as 'DEVICE' | 'GATEWAY')} className={input}><option value="DEVICE">DEVICE (one truck)</option><option value="GATEWAY">GATEWAY (provider's server)</option></select></div>
      {kind === 'DEVICE'
        ? <div><label className={label}>Truck<span className="text-red-600"> *</span></label>
            <select name="vehicleId" required defaultValue="" className={input}><option value="" disabled>{vehicles.length ? 'Choose the truck' : 'Loading...'}</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select></div>
        : <div><label className={label}>Connector (optional)</label>
            <select name="connectorId" defaultValue="" className={input}><option value="">-</option>{connectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
      <div><label className={label}>Label{kind === 'GATEWAY' && <span className="text-red-600"> *</span>}</label>
        <input name="label" maxLength={120} className={input} placeholder={kind === 'DEVICE' ? 'Blank: Tracker of <truck>' : 'e.g. Fleetx push'} /></div>
      <div><label className={label}>Valid for (days)</label>
        <input name="validDays" type="number" min={1} max={3650} className={input} placeholder="Blank: no end" /></div>
    </div>
    <div className="mt-3 flex gap-2"><button disabled={busy} className={btn}>Make key</button><button type="button" onClick={onCancel} className={btnLight}>Cancel</button></div>
  </form>;
}

function RunBox({ r, onClose }: { r: RunResult; onClose: () => void }) {
  const b = r.body;
  const ok = b.status === 'OK';
  const rows: [string, unknown][] = r.test
    ? [['Positions found', b.found], ['Match a truck', b.matchedTrucks]]
    : [['Positions found', b.found], ['Received', b.received], ['Stored', b.stored], ['Already there', b.duplicates], ['Temperatures', b.temperatures], ['Refused', b.rejectedCount]];
  const unmatched: string[] = Array.isArray(b.unmatched) ? b.unmatched : [];
  const rejected: { index?: number; reason?: string }[] = Array.isArray(b.rejected) ? b.rejected : [];
  return <div className={`mt-4 rounded-xl border p-4 ${ok ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="font-bold">{r.test ? 'Test' : 'Pull now'} of {r.connector}: <span className={ok ? 'text-emerald-800' : 'text-red-800'}>{ok ? 'OK' : 'Did not work'}</span>{r.test && <span className="ml-2 text-sm font-normal text-slate-600">(nothing was stored)</span>}</div>
      <button type="button" onClick={onClose} className={btnLight}>Close</button>
    </div>
    {b.message && <div className="mt-1 text-sm">{String(b.message)}</div>}
    <div className="mt-2 flex flex-wrap gap-3 text-sm">{rows.filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => <div key={k} className="rounded-lg bg-white px-3 py-1.5"><span className="text-slate-500">{k}:</span> <b>{String(v)}</b></div>)}</div>
    {unmatched.length > 0 && <div className="mt-2 text-sm"><b>Not matched:</b><ul className="ml-5 list-disc">{unmatched.map((u, i) => <li key={i}>{u}</li>)}</ul></div>}
    {rejected.length > 0 && <div className="mt-2 text-sm"><b>Refused:</b><ul className="ml-5 list-disc">{rejected.slice(0, 10).map((x, i) => <li key={i}>Row {x.index != null ? Number(x.index) + 1 : '?'}: {x.reason}</li>)}</ul></div>}
    {Array.isArray(b.sample) && b.sample.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">What it read (first {b.sample.length})</summary>
      <pre className="mt-1 overflow-x-auto rounded-lg bg-white p-2 text-xs">{JSON.stringify(b.sample, null, 2)}</pre></details>}
  </div>;
}
