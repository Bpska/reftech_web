/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-013 -- API Keys & Webhooks (company Admin). Keys: make a key (name, scopes, partner, calls per minute,
// expiry, IP addresses), shown once with a Copy button, revoke. Webhooks: addresses that get events, test event,
// switch on/off, delivery log with Redeliver. Call log: every call of the Open API.
// Route: /platform/api (?tab=webhooks|calls). Backend: /api/platform/api/** (ApiAccessController). Guide for
// customer developers: reftech_core/docs/OPEN_API_GUIDE.md.
import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, KeyRound } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, Tabs, day, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';

export function ApiAccessPage() {
  const s = usePlatform();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'webhooks' ? 'webhooks' : sp.get('tab') === 'calls' ? 'calls' : 'keys';
  const [meta, setMeta] = useState<any>(null);
  useEffect(() => { if (s?.admin) api('/api/platform/api/meta').then(setMeta).catch(() => {}); }, [s?.admin]);
  if (s && !s.admin) return <><PageTitle icon={<KeyRound />} title="API Keys & Webhooks" /><NotAllowed what="manage API keys and webhooks (Admin only)" /></>;
  return <>
    <PageTitle icon={<KeyRound />} title="API Keys & Webhooks">Let customer and partner systems read trips, tracking, stock and bills, book loads, and get events.</PageTitle>
    {s && !s.ready ? <ScriptMissing /> : <>
      <Tabs tabs={[['keys', 'Keys'], ['webhooks', 'Webhooks'], ['calls', 'Call log']]} value={tab} onChange={t => setSp(t === 'keys' ? {} : { tab: t })} />
      {tab === 'keys' && <KeysTab meta={meta} />}
      {tab === 'webhooks' && <WebhooksTab meta={meta} />}
      {tab === 'calls' && <Section title="Call log">
        <DataTable path="/api/platform/api/calls" exportName="api-calls" searchPlaceholder="Search key, address, IP"
          filters={[{ name: 'status', label: 'HTTP status', options: [['200', '200 OK'], ['201', '201 Created'], ['400', '400 Bad request'], ['401', '401 Bad key'], ['403', '403 Not allowed'], ['404', '404 Not found'], ['429', '429 Too many'], ['500', '500 Error']] },
            { name: 'method', label: 'Method', options: [['GET', 'GET'], ['POST', 'POST'], ['DELETE', 'DELETE']] }]}
          columns={[
            { key: 'at', label: 'Time', sort: 'at', render: x => when(x.at) },
            { key: 'keyName', label: 'Key', render: x => x.keyName ? <>{x.keyName} <span className="text-xs text-slate-500">{x.keyPrefix}...</span></> : <span className="text-slate-500">no valid key</span> },
            { key: 'method', label: 'Method' },
            { key: 'path', label: 'Address', className: 'max-w-xs break-all text-xs' },
            { key: 'status', label: 'Status', sort: 'status' },
            { key: 'durationMs', label: 'Time (ms)', sort: 'durationMs' },
            { key: 'ip', label: 'IP address' },
          ]} />
      </Section>}
    </>}
  </>;
}

