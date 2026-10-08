/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-003 -- the notification centre: All (every notification of this login, filters, mark read), Settings
// (channels per category, lowest severity per channel, quiet hours; company defaults for an Admin) and Outbox
// (Admin: what was sent by email, SMS, WhatsApp or push, Retry and Mark sent).
// Routes: /platform/notifications, /platform/notifications/settings, /platform/notifications/outbox.
// Backend: /api/platform/notifications/** (NotificationController).
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, EyeOff, RotateCcw, Send } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, Tabs, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { SEVERITY_STYLE, SeverityIcon, openLink } from './NotificationBell';
import { PushState, disablePush, enablePush, pushProblem, pushState, testPush } from './push';

const CATEGORY_NAMES: Record<string, string> = {
  ACCOUNTS: 'Accounts and logins', SYSTEM: 'System', MONITORING: 'Monitoring', TRIPS: 'Trips and loads', TEMPERATURE: 'Temperature',
  WAREHOUSE: 'Warehouse', BILLING: 'Billing', HR: 'HR', GOVERNMENT: 'Government', GENERAL: 'General',
};
const CHANNEL_NAMES: Record<string, string> = { EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp', PUSH: 'Push' };
const opts = (o: Record<string, string>): [string, string][] => Object.entries(o);

export function NotificationsPage() {
  const s = usePlatform();
  const loc = useLocation(), navigate = useNavigate();
  const tab = loc.pathname.endsWith('/settings') ? 'settings' : loc.pathname.endsWith('/outbox') ? 'outbox' : 'all';
  const go = (t: string) => navigate(t === 'all' ? '/platform/notifications' : `/platform/notifications/${t}`);
  const tabs: [string, string][] = [['all', 'All'], ['settings', 'Settings']];
  if (s?.admin) tabs.push(['outbox', 'Outbox']);
  return <>
    <PageTitle icon={<Bell />} title="Notifications">Messages from every part of RefTech. The bell at the top shows the unread ones.</PageTitle>
    {s && !s.ready ? <ScriptMissing /> : <>
      <Tabs tabs={tabs} value={tab} onChange={go} />
      {tab === 'all' && <AllTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'outbox' && (s?.admin ? <OutboxTab owner={!!s?.owner} /> : <NotAllowed what="open the message outbox (Admin only)" />)}
    </>}
  </>;
}

function AllTab() {
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const r = useRunner(async () => setReload(x => x + 1));
  const read = (n: any) => r.run(() => api(`/api/platform/notifications/${n.id}/read`, { method: 'POST' }), 'Marked as read');
  const dismiss = (n: any) => r.run(() => api(`/api/platform/notifications/${n.id}/dismiss`, { method: 'POST' }), 'Hidden');
  return <Section title="All notifications" right={<button type="button" disabled={r.busy} onClick={() => r.run(() => api('/api/platform/notifications/read-all', { method: 'POST' }))} className={btnLight}>
      <CheckCheck aria-hidden className="mr-1 inline h-4 w-4" />Mark all read</button>}>
    <Banner msg={r.msg} />
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    <DataTable path="/api/platform/notifications" reloadKey={reload} searchPlaceholder="Search title or text"
      filters={[
        { name: 'category', label: 'Category', options: opts(CATEGORY_NAMES) },
        { name: 'severity', label: 'Severity', options: [['CRITICAL', 'Critical'], ['WARN', 'Warning'], ['INFO', 'Information']] },
        { name: 'read', label: 'Read', options: [['false', 'Unread'], ['true', 'Read']] },
      ]}
      columns={[
        { key: 'severity', label: 'Severity', sort: 'severity', render: n => <span className="inline-flex items-center gap-1"><SeverityIcon s={n.severity} /><span className="text-xs font-semibold">{n.severity}</span></span> },
        { key: 'title', label: 'Notification', render: n => <div className={`rounded-lg px-2 py-1 ${SEVERITY_STYLE[n.severity] || ''} ${n.read ? 'opacity-70' : ''}`}>
            <div className={n.read ? '' : 'font-bold'}>{n.title}</div>{n.body && <div className="text-xs text-slate-600">{n.body}</div>}</div> },
        { key: 'category', label: 'Category', render: n => CATEGORY_NAMES[n.category] || n.category },
        { key: 'createdAt', label: 'When', sort: 'createdAt', render: n => when(n.createdAt) },
        { key: 'actions', label: 'Actions', render: n => <div className="flex flex-wrap gap-1">
            {n.link && <button type="button" className={btnLight} onClick={async () => { if (!n.read) await read(n); openLink(n.link, navigate); }}>Open</button>}
            {!n.read && <button type="button" className={btnLight} onClick={() => read(n)}>Mark read</button>}
            <button type="button" className={btnLight} aria-label={`Hide ${n.title}`} title="Hide" onClick={() => dismiss(n)}><EyeOff aria-hidden className="h-4 w-4" /></button>
          </div> },
      ]} />
  </Section>;
}

function SettingsTab() {
  const [d, setD] = useState<any>(null);
  const [mine, setMine] = useState<Record<string, boolean | null>>({}), [company, setCompany] = useState<Record<string, boolean | null>>({});
  const [myMin, setMyMin] = useState<Record<string, string>>({}), [companyMin, setCompanyMin] = useState<Record<string, string>>({});
  const [quietFrom, setQuietFrom] = useState(''), [quietTo, setQuietTo] = useState('');
  const apply = (x: any) => {
    setD(x); setMine(x.mine || {}); setCompany(x.company || {}); setMyMin(x.myMinSeverity || {}); setCompanyMin(x.companyMinSeverity || {});
    setQuietFrom(x.quietFrom ? String(x.quietFrom).slice(0, 5) : ''); setQuietTo(x.quietTo ? String(x.quietTo).slice(0, 5) : '');
  };
  const load = () => api('/api/platform/notifications/preferences').then(apply);
  const r = useRunner();
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  if (!d) return <Section title="Settings"><Banner error={r.err} />{!r.err && <p className="text-slate-500">Loading...</p>}</Section>;
  const categories: string[] = d.categories || [], channels: string[] = d.channels || [];
  const effective = (cat: string, ch: string) => mine[`${cat}:${ch}`] ?? company[`${cat}:${ch}`] ?? false;
  const prefs = (m: Record<string, boolean | null>) => categories.flatMap(c => channels.map(ch => ({ category: c, channel: ch, enabled: m[`${c}:${ch}`] ?? null })));
  const saveMine = () => r.run(async () => apply(await api('/api/platform/notifications/preferences', { method: 'PUT',
    body: JSON.stringify({ prefs: prefs(mine), minSeverity: Object.fromEntries(channels.map(ch => [ch, myMin[ch] || ''])), quietFrom: quietFrom || null, quietTo: quietTo || null }) })), 'Your settings are saved.');
  const saveCompany = () => r.run(async () => apply(await api('/api/platform/notifications/preferences/company', { method: 'PUT',
    body: JSON.stringify({ prefs: prefs(company), minSeverity: Object.fromEntries(channels.map(ch => [ch, companyMin[ch] || ''])) }) })), 'The company defaults are saved.');
  const reset = () => { if (window.confirm('Remove your own choices and use the company defaults?')) void r.run(async () => apply(await api('/api/platform/notifications/preferences/reset', { method: 'POST' })), 'Back to the company defaults.'); };
  const sevSelect = (value: string, set: (v: string) => void, ch: string, builtIn: string, id: string) =>
    <select id={id} className={input} value={value || ''} onChange={e => set(e.target.value)}>
      <option value="">Default ({builtIn})</option>
      {['INFO', 'WARN', 'CRITICAL'].map(v => <option key={v} value={v}>{v === 'INFO' ? 'Everything (INFO and up)' : v === 'WARN' ? 'Warnings and critical' : 'Critical only'}</option>)}
    </select>;
  return <>
    <Banner msg={r.msg} />
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    <Section title="How each channel is set up">
      <ul className="space-y-1 text-sm">
        {Object.entries(d.channelStatus || {}).map(([k, v]) => <li key={k}><b>{k === 'IN_APP' ? 'Bell (in the app)' : CHANNEL_NAMES[k] || k}:</b> {String(v)}</li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Email goes to the email of your login (or your employee record); SMS and WhatsApp to your mobile number. Push goes to each browser where you switch it on below.</p>
    </Section>
    <PushBox />
    <Section title="My channels" right={<div className="flex gap-2"><button type="button" onClick={reset} className={btnLight}><RotateCcw aria-hidden className="mr-1 inline h-4 w-4" />Use company defaults</button>
      <button type="button" disabled={r.busy} onClick={saveMine} className={btn}>Save my settings</button></div>}>
      <p className="mb-2 text-sm text-slate-600">The bell is always on. Tick where else you want each kind of message. A grey tick comes from the company default.</p>
      <ChannelGrid categories={categories} channels={channels} value={mine} fallback={company} onChange={setMine} who="me" effective={effective} />
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {channels.map(ch => <div key={ch}><label htmlFor={`my-min-${ch}`} className={label}>{CHANNEL_NAMES[ch]}: send</label>
          {sevSelect(myMin[ch], v => setMyMin(x => ({ ...x, [ch]: v })), ch, companyMin[ch] || d.builtInMinSeverity?.[ch], `my-min-${ch}`)}</div>)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div><label htmlFor="quiet-from" className={label}>Quiet hours from</label><input id="quiet-from" type="time" className={input} value={quietFrom} onChange={e => setQuietFrom(e.target.value)} /></div>
        <div><label htmlFor="quiet-to" className={label}>Quiet hours to</label><input id="quiet-to" type="time" className={input} value={quietTo} onChange={e => setQuietTo(e.target.value)} /></div>
        <p className="self-end text-xs text-slate-500 md:col-span-2">In quiet hours ({d.timeZone || 'Asia/Kolkata'}) only CRITICAL messages are sent outside the app; the rest wait until the quiet hours end. Leave both empty for none.</p>
      </div>
    </Section>
    {d.admin && <Section title="Company defaults (Admin)" right={<button type="button" disabled={r.busy} onClick={saveCompany} className={btn}>Save company defaults</button>}>
      <p className="mb-2 text-sm text-slate-600">What every login of the company gets unless the person changes it.</p>
      <ChannelGrid categories={categories} channels={channels} value={company} fallback={{}} onChange={setCompany} who="company" effective={(c, ch) => company[`${c}:${ch}`] ?? false} />
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {channels.map(ch => <div key={ch}><label htmlFor={`co-min-${ch}`} className={label}>{CHANNEL_NAMES[ch]}: send</label>
          {sevSelect(companyMin[ch], v => setCompanyMin(x => ({ ...x, [ch]: v })), ch, d.builtInMinSeverity?.[ch], `co-min-${ch}`)}</div>)}
      </div>
    </Section>}
  </>;
}

function ChannelGrid({ categories, channels, value, fallback, onChange, who, effective }: {
  categories: string[]; channels: string[]; value: Record<string, boolean | null>; fallback: Record<string, boolean | null>;
  onChange: (v: Record<string, boolean | null>) => void; who: string; effective: (c: string, ch: string) => boolean;
}) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="bg-slate-50"><th scope="col" className={th}>Category</th><th scope="col" className={th}>Bell</th>
      {channels.map(ch => <th key={ch} scope="col" className={th}>{CHANNEL_NAMES[ch] || ch}</th>)}</tr></thead>
    <tbody>{categories.map(c => <tr key={c} className="border-t">
      <th scope="row" className={`${td} text-left font-semibold`}>{CATEGORY_NAMES[c] || c}</th>
      <td className={td}><input type="checkbox" checked disabled aria-label={`${CATEGORY_NAMES[c] || c} in the bell (always on)`} className="h-4 w-4" /></td>
      {channels.map(ch => {
        const k = `${c}:${ch}`, own = value[k];
        const fromDefault = (own === undefined || own === null) && fallback[k] !== undefined && fallback[k] !== null;
        return <td key={ch} className={td}>
          <input type="checkbox" className={`h-4 w-4 ${fromDefault ? 'opacity-50' : ''}`} checked={effective(c, ch)}
            aria-label={`${CATEGORY_NAMES[c] || c} by ${CHANNEL_NAMES[ch] || ch}${who === 'company' ? ' (company default)' : ''}`}
            onChange={e => onChange({ ...value, [k]: e.target.checked })} />
        </td>;
      })}
    </tr>)}</tbody>
  </table></div>;
}

function OutboxTab({ owner }: { owner: boolean }) {
  const [reload, setReload] = useState(0), [all, setAll] = useState(false);
  const r = useRunner(async () => setReload(x => x + 1));
  const retry = (x: any) => r.run(() => api(`/api/platform/notifications/outbox/${x.id}/retry`, { method: 'POST' }));
  const sent = (x: any) => {
    const note = window.prompt('How was it sent? (optional note)', '');
    if (note === null) return;
    void r.run(() => api(`/api/platform/notifications/outbox/${x.id}/mark-sent`, { method: 'POST', body: JSON.stringify({ note }) }));
  };
  return <Section title="Outbox" right={owner ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="h-4 w-4" />Every company</label> : undefined}>
    <p className="mb-2 text-sm text-slate-600">Messages sent outside the app. MANUAL messages wait here for a person: send them by hand, then press Mark sent.</p>
    <Banner msg={r.msg} />
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    <DataTable path="/api/platform/notifications/outbox" params={{ all: all ? 'true' : undefined }} reloadKey={reload} exportName="message-outbox" searchPlaceholder="Search title, login, address"
      filters={[
        { name: 'status', label: 'Status', options: [['QUEUED', 'Waiting'], ['SENT', 'Sent'], ['FAILED', 'Failed'], ['SKIPPED', 'Skipped']] },
        { name: 'channel', label: 'Channel', options: opts(CHANNEL_NAMES) },
        { name: 'category', label: 'Category', options: opts(CATEGORY_NAMES) },
      ]}
      columns={[
        { key: 'createdAt', label: 'Created', sort: 'createdAt', render: x => when(x.createdAt) },
        ...(all ? [{ key: 'tenantId', label: 'Company' }] : []),
        { key: 'title', label: 'Notification' },
        { key: 'username', label: 'Login' },
        { key: 'channel', label: 'Channel', render: x => CHANNEL_NAMES[x.channel] || x.channel },
        { key: 'address', label: 'Address' },
        { key: 'status', label: 'Status', sort: 'status', render: x => <Badge v={x.status} /> },
        { key: 'provider', label: 'Provider' },
        { key: 'error', label: 'Note / error', className: 'max-w-xs text-xs' },
        { key: 'actions', label: 'Actions', render: x => <div className="flex flex-wrap gap-1">
            {x.status !== 'SENT' && <button type="button" className={btnLight} onClick={() => retry(x)}><Send aria-hidden className="mr-1 inline h-3 w-3" />Retry</button>}
            {(x.status === 'QUEUED' || x.status === 'FAILED') && <button type="button" className={btnLight} onClick={() => sent(x)}>Mark sent</button>}
          </div> },
      ]} />
  </Section>;
}

/** REQ-PLT-003: push on this browser (on / off / test). The Push column above says which messages come. */
function PushBox() {
  const [st, setSt] = useState<PushState | null>(null);
  const r = useRunner();
  const problem = pushProblem();
  useEffect(() => { pushState().then(setSt).catch(e => r.setErr(e.message)); }, []);
  const on = !!st?.thisBrowser;
  return <Section title="Push on this browser">
    <Banner msg={r.msg} />
    {r.err && <div role="alert"><Banner error={r.err} /></div>}
    {!st ? <p className="text-slate-500">Loading...</p> : !st.ready ? <p className="text-sm text-slate-600">{st.message}</p> : <>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4" checked={on} disabled={r.busy || (!on && !!problem)}
          onChange={e => r.run(async () => setSt(await (e.target.checked ? enablePush() : disablePush())), e.target.checked ? 'Push is on for this browser.' : 'Push is off for this browser.')} />
        Show my notifications as push messages on this browser
      </label>
      {problem && !on && <p className="mt-1 text-sm text-amber-800">{problem}</p>}
      <p className="mt-2 text-xs text-slate-500">Push is on in {st.devices || 0} browser(s) of your login. Tick "Push" for the kinds of message you want in the table below.
        The browser must be allowed to show notifications. On a computer, messages arrive while the browser is running; on an iPhone only when the portal was added to the home screen.</p>
      {on && <button type="button" disabled={r.busy} className={`${btnLight} mt-2`} onClick={() => r.run(async () => { const x = await testPush(); setSt(x); return x; })}>Send a test message</button>}
    </>}
  </Section>;
}
