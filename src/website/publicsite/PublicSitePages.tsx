/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-004 -- public pages of the website, no login:
//   /track      track a consignment by its LR number: stage, cities and dates only (never the truck, the driver or
//               the position; the customer's own tracking link /track/:token of REQ-TRK-006 shows more)
//   /pickup     request a pickup, a quote or send a message (?kind=QUOTE / CONTACT); spam checks: a signed form token,
//               a hidden field and a limit per address. Staff see it on Website Requests and turn it into a load request.
//   /locations  our branches and warehouses with their temperature zones; nearest first when the visitor shares the position.
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, LocateFixed, Mail, MapPin, PackageSearch, Phone, Search, Snowflake, Truck } from 'lucide-react';
import { Navbar } from '@/website/Navbar';
import { Footer } from '@/website/Footer';
import { FREQUENCIES, Kind, Location, RequestForm, TEMPERATURES, Tracked, body, distanceText, formInfo, locations, normaliseLr, problems, send, stageIndex, track } from './publicsite';

function Shell({ eyebrow, title, sub, children }: { eyebrow: string; title: ReactNode; sub: ReactNode; children: ReactNode }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return <div className="min-h-screen bg-white"><Navbar /><main className="pt-24">
    <section className="bg-gradient-to-br from-frost-950 via-deep-900 to-frost-900 px-5 py-14 text-white md:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <span className="heading-eyebrow text-frost-300"><span className="h-px w-8 bg-frost-400" />{eyebrow}</span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        <div className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">{sub}</div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
          <Link to="/track" className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">Track a consignment</Link>
          <Link to="/pickup" className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">Request a pickup</Link>
          <Link to="/pickup?kind=QUOTE" className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">Get a quote</Link>
          <Link to="/locations" className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">Our locations</Link>
        </div>
      </div>
    </section>
    {children}
  </main><Footer /></div>;
}