function CopyBox({ title, value, note }: { title: string; value: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return <div role="alert" className="my-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
    <div className="font-bold text-emerald-900">{title}</div>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="break-all rounded-lg bg-white px-3 py-2 font-mono text-sm">{value}</code>
      <button type="button" className={btnLight} onClick={() => { void navigator.clipboard?.writeText(value).then(() => setCopied(true)); }}>
        <Copy aria-hidden className="mr-1 inline h-4 w-4" />{copied ? 'Copied' : 'Copy'}</button>
    </div>
    <p className="mt-2 text-sm text-emerald-900">{note}</p>
  </div>;
}

function KeysTab({ meta }: { meta: any }) {
  const [rows, setRows] = useState<any[]>([]), [made, setMade] = useState<any>(null), [scopes, setScopes] = useState<string[]>(['trips:read', 'tracking:read']);
  const load = async () => { const x = await api('/api/platform/api/keys'); setRows(Array.isArray(x) ? x : []); };
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  const partners: any[] = meta?.partners || [];
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const x = await r.run(() => api('/api/platform/api/keys', { method: 'POST', body: JSON.stringify({
      name: f.get('name'), scopes, partnerId: f.get('partnerId') || null, ratePerMinute: f.get('ratePerMinute') || 60, expiresOn: f.get('expiresOn') || null, allowedIps: f.get('allowedIps') || null,
    }) }), 'Key made.');
    if (x && x.key) { setMade(x); form.reset(); }
  }
  const revoke = (k: any) => { if (window.confirm(`Revoke the key "${k.name}"? Systems using it stop working at once.`)) void r.run(() => api(`/api/platform/api/keys/${k.id}/revoke`, { method: 'POST' })); };
  const partnerName = (id: any) => partners.find(p => p.id === id)?.name || (id ? `#${id}` : 'Whole company');
  return <>
    <Banner msg={r.msg} />
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    {made && <CopyBox title={`The key "${made.name}"`} value={made.key} note="Copy it now and give it to the developer. It is shown only once; RefTech keeps only a fingerprint." />}
    <Section title="Make a key">
      <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
        <div><label htmlFor="k-name" className={label}>Name<span className="text-red-600"> *</span></label><input id="k-name" name="name" required className={input} placeholder="Acme ERP" /></div>
        <div><label htmlFor="k-partner" className={label}>Partner (customer)</label>
          <select id="k-partner" name="partnerId" className={input}><option value="">Whole company</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <div className="mt-0.5 text-xs text-slate-500">A partner key sees only that partner's data. Needed to book loads.</div></div>
        <div><label htmlFor="k-rate" className={label}>Calls per minute</label><input id="k-rate" name="ratePerMinute" type="number" min={1} max={6000} defaultValue={60} className={input} /></div>
        <div><label htmlFor="k-exp" className={label}>Expires on</label><input id="k-exp" name="expiresOn" type="date" className={input} /></div>
        <div className="md:col-span-2"><label htmlFor="k-ips" className={label}>Allowed IP addresses</label><input id="k-ips" name="allowedIps" className={input} placeholder="Empty = any. e.g. 203.0.113.10, 198.51.100.0/24" /></div>
        <fieldset className="md:col-span-3"><legend className={label}>Scopes (what the key may do)</legend>
          <div className="flex flex-wrap gap-3">{(meta?.scopes || []).map((sc: string) => <label key={sc} className="flex items-center gap-1 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={scopes.includes(sc)} onChange={e => setScopes(x => e.target.checked ? [...x, sc] : x.filter(y => y !== sc))} />{sc}</label>)}</div>
        </fieldset>
        <div className="md:col-span-3"><button disabled={r.busy} className={btn}>Make key</button></div>
      </form>
    </Section>
    <Section title="Keys">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="bg-slate-50">{['Name', 'Key starts', 'Partner', 'Scopes', 'Per minute', 'Expires', 'Last used', 'Status', ''].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(k => <tr key={k.id} className="border-t">
          <td className={td}><div className="font-semibold">{k.name}</div><div className="text-xs text-slate-500">by {k.createdBy || '-'} {when(k.createdAt)}</div></td>
          <td className={`${td} font-mono text-xs`}>{k.keyPrefix}...</td>
          <td className={td}>{partnerName(k.partnerId)}</td>
          <td className={`${td} text-xs`}>{String(k.scopes || '').split(',').join(', ')}</td>
          <td className={td}>{k.ratePerMinute}</td>
          <td className={td}>{k.expiresAt ? day(k.expiresAt) : 'Never'}</td>
          <td className={td}>{when(k.lastUsedAt)}</td>
          <td className={td}>{k.revokedAt ? <span title={`Revoked by ${k.revokedBy || '-'}`}><Badge v="REVOKED" /></span> : <Badge v="ACTIVE" />}</td>
          <td className={td}>{!k.revokedAt && <button type="button" className={btnRed} onClick={() => revoke(k)}>Revoke</button>}</td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No keys yet.</td></tr>}</tbody>
      </table></div>
    </Section>
  </>;
}

function WebhooksTab({ meta }: { meta: any }) {
  const [rows, setRows] = useState<any[]>([]), [made, setMade] = useState<any>(null), [events, setEvents] = useState<string[]>(['trip.started', 'trip.delivered']);
  const [reload, setReload] = useState(0), [payload, setPayload] = useState<any>(null);
  const load = async () => { const x = await api('/api/platform/api/webhooks'); setRows(Array.isArray(x) ? x : []); setReload(n => n + 1); };
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  const partners: any[] = meta?.partners || [];
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const x = await r.run(() => api('/api/platform/api/webhooks', { method: 'POST', body: JSON.stringify({ name: f.get('name') || null, url: f.get('url'), events, partnerId: f.get('partnerId') || null }) }), 'Webhook added.');
    if (x && x.secret) { setMade(x); form.reset(); }
  }
  const showPayload = async (id: number) => { try { setPayload(await api(`/api/platform/api/webhooks/deliveries/${id}/payload`)); } catch (e: any) { r.setErr(e.message); } };
  return <>
    <Banner msg={r.msg} />
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    {made && <CopyBox title={`Signing secret of ${made.url}`} value={made.secret} note="Copy it now. The receiver uses it to check the X-RefTech-Signature header. It is shown only once." />}
    <Section title="Add a webhook">
      <form onSubmit={create} className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2"><label htmlFor="w-url" className={label}>Address (https)<span className="text-red-600"> *</span></label><input id="w-url" name="url" required className={input} placeholder="https://erp.example.com/reftech/events" /></div>
        <div><label htmlFor="w-name" className={label}>Name</label><input id="w-name" name="name" className={input} /></div>
        <div><label htmlFor="w-partner" className={label}>Only events of partner</label>
          <select id="w-partner" name="partnerId" className={input}><option value="">Every partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <fieldset className="md:col-span-3"><legend className={label}>Events</legend>
          <div className="flex flex-wrap gap-3">{(meta?.events || []).map((ev: string) => <label key={ev} className="flex items-center gap-1 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={events.includes(ev)} onChange={e => setEvents(x => e.target.checked ? [...x, ev] : x.filter(y => y !== ev))} />{ev}</label>)}</div>
        </fieldset>
        <div className="md:col-span-3"><button disabled={r.busy} className={btn}>Add webhook</button></div>
      </form>
    </Section>
    <Section title="Webhooks">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="bg-slate-50">{['Address', 'Events', 'Partner', 'Status', 'Failures in a row', 'Last delivered', ''].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(w => <tr key={w.id} className="border-t">
          <td className={`${td} break-all`}><div className="font-semibold">{w.name || '-'}</div><div className="text-xs">{w.url}</div></td>
          <td className={`${td} text-xs`}>{String(w.events).split(',').join(', ')}</td>
          <td className={td}>{w.partnerId ? partners.find(p => p.id === w.partnerId)?.name || `#${w.partnerId}` : 'Every partner'}</td>
          <td className={td}>{w.active ? <Badge v="ON" /> : <span title={w.disabledReason || ''}><Badge v="OFF" /></span>}{w.disabledReason && <div className="text-xs text-red-700">{w.disabledReason}</div>}</td>
          <td className={td}>{w.failureCount}</td>
          <td className={td}>{when(w.lastDeliveredAt)}</td>
          <td className={td}><div className="flex flex-wrap gap-1">
            <button type="button" className={btnLight} disabled={!w.active} onClick={() => r.run(() => api(`/api/platform/api/webhooks/${w.id}/test`, { method: 'POST' }))}>Send test event</button>
            <button type="button" className={btnLight} onClick={() => r.run(() => api(`/api/platform/api/webhooks/${w.id}/active`, { method: 'POST', body: JSON.stringify({ active: !w.active }) }))}>{w.active ? 'Switch off' : 'Switch on'}</button>
            <button type="button" className={btnRed} onClick={() => { if (window.confirm(`Delete the webhook to ${w.url}?`)) void r.run(() => api(`/api/platform/api/webhooks/${w.id}`, { method: 'DELETE' })); }}>Delete</button>
          </div></td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No webhooks yet.</td></tr>}</tbody>
      </table></div>
    </Section>
    <Section title="Deliveries">
      <DataTable path="/api/platform/api/webhooks/deliveries" reloadKey={reload} searchPlaceholder="Search event, address, error"
        filters={[{ name: 'status', label: 'Status', options: [['QUEUED', 'Queued'], ['DELIVERED', 'Delivered'], ['FAILED', 'Failed (will retry)'], ['DEAD', 'Dead']] },
          { name: 'event', label: 'Event', options: [...(meta?.events || []), 'test.ping'].map((e: string) => [e, e] as [string, string]) }]}
        columns={[
          { key: 'createdAt', label: 'Created', sort: 'createdAt', render: x => when(x.createdAt) },
          { key: 'event', label: 'Event' },
          { key: 'url', label: 'Address', className: 'max-w-xs break-all text-xs' },
          { key: 'status', label: 'Status', render: x => <Badge v={x.status} /> },
          { key: 'httpStatus', label: 'HTTP' },
          { key: 'attempts', label: 'Tries' },
          { key: 'error', label: 'Error', className: 'max-w-xs text-xs' },
          { key: 'actions', label: 'Actions', render: x => <div className="flex gap-1">
              <button type="button" className={btnLight} onClick={() => showPayload(x.id)}>Body</button>
              <button type="button" className={btnLight} onClick={() => r.run(() => api(`/api/platform/api/webhooks/deliveries/${x.id}/redeliver`, { method: 'POST' }))}>Redeliver</button>
            </div> },
        ]} />
      {payload && <div className="mt-3"><div className="flex items-center justify-between"><h3 className="font-bold">Body of delivery {payload.id}</h3>
        <button type="button" className={btnLight} onClick={() => setPayload(null)}>Close</button></div>
        <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{(() => { try { return JSON.stringify(JSON.parse(payload.payload), null, 2); } catch { return payload.payload; } })()}</pre></div>}
    </Section>
  </>;
}
