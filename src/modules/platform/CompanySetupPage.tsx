/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-002 / REQ-PLT-011 -- Company Setup (company Admin), three tabs:
//   Checklist            the onboarding steps (ticked by themselves when the data shows them, or by hand) with links
//   Profile & Branding   display and legal name, GSTIN, contacts, logo (PNG, JPG or SVG, at most 1 MB), colours,
//                        invoice footer, website, address
//   Subscription         the same as My Subscription
// Backend: /api/platform/setup (TenantController), /api/platform/branding (BrandingController).
// The tab can be chosen in the address: /platform/setup?tab=branding. /platform/company opens the branding tab.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Settings, Trash2, Upload } from 'lucide-react';
import { api, apiUpload } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { Tabs, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { brandingAsset, reloadBranding } from './branding';
import { SubscriptionView } from './MySubscriptionPage';

function Checklist() {
  const [s, setS] = useState<any>(null);
  const r = useRunner();
  useEffect(() => { api('/api/platform/setup').then(setS).catch(e => r.setErr(e.message)); }, []);
  async function tick(code: string, done: boolean) {
    const x = await r.run(() => api(`/api/platform/setup/steps/${code}`, { method: 'POST', body: JSON.stringify({ done }) }), done ? 'Ticked' : 'Unticked');
    if (x && typeof x === 'object') setS(x);
  }
  if (s?.ready === false) return <ScriptMissing />;
  return <Section title={s ? `Getting started: ${s.done} of ${s.total} done` : 'Getting started'}>
    <Banner msg={r.msg} />
    {r.err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{r.err}</div>}
    <ol className="space-y-2">{(s?.steps || []).map((x: any, i: number) => <li key={x.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-2">
        {x.done ? <CheckCircle2 aria-hidden className="h-5 w-5 text-emerald-600" /> : <Circle aria-hidden className="h-5 w-5 text-slate-400" />}
        <span><b>{i + 1}. {x.title}</b>{x.done && <span className="ml-2 text-xs text-slate-500">{x.doneBy} {when(x.doneAt)}</span>}</span>
      </span>
      <span className="flex gap-2">
        {!x.done && x.link && <Link to={x.link} className={btnLight}>Open</Link>}
        {x.code !== 'COMPANY_CREATED' && <button type="button" disabled={r.busy} className={btnLight} onClick={() => tick(x.code, !x.done)}>{x.done ? 'Untick' : 'Mark done'}</button>}
      </span>
    </li>)}</ol>
  </Section>;
}

function ColourField({ name, title, value }: { name: string; title: string; value?: string | null }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  const ok = /^#[0-9A-Fa-f]{6}$/.test(v);
  return <div>
    <label className={label} htmlFor={`c-${name}`}>{title}</label>
    <div className="flex gap-2">
      <input type="color" aria-label={`${title} picker`} value={ok ? v : '#000000'} onChange={e => setV(e.target.value.toUpperCase())} className="h-10 w-12 rounded-lg border border-slate-300" />
      <input id={`c-${name}`} name={name} value={v} onChange={e => setV(e.target.value)} placeholder="#0369A1" pattern="#[0-9A-Fa-f]{6}" className={input} />
    </div>
    {v && !ok && <p className="text-xs text-red-700">Use # and 6 letters or numbers, like #0369A1.</p>}
  </div>;
}

export function BrandingForm() {
  const [b, setB] = useState<any>(null), [file, setFile] = useState<File | null>(null);
  const r = useRunner();
  useEffect(() => { api('/api/platform/branding').then(setB).catch(e => r.setErr(e.message)); }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(['displayName', 'legalName', 'gstin', 'stateName', 'contactEmail', 'contactPhone', 'primaryColour', 'accentColour', 'supportEmail',
      'supportPhone', 'invoiceFooter', 'website', 'address'].map(k => [k, f.get(k)]));
    const x = await r.run(() => api('/api/platform/branding', { method: 'PUT', body: JSON.stringify(body) }), 'Saved. The new name and colours show at once.');
    if (x && typeof x === 'object') { setB(x); reloadBranding(); }
  }
  async function upload() {
    if (!file) { r.setErr('Choose the logo file first.'); return; }
    if (file.size > (b?.maxLogoBytes || 1048576)) { r.setErr('The logo must be 1 MB or smaller.'); return; }
    const x = await r.run(() => apiUpload('/api/platform/branding/logo', { file }), 'Logo saved');
    if (x && typeof x === 'object') { setB(x); setFile(null); reloadBranding(); }
  }
  async function removeLogo() {
    if (!window.confirm('Remove the logo?')) return;
    const x = await r.run(() => api('/api/platform/branding/logo', { method: 'DELETE' }), 'Logo removed');
    if (x && typeof x === 'object') { setB(x); reloadBranding(); }
  }
  if (b?.ready === false) return <ScriptMissing />;
  if (!b) return <>{r.err ? <NotAllowed what="change the company profile (only an Admin may)" /> : <p className="mt-4 text-slate-500">Loading...</p>}</>;
  const logo = brandingAsset(b.logoUrl);
  const t = (k: string) => b[k] ?? '';
  return <>
    <Banner msg={r.msg} />
    {r.err && <div role="alert" className="my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{r.err}</div>}
    <Section title="Logo">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
          {logo ? <img src={logo} alt="Company logo" className="max-h-16 max-w-[11rem] object-contain" /> : <span className="text-sm text-slate-500">No logo</span>}
        </div>
        <label className={label}>PNG, JPG or SVG, at most 1 MB
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg" onChange={e => setFile(e.target.files?.[0] || null)} className="block text-sm" />
        </label>
        <button type="button" disabled={r.busy || !file} onClick={upload} className={btn}><Upload aria-hidden className="mr-1 inline h-4 w-4" />Upload logo</button>
        {logo && <button type="button" disabled={r.busy} onClick={removeLogo} className={btnRed}><Trash2 aria-hidden className="mr-1 inline h-4 w-4" />Remove</button>}
      </div>
    </Section>
    <Section title="Company profile and colours">
      <form key={String(b.updatedAt)} onSubmit={save} className="grid gap-3 md:grid-cols-3">
        <label className={label}>Name shown in RefTech<input name="displayName" defaultValue={t('displayName')} maxLength={120} placeholder={b.tenantName} className={input} /></label>
        <label className={label}>Legal name<input name="legalName" defaultValue={t('legalName')} maxLength={200} className={input} /></label>
        <label className={label}>GSTIN<input name="gstin" defaultValue={t('gstin')} maxLength={15} className={`${input} uppercase`} /></label>
        <label className={label}>State<input name="stateName" defaultValue={t('stateName')} maxLength={60} className={input} /></label>
        <label className={label}>Contact email<input name="contactEmail" type="email" defaultValue={t('contactEmail')} className={input} /></label>
        <label className={label}>Contact phone<input name="contactPhone" defaultValue={t('contactPhone')} maxLength={30} className={input} /></label>
        <ColourField name="primaryColour" title="Main colour" value={b.primaryColour} />
        <ColourField name="accentColour" title="Second colour" value={b.accentColour} />
        <label className={label}>Website<input name="website" type="url" defaultValue={t('website')} placeholder="https://" className={input} /></label>
        <label className={label}>Support email<input name="supportEmail" type="email" defaultValue={t('supportEmail')} className={input} /></label>
        <label className={label}>Support phone<input name="supportPhone" defaultValue={t('supportPhone')} maxLength={30} className={input} /></label>
        <label className={`${label} md:col-span-3`}>Address<textarea name="address" rows={2} defaultValue={t('address')} maxLength={400} className={input} /></label>
        <label className={`${label} md:col-span-3`}>Invoice footer<textarea name="invoiceFooter" rows={2} defaultValue={t('invoiceFooter')} maxLength={500} className={input} /></label>
        <div className="md:col-span-3"><button disabled={r.busy} className={btn}>Save profile</button>
          {b.updatedBy && <span className="ml-3 text-xs text-slate-500">Last saved by {b.updatedBy} {when(b.updatedAt)}</span>}</div>
      </form>
    </Section>
  </>;
}

export function CompanySetupPage({ initialTab }: { initialTab?: string }) {
  const st = usePlatform();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || initialTab || 'checklist';
  const head = <PageTitle icon={<Settings aria-hidden />} title="Company Setup">Get your company ready: the steps, your logo and colours, and your plan.</PageTitle>;
  if (!st) return head;
  if (!st.ready) return <>{head}<ScriptMissing /></>;
  if (!st.admin) return <>{head}<NotAllowed what="set up the company (only an Admin may)" /></>;
  return <>
    {head}
    <Tabs value={tab} onChange={v => setParams({ tab: v })} tabs={[['checklist', 'Checklist'], ['branding', 'Profile & Branding'], ['subscription', 'Subscription']]} />
    {tab === 'checklist' && <Checklist />}
    {tab === 'branding' && <BrandingForm />}
    {tab === 'subscription' && <SubscriptionView />}
  </>;
}

/** /platform/company: the same page opened on Profile & Branding. */
export function CompanyProfilePage() {
  return <CompanySetupPage initialTab="branding" />;
}
