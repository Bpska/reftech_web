/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-012 -- every outside system in one place: a card per connector (GST, government, tracking, fuel cards,
// Tally, WhatsApp, SMS, email, GPS) with its provider (MANUAL, SAMPLE, HTTP), switch, address, login and a Test
// button. The secret is write only ("set" / "not set"). Settings that older modules still read from
// application.properties are shown read only. Call log tab. Company Admin; the owner may look at every company.
// Route: /platform/integrations. Backend: /api/platform/integrations/** (ConnectorController).
import { FormEvent, useEffect, useState } from 'react';
import { Plug, PlugZap } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { Badge, Tabs, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';

const PROVIDER_TEXT: Record<string, string> = {
  MANUAL: 'MANUAL: people do the work and record it; nothing is called',
  SAMPLE: 'SAMPLE: TEST ONLY, pretend answers, nothing is sent',
  HTTP: 'HTTP: real calls to the address below',
};

export function IntegrationsPage() {
  const s = usePlatform();
  const [tab, setTab] = useState('cards'), [all, setAll] = useState(false);
  const [d, setD] = useState<any>(null), [edit, setEdit] = useState<any>(null);
  const load = () => api('/api/platform/integrations' + (all ? '?all=true' : '')).then(setD);
  const r = useRunner(load);
  useEffect(() => { if (s?.admin && s.ready) load().catch(e => r.setErr(e.message)); }, [s?.admin, s?.ready, all]);
  if (s && !s.admin) return <><PageTitle icon={<Plug />} title="Integrations" /><NotAllowed what="open Integrations (Admin only)" /></>;
  const test = (c: any) => r.run(async () => { const x = await api(`/api/platform/integrations/${c.code}/test`, { method: 'POST' }); await load(); if (!x.ok) throw new Error(x.message); return x; });
  return <>
    <PageTitle icon={<Plug />} title="Integrations">Outside systems RefTech talks to. Everything starts switched off.</PageTitle>
    {s && !s.ready ? <ScriptMissing /> : <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={[['cards', 'Connectors'], ['log', 'Call log']]} value={tab} onChange={setTab} />
        {s?.owner && <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="h-4 w-4" />Every company (view only)</label>}
      </div>
      <Banner msg={r.msg} />
      {r.err && <div role="alert"><Banner error={r.err} /></div>}
      {d?.defaultKey && <div role="alert" className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">CONNECTORS_SECRET_KEY is not set on the server: secrets are kept with the built-in key. Set it before real use, then type the secrets again.</div>}
      {tab === 'cards' && d?.connectors && <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {d.connectors.map((c: any) => <article key={`${c.tenantId}-${c.code}`} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm" aria-label={c.name}>
          <div className="flex items-start justify-between gap-2">
            <div><h2 className="text-lg font-bold">{c.name}</h2><div className="text-xs text-slate-500">{c.code} · {c.category}{all && ` · company ${c.tenantId}`}</div></div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{c.enabled ? 'On' : 'Off'}</span>
          </div>
          <p className="mt-2 text-sm"><b>{c.provider}</b>{c.inherited && <span className="text-slate-500"> (set for the whole installation)</span>}</p>
          {c.baseUrl && <p className="break-all text-xs text-slate-600">{c.baseUrl}</p>}
          <p className="text-xs text-slate-600">Login: {c.authType}{c.authType !== 'NONE' && <> · secret <b>{c.secretSet ? 'set' : 'not set'}</b></>}</p>
          {c.lastTestAt && <p className="text-xs">Last test {when(c.lastTestAt)}: {c.lastTestOk ? <Badge v="OK" /> : <span className="text-red-700">{c.lastError || 'failed'}</span>}</p>}
          {(c.catalogueNote || c.notes) && <p className="mt-2 text-xs text-slate-600">{c.notes || c.catalogueNote}</p>}
          {c.moduleSettings?.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Module settings (read only)</summary>
            <ul className="mt-1 space-y-0.5">{c.moduleSettings.map((m: any, i: number) => <li key={i}>{m.key === 'note' ? m.value : <><code>{m.key}</code> = <b>{m.value}</b> <span className="text-slate-500">({m.note})</span></>}</li>)}</ul></details>}
          {!all && <div className="mt-auto flex gap-2 pt-3">
            {c.code !== 'EMAIL_SMTP' && <button type="button" className={btnLight} onClick={() => setEdit(c)}>Edit</button>}
            {c.code !== 'EMAIL_SMTP' && <button type="button" className={btnLight} disabled={r.busy} onClick={() => test(c)}><PlugZap aria-hidden className="mr-1 inline h-4 w-4" />Test</button>}
          </div>}
        </article>)}
      </div>}
      {tab === 'log' && <Section title="Call log">
        <DataTable path="/api/platform/integrations/calls" params={{ all: all ? 'true' : undefined }} exportName="integration-calls" searchPlaceholder="Search connector, address, error"
          filters={[{ name: 'connector', label: 'Connector', options: (d?.connectors || []).map((c: any) => [c.code, c.name] as [string, string]) }, { name: 'ok', label: 'Result', options: [['true', 'OK'], ['false', 'Failed']] }]}
          columns={[
            { key: 'at', label: 'Time', sort: 'at', render: x => when(x.at) },
            { key: 'connector', label: 'Connector' },
            { key: 'method', label: 'Method' },
            { key: 'url', label: 'Address', className: 'max-w-xs break-all text-xs' },
            { key: 'status', label: 'HTTP' },
            { key: 'ok', label: 'Result', render: x => <Badge v={x.ok ? 'OK' : 'FAILED'} /> },
            { key: 'durationMs', label: 'Time (ms)', sort: 'durationMs' },
            { key: 'error', label: 'Error', className: 'max-w-xs text-xs' },
          ]} />
      </Section>}
      {edit && <EditConnector c={edit} busy={r.busy} onClose={() => setEdit(null)}
        onSave={body => r.run(async () => { await api(`/api/platform/integrations/${edit.code}`, { method: 'PUT', body: JSON.stringify(body) }); setEdit(null); await load(); return { message: `${edit.name} is saved.` }; })} />}
    </>}
  </>;
}

function EditConnector({ c, busy, onClose, onSave }: { c: any; busy: boolean; onClose: () => void; onSave: (body: any) => void }) {
  const [provider, setProvider] = useState(c.provider || 'MANUAL'), [authType, setAuthType] = useState(c.authType || 'NONE');
  const [extra, setExtra] = useState(c.extra && Object.keys(c.extra).length ? JSON.stringify(c.extra, null, 2) : '');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: any = {
      provider, authType, enabled: f.get('enabled') === 'on', baseUrl: f.get('baseUrl') || null, testPath: f.get('testPath') || null,
      username: f.get('username') || null, extra, notes: f.get('notes') || null, clearSecret: f.get('clearSecret') === 'on',
    };
    const secret = String(f.get('secret') || '');
    if (secret) body.secret = secret;
    onSave(body);
  }
  return <div role="dialog" aria-modal="true" aria-label={`Edit ${c.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
    <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <h2 className="text-xl font-bold">{c.name}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><label htmlFor="cx-provider" className={label}>Provider</label>
          <select id="cx-provider" className={input} value={provider} onChange={e => setProvider(e.target.value)}>
            {Object.keys(PROVIDER_TEXT).map(p => <option key={p} value={p}>{p}</option>)}</select>
          <div className="mt-0.5 text-xs text-slate-500">{PROVIDER_TEXT[provider]}</div></div>
        <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="enabled" defaultChecked={!!c.enabled && !c.inherited} className="h-4 w-4" />Switched on</label>
        <div className="md:col-span-2"><label htmlFor="cx-url" className={label}>Address (base URL){provider === 'HTTP' && <span className="text-red-600"> *</span>}</label>
          <input id="cx-url" name="baseUrl" className={input} defaultValue={c.baseUrl || ''} placeholder="https://api.example.com/v1" required={provider === 'HTTP'} /></div>
        <div><label htmlFor="cx-test" className={label}>Test path (GET)</label><input id="cx-test" name="testPath" className={input} defaultValue={c.testPath || ''} placeholder="/health" /></div>
        <div><label htmlFor="cx-auth" className={label}>Login type</label>
          <select id="cx-auth" className={input} value={authType} onChange={e => setAuthType(e.target.value)}>
            <option value="NONE">None</option><option value="API_KEY">API key in a header</option><option value="BASIC">User name and password</option><option value="BEARER">Bearer token</option></select></div>
        {authType === 'BASIC' && <div><label htmlFor="cx-user" className={label}>User name</label><input id="cx-user" name="username" className={input} defaultValue={c.username || ''} autoComplete="off" /></div>}
        {authType !== 'NONE' && <div><label htmlFor="cx-secret" className={label}>{authType === 'BASIC' ? 'Password' : authType === 'BEARER' ? 'Token' : 'API key'} (now {c.secretSet ? 'set' : 'not set'})</label>
          <input id="cx-secret" name="secret" type="password" className={input} autoComplete="new-password" placeholder={c.secretSet ? 'Leave empty to keep it' : ''} />
          {c.secretSet && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="clearSecret" className="h-4 w-4" />Remove the stored secret</label>}</div>}
        <div className="md:col-span-2"><label htmlFor="cx-extra" className={label}>Extra settings (JSON)</label>
          <textarea id="cx-extra" rows={4} className={`${input} font-mono text-xs`} value={extra} onChange={e => setExtra(e.target.value)}
            placeholder='{"path":"/send","templateName":"reftech_alert","apiKeyHeader":"X-Api-Key","headers":{"X-Account":"123"}}' />
          <div className="mt-0.5 text-xs text-slate-500">path (where messages are posted), templateName and language (WhatsApp), sender, apiKeyHeader, headers.</div></div>
        <div className="md:col-span-2"><label htmlFor="cx-notes" className={label}>Notes</label><textarea id="cx-notes" name="notes" rows={2} className={input} defaultValue={c.notes || ''} /></div>
      </div>
      <div className="mt-4 flex gap-2"><button disabled={busy} className={btn}>Save</button><button type="button" onClick={onClose} className={btnLight}>Cancel</button></div>
    </form>
  </div>;
}