const inp = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-frost-500 focus:ring-2 focus:ring-frost-100';
const lab = 'mb-1 block text-sm font-semibold text-slate-700';
const when = (v?: string | null) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** /track */
export function TrackLrPage() {
  const [params, setParams] = useSearchParams();
  const [lr, setLr] = useState(params.get('lr') || '');
  const [res, setRes] = useState<Tracked | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = 'Track a consignment | RefTech'; if (params.get('lr')) go(params.get('lr') || ''); }, []);
  async function go(typed: string) {
    const n = normaliseLr(typed);
    setRes(null);
    if (!n) { setErr('Type the consignment (LR) number as printed on your receipt, for example CN/26-27/000123.'); return; }
    setBusy(true); setErr('');
    try { setRes(await track(n)); setParams({ lr: n }); } catch (x) { setErr(x instanceof Error ? x.message : 'Please try again.'); } finally { setBusy(false); }
  }
  const idx = res ? stageIndex(res.stage) : -1;
  return <Shell eyebrow="Track" title={<>Where is my <span className="gradient-text">consignment</span>?</>}
    sub="Type the LR (consignment note) number from your receipt. You will see where it is on its way and when it was delivered.">
    <section className="mx-auto max-w-3xl px-5 py-10 md:px-10">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); go(lr); }} className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={lr} onChange={e => setLr(e.target.value)} placeholder="LR number, e.g. CN/26-27/000123" className={`${inp} pl-9 font-mono`} aria-label="LR number" maxLength={40} /></label>
        <button disabled={busy} className="btn-primary justify-center disabled:opacity-60">{busy ? 'Searching…' : 'Track'}</button>
      </form>
      {err && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">{err}</p>}
      {res && <div className="mt-6 rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm text-slate-500">LR number</p><p className="font-mono text-xl font-bold text-deep-900">{res.lrNumber}</p>
            <p className="mt-1 text-slate-700">{res.from} <Truck className="inline h-4 w-4 text-frost-600" /> {res.to}</p></div>
          <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${res.stage === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : res.stage === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-frost-100 text-frost-800'}`}>{res.stageText}</span>
        </div>
        {idx >= 0 && <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Progress">
          {['Booked', 'Loading', 'On the way', 'Reached', 'Delivered'].map((s, i) => <li key={s} className="text-center text-xs">
            <div className={`h-2 rounded-full ${i <= idx ? 'bg-frost-600' : 'bg-slate-200'}`} /><span className={i <= idx ? 'font-semibold text-deep-900' : 'text-slate-500'}>{s}</span></li>)}
        </ol>}
        <ul className="mt-6 space-y-2">{res.steps.map(s => <li key={s.label} className="flex items-center gap-2 text-sm">
          <CheckCircle2 className={`h-4 w-4 ${s.done ? 'text-emerald-600' : 'text-slate-300'}`} /><span className={s.done ? 'text-slate-900' : 'text-slate-500'}>{s.label}</span>
          {s.at && <span className="text-slate-500">· {when(s.at)}</span>}</li>)}</ul>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          {res.expectedBy && res.stage !== 'DELIVERED' && <p><Clock className="mr-1 inline h-4 w-4" />Expected by {when(res.expectedBy)}</p>}
          {res.packages ? <p>{res.packages} packages{res.pallets ? `, ${res.pallets} pallets` : ''}</p> : null}
          {res.temperature && <p><Snowflake className="mr-1 inline h-4 w-4" />{res.temperature}</p>}
        </div>
        {res.helpPhone && <p className="mt-4 text-sm text-slate-600">Questions? Call us on <a className="font-semibold text-frost-700" href={`tel:${res.helpPhone.replace(/\s/g, '')}`}>{res.helpPhone}</a>.</p>}
      </div>}
    </section>
  </Shell>;
}

/** /pickup (?kind=QUOTE or CONTACT) */
export function PickupRequestPage() {
  const [params, setParams] = useSearchParams();
  const kind = (['PICKUP', 'QUOTE', 'CONTACT'].includes(String(params.get('kind')).toUpperCase()) ? String(params.get('kind')).toUpperCase() : 'PICKUP') as Kind;
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);
  useEffect(() => {
    document.title = `${kind === 'QUOTE' ? 'Get a quote' : kind === 'CONTACT' ? 'Write to us' : 'Request a pickup'} | RefTech`;
    setDone(null); setErr([]);
    formInfo(kind).then(f => { setToken(f.formToken); setPhone(f.helpPhone || ''); }).catch(x => setErr([x instanceof Error ? x.message : 'The form is not available right now.']));
  }, [kind]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f: RequestForm = { kind, formToken: token, consent: fd.get('consent') === 'on' };
    fd.forEach((v, k) => { if (k !== 'consent') f[k] = String(v); });
    const p = problems(f, new Date().toISOString().slice(0, 10));
    if (p.length) { setErr(p); return; }
    setBusy(true); setErr([]);
    try { setDone(await send(body(f))); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (x) {
      const m = x instanceof Error ? x.message : 'Your request could not be sent. Please try again.';
      setErr([m]);
      if (/expired|reload/i.test(m)) formInfo(kind).then(i => setToken(i.formToken)).catch(() => {});
    } finally { setBusy(false); }
  }
  const tabs: [Kind, string][] = [['PICKUP', 'Request a pickup'], ['QUOTE', 'Get a quote'], ['CONTACT', 'Write to us']];
  const goods = kind !== 'CONTACT';
  return <Shell eyebrow="Book" title={kind === 'QUOTE' ? <>Get a <span className="gradient-text">quote</span></> : kind === 'CONTACT' ? <>Write to <span className="gradient-text">us</span></> : <>Request a <span className="gradient-text">pickup</span></>}
    sub="No account needed. Tell us what to move and where; our team calls you back to confirm the truck and the rate.">
    <section className="mx-auto max-w-3xl px-5 py-10 md:px-10">
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">{tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setParams({ kind: k })}
        className={`rounded-full px-4 py-2 text-sm font-semibold ${kind === k ? 'bg-frost-600 text-white' : 'border border-slate-300 text-slate-700'}`}>{t}</button>)}</div>
      {done ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <h2 className="mt-3 font-display text-xl font-bold text-emerald-900">Request sent</h2>
        <p className="mt-2 text-emerald-900">{done.message}</p>
        <p className="mt-3 text-sm text-emerald-800">Keep the reference <b>{done.reference}</b>.</p>
        <Link to="/track" className="mt-4 inline-block font-semibold text-emerald-800 underline">Track a consignment</Link>
      </div> : <form key={kind} onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lab} htmlFor="w-name">Your name *</label><input id="w-name" name="fullName" required maxLength={160} autoComplete="name" className={inp} /></div>
          <div><label className={lab} htmlFor="w-company">Company</label><input id="w-company" name="company" maxLength={160} autoComplete="organization" className={inp} /></div>
          <div><label className={lab} htmlFor="w-phone">Mobile number *</label><input id="w-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" placeholder="98765 43210" className={inp} /></div>
          <div><label className={lab} htmlFor="w-email">Email</label><input id="w-email" name="email" type="email" maxLength={160} autoComplete="email" className={inp} /></div>
        </div>
        {goods && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className={lab} htmlFor="w-pc">Pick up from (city) {kind === 'PICKUP' || kind === 'QUOTE' ? '*' : ''}</label><input id="w-pc" name="pickupCity" maxLength={80} className={inp} /></div>
            <div><label className={lab} htmlFor="w-pp">PIN code</label><input id="w-pp" name="pickupPincode" inputMode="numeric" maxLength={6} className={inp} /></div>
            {kind === 'PICKUP' && <div className="sm:col-span-3"><label className={lab} htmlFor="w-pa">Pickup address</label><input id="w-pa" name="pickupAddress" maxLength={300} className={inp} /></div>}
            <div className="sm:col-span-2"><label className={lab} htmlFor="w-dc">Deliver to (city) *</label><input id="w-dc" name="deliveryCity" maxLength={80} className={inp} /></div>
            <div><label className={lab} htmlFor="w-dp">PIN code</label><input id="w-dp" name="deliveryPincode" inputMode="numeric" maxLength={6} className={inp} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lab} htmlFor="w-goods">Goods {kind === 'PICKUP' ? '*' : ''}</label><input id="w-goods" name="goods" maxLength={200} placeholder="Ice cream, dairy, vaccines…" className={inp} /></div>
            <div><label className={lab} htmlFor="w-temp">Temperature *</label><select id="w-temp" name="temperatureClass" className={inp} defaultValue=""><option value="">Choose</option>{TEMPERATURES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            <div><label className={lab} htmlFor="w-tons">Weight (tons)</label><input id="w-tons" name="weightTons" type="number" min={0} max={60} step="0.1" className={inp} /></div>
            <div><label className={lab} htmlFor="w-pal">or pallets</label><input id="w-pal" name="pallets" type="number" min={0} max={100} className={inp} /></div>
            {kind === 'PICKUP' && <div><label className={lab} htmlFor="w-date">Pickup date *</label><input id="w-date" name="pickupDate" type="date" className={inp} /></div>}
            <div><label className={lab} htmlFor="w-freq">How often</label><select id="w-freq" name="frequency" className={inp} defaultValue="ONCE">{FREQUENCIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          </div>
        </>}
        <div><label className={lab} htmlFor="w-msg">{kind === 'CONTACT' ? 'Your message *' : 'Anything else we should know'}</label><textarea id="w-msg" name="message" rows={3} maxLength={2000} className={inp} /></div>
        {/* Spam trap: people never see this field; a robot that fills it in is refused. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" name="consent" className="mt-1" />
          <span>I agree that RefTech may keep these details and call or email me about this request. *</span></label>
        {err.length > 0 && <ul role="alert" className="list-disc space-y-1 rounded-xl bg-red-50 p-3 pl-8 text-sm text-red-800">{err.map(x => <li key={x}>{x}</li>)}</ul>}
        <button disabled={busy || !token} className="btn-primary w-full justify-center disabled:opacity-60">{busy ? 'Sending…' : 'Send request'}</button>
        {phone && <p className="text-center text-sm text-slate-600">In a hurry? Call <a className="font-semibold text-frost-700" href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>.</p>}
      </form>}
    </section>
  </Shell>;
}

/** /locations */
export function LocationsPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Location[] | null>(null);
  const [err, setErr] = useState('');
  const [geoNote, setGeoNote] = useState('');
  const load = (text: string, lat?: number, lng?: number) => locations(text, lat, lng).then(r => { setRows(r.locations || []); setErr(''); }).catch(x => { setErr(x instanceof Error ? x.message : 'Please try again.'); setRows([]); });
  useEffect(() => { document.title = 'Our locations | RefTech'; load(''); }, []);
  const near = () => {
    if (!navigator.geolocation) { setGeoNote('Your browser cannot share its position. Search by city or PIN code.'); return; }
    setGeoNote('Finding you…');
    navigator.geolocation.getCurrentPosition(p => { setGeoNote(''); load(q, p.coords.latitude, p.coords.longitude); }, () => setGeoNote('The position was not shared. Search by city or PIN code.'), { timeout: 10000 });
  };
  return <Shell eyebrow="Locations" title={<>Cold stores and <span className="gradient-text">branches</span></>}
    sub="Find the RefTech branch or temperature-controlled warehouse nearest to you, with its temperature zones and opening hours.">
    <section className="mx-auto max-w-5xl px-5 py-10 md:px-10">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); load(q); }} className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="City, state or PIN code" className={`${inp} pl-9`} aria-label="Search locations" maxLength={80} /></label>
        <button className="btn-primary justify-center">Search</button>
        <button type="button" onClick={near} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700"><LocateFixed className="h-4 w-4" />Near me</button>
      </form>
      {geoNote && <p className="mt-3 text-sm text-slate-600">{geoNote}</p>}
      {err && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">{err}</p>}
      {rows !== null && rows.length === 0 && !err && <p className="mt-6 text-slate-600">No location matches. Try another city, or <Link className="font-semibold text-frost-700 underline" to="/pickup?kind=CONTACT">write to us</Link>.</p>}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {(rows || []).map(l => <li key={l.id} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div>
            <p className="text-xs font-semibold uppercase tracking-wide text-frost-700">{l.kind === 'WAREHOUSE' ? 'Cold store' : l.kind === 'HUB' ? 'Hub' : 'Branch'}</p>
            <h2 className="font-display text-lg font-bold text-deep-900">{l.name}</h2></div>
            {distanceText(l.distanceKm) && <span className="rounded-full bg-frost-50 px-3 py-1 text-xs font-semibold text-frost-800">{distanceText(l.distanceKm)}</span>}</div>
          <p className="mt-2 flex gap-1.5 text-sm text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-frost-600" />{[l.address, l.city, l.state, l.pincode].filter(Boolean).join(', ')}</p>
          {l.temperatureZones && <p className="mt-1 flex gap-1.5 text-sm text-slate-700"><Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-frost-600" />{l.temperatureZones}</p>}
          {l.services && <p className="mt-1 flex gap-1.5 text-sm text-slate-700"><PackageSearch className="mt-0.5 h-4 w-4 shrink-0 text-frost-600" />{l.services}</p>}
          {l.openingHours && <p className="mt-1 flex gap-1.5 text-sm text-slate-700"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-frost-600" />{l.openingHours}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
            {l.phone && <a href={`tel:${l.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-frost-700"><Phone className="h-4 w-4" />{l.phone}</a>}
            {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 text-frost-700"><Mail className="h-4 w-4" />{l.email}</a>}
            {l.latitude != null && l.longitude != null && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`} className="text-frost-700 underline">Map</a>}
          </div>
        </li>)}
      </ul>
    </section>
  </Shell>;
}
