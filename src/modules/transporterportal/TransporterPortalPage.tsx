/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-009 -- the transporter portal. A transport company signs in on the Transporter tab and, for its own
// company only: accepts or declines loads offered to it, quotes and bids on spot loads and reverse auctions, names
// the truck and driver for loads it won, keeps its trucks, drivers (with consent for the Sarathi check) and
// documents, and follows its trips, freight bills and payments. It never sees the customer, RefTech's selling
// rate, or other transporters' names and prices. Outside the office menu, like the driver page.
//
// Backend: TransporterPortalController (/api/transporter-portal/**), reachable only by a TRANSPORTER login.
// REQ-POD-007: on Trips, the photo of the signed paper delivery note of a hired truck whose driver has no app
// (own trips only). A blurred photo is refused with a request to take it again; RefTech staff confirm the values.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { BrandMark } from '@/shared/components/BrandMark';
import { Banner, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { VEHICLE_TYPES, day, docLabel, rupees } from '@/modules/transporter/transporter';
import { when } from '@/modules/allocation/allocation';
import { KIND_LABEL, OFFER_LABEL, VERIFY_LABEL, call, openFile, pill, upload } from '@/modules/tender/tender';
import { COMMON_UNIT_FIELDS, fmtWeight, toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const P = '/api/transporter-portal';
type Tab = 'home' | 'offers' | 'auctions' | 'awards' | 'fleet' | 'documents' | 'trips' | 'bills';
const TABS: [Tab, string][] = [['home', 'Home'], ['offers', 'Loads offered'], ['auctions', 'Quotes & auctions'], ['awards', 'Awarded loads'], ['fleet', 'Trucks & drivers'],
  ['documents', 'Documents'], ['trips', 'Trips'], ['bills', 'Bills & payments']];

const loadText = (l: any) => <><b>{l.originCity} → {l.destinationCity}</b>, {fmtWeight(l.loadTons)}, {l.temperature}<div className="text-xs text-slate-500">Pickup {when(l.pickupAt)}{l.deliverBy ? ` · deliver by ${when(l.deliverBy)}` : ''} · {l.requestNo}{l.notes ? ` · ${l.notes}` : ''}</div></>;

export function TransporterPortalPage() {
  const user = currentUser();
  const [tab, setTab] = useState<Tab>('home');
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [fleet, setFleet] = useState<any>(null);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('reftech_token')) { window.location.href = '/login?type=TRANSPORTER'; return; }
    if (String(user.role || '').replace('ROLE_', '').toUpperCase() !== 'TRANSPORTER') { window.location.href = '/dashboard'; return; }
  }, []);
  const loadMe = useCallback(() => api(`${P}/me`).then(setMe).catch(x => setError(errorText(x, 'Could not open the portal'))), []);
  const load = useCallback(async () => {
    setData(null);
    try {
      if (tab === 'home') { await loadMe(); return; }
      if (tab === 'awards' || tab === 'fleet') setFleet(await api(`${P}/fleet`));
      const path = { offers: 'offers', auctions: 'auctions', awards: 'awards', fleet: '', documents: 'documents', trips: 'trips', bills: 'bills' }[tab];
      if (path) setData(await api(`${P}/${path}`));
    } catch (x) { setError(errorText(x, 'Could not load')); }
  }, [tab]);
  useEffect(() => { void loadMe(); }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(what: string, f: () => Promise<any>, ok?: string) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await f(); setMsg(ok || r?.message || 'Done.'); await Promise.all([load(), loadMe()]); }
    catch (x) { setError(errorText(x, `Could not ${what}`)); } finally { setBusy(false); }
  }
  function signOut() { api('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => { localStorage.clear(); window.location.href = '/login?type=TRANSPORTER'; }); }
  const go = (t: Tab) => { setTab(t); setMsg(''); setError(''); };

  return <div className="min-h-screen bg-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
      <div className="flex items-center gap-3"><BrandMark /><div><div className="text-lg font-bold">Transporter portal</div><div className="text-xs text-sky-300">{me?.name || ''}{me?.code ? ` · ${me.code}` : ''}</div></div></div>
      <div className="flex items-center gap-3 text-sm"><span>{user.username}</span><button onClick={signOut} className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">Sign out</button></div>
    </header>
    <nav className="flex gap-1 overflow-x-auto bg-white px-2 py-2 shadow-sm">{TABS.map(([k, l]) => <button key={k} onClick={() => go(k)}
      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{l}</button>)}</nav>
    <main className="mx-auto max-w-6xl p-4">
      <Banner msg={msg} error={error} />
      {tab === 'home' && me && <Home me={me} go={go} />}
      {tab === 'offers' && data && <Offers rows={data} busy={busy} run={run} />}
      {tab === 'auctions' && data && <Auctions rows={data} busy={busy} run={run} />}
      {tab === 'awards' && data && <Awards rows={data} fleet={fleet} busy={busy} run={run} />}
      {tab === 'fleet' && fleet && <Fleet f={fleet} busy={busy} run={run} />}
      {tab === 'documents' && data && <Documents rows={data} types={me?.documentTypes || []} busy={busy} run={run} onError={setError} />}
      {tab === 'trips' && data && <Trips rows={data} />}
      {tab === 'trips' && data && <PaperNotes trips={data} />}
      {tab === 'bills' && data && <Bills rows={data} />}
    </main>
  </div>;
}

const Card = ({ title, children }: { title: string; children: any }) => <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-xl font-bold">{title}</h2><div className="mt-3">{children}</div></section>;
type Run = (what: string, f: () => Promise<any>, ok?: string) => Promise<void>;

function Home({ me, go }: { me: any; go: (t: Tab) => void }) {
  const tiles: [Tab, string, number][] = [['offers', 'Loads waiting for your answer', me.offersWaiting], ['auctions', 'Quotes and auctions open', me.auctionsOpen],
    ['awards', 'Won loads waiting for a truck', me.trucksToGive], ['trips', 'Trips running', me.tripsRunning], ['bills', 'Bills not paid yet', me.billsOpen]];
  return <>
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Truck className="h-7 w-7 text-sky-700" />Welcome, {me.name}</h1>
    {me.status !== 'APPROVED' && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-900">Your company is <b>{String(me.status).toLowerCase()}</b> at RefTech. Upload your documents; RefTech approves you before loads are offered.</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{tiles.map(([t, l, n]) => <button key={t} onClick={() => go(t)} className="rounded-2xl bg-white p-4 text-left shadow-sm hover:bg-sky-50">
      <div className="text-3xl font-bold text-sky-800">{n}</div><div className="text-sm text-slate-600">{l}</div></button>)}</div>
    {me.verificationRule === 'BLOCK' && <p className="mt-4 text-sm text-slate-600">RefTech checks each truck on VAHAN and each driver's licence on Sarathi before the truck is placed on a load. Add trucks and drivers (with the driver's consent) under Trucks &amp; drivers.</p>}
  </>;
}

function Offers({ rows, busy, run }: { rows: any[]; busy: boolean; run: Run }) {
  return <Card title="Loads offered to you">
    <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Load</th><th className={`${th} text-right`}>Freight</th><th className={th}>Status</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(o => <tr key={o.id} className="border-t">
        <td className={td}>{loadText(o.load)}<div className="text-xs text-slate-500">{o.tenderNo}</div></td>
        <td className={`${td} text-right font-semibold`}>{rupees(o.amount)}</td>
        <td className={td}><span className={pill(o.status)}>{OFFER_LABEL[o.status] || o.status}</span>{o.status === 'SENT' && <div className="text-xs font-semibold text-red-700">Answer by {when(o.expiresAt)}</div>}{o.responseNote && <div className="text-xs text-slate-500">{o.responseNote}</div>}</td>
        <td className={`${td} whitespace-nowrap text-right`}>{o.status === 'SENT' && <>
          <button disabled={busy} onClick={() => void run('accept', () => call('POST', `${P}/offers/${o.id}/accept`, { note: 'Accepted on the portal' }))} className={btn}>Accept</button>{' '}
          <button disabled={busy} onClick={() => { const r = window.prompt('Why do you decline? (no truck free, rate, ...)'); if (r !== null) void run('decline', () => call('POST', `${P}/offers/${o.id}/decline`, { reason: r })); }} className={btnRed}>Decline</button></>}</td>
      </tr>)}
        {rows.length === 0 && <tr><td colSpan={4} className={`${td} text-slate-500`}>No loads offered right now.</td></tr>}</tbody></table>
  </Card>;
}

function Auctions({ rows, busy, run }: { rows: any[]; busy: boolean; run: Run }) {
  const [amount, setAmount] = useState<Record<number, string>>({});
  return <Card title="Spot quotes and reverse auctions">
    <p className="text-sm text-slate-600">Give your price. In a reverse auction you see your rank, not the others' prices; each new bid must be lower than your last. A bid in the last minutes extends the auction.</p>
    <div className="mt-2 grid gap-3">{rows.map(a => <div key={a.id} className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><div>{loadText(a.load)}</div>
        <div className="text-right"><span className={pill(a.status)}>{KIND_LABEL[a.kind]}</span><div className="text-xs">{a.tenderNo} · closes {when(a.closesAt)}</div>
          {a.ceilingAmount && <div className="text-xs">Ceiling {rupees(a.ceilingAmount)}</div>}{a.minStepAmount && <div className="text-xs">Each bid at least {rupees(a.minStepAmount)} lower</div>}</div></div>
      <div className="mt-2">Your last price: <b>{a.myBids?.[0] ? rupees(a.myBids[0].amount) : 'none'}</b>{a.rank ? <> · your rank <b>{a.rank}</b></> : null}{a.result && <> · <b>{a.result}</b></>}</div>
      {a.canBid && <div className="mt-2 flex flex-wrap gap-2"><input type="number" min="1" value={amount[a.id] || ''} onChange={e => setAmount(x => ({ ...x, [a.id]: e.target.value }))} placeholder="Your price (₹)" className={`${input} max-w-[200px]`} />
        <button disabled={busy || !(Number(amount[a.id]) > 0)} onClick={() => void run('bid', () => call('POST', `${P}/auctions/${a.id}/bids`, { amount: Number(amount[a.id]) }), 'Price sent.').then(() => setAmount(x => ({ ...x, [a.id]: '' })))} className={btn}>Send price</button></div>}
    </div>)}
      {rows.length === 0 && <p className="text-sm text-slate-500">Nothing to quote right now.</p>}</div>
  </Card>;
}

function Awards({ rows, fleet, busy, run }: { rows: any[]; fleet: any; busy: boolean; run: Run }) {
  const [pick, setPick] = useState<Record<number, { v: string; d: string }>>({});
  const set = (id: number, k: 'v' | 'd', val: string) => setPick(x => ({ ...x, [id]: { v: x[id]?.v || '', d: x[id]?.d || '', [k]: val } }));
  return <Card title="Loads you won">
    <div className="grid gap-3">{rows.map(a => <div key={a.id} className="rounded-xl border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><div>{loadText(a.load)}</div><div className="text-right"><b>{rupees(a.amount)}</b><div className="text-xs">{a.tenderNo} · won {when(a.awardedAt)}</div></div></div>
      <div className="mt-2">{a.vehicleNumber ? <>Truck <b>{a.vehicleNumber}</b>, driver <b>{a.driverName}</b></> : <span className="font-semibold text-amber-800">Name the truck and driver.</span>}
        {a.tripNumber && <> · Trip <b>{a.tripNumber}</b> ({String(a.tripStatus).toLowerCase()})</>}</div>
      {(a.verificationProblems || []).length > 0 && <div className="mt-1 text-red-700">RefTech cannot place it yet: {a.verificationProblems.join('; ')}</div>}
      {a.canGiveTruck && fleet && <div className="mt-2 flex flex-wrap gap-2">
        <select value={pick[a.id]?.v || ''} onChange={e => set(a.id, 'v', e.target.value)} className={`${input} max-w-[220px]`}><option value="">Truck</option>
          {fleet.trucks.map((v: any) => <option key={v.id} value={v.id}>{v.vehicleNumber} ({VERIFY_LABEL[v.verification.result] || v.verification.result})</option>)}</select>
        <select value={pick[a.id]?.d || ''} onChange={e => set(a.id, 'd', e.target.value)} className={`${input} max-w-[220px]`}><option value="">Driver</option>
          {fleet.drivers.filter((d: any) => d.active).map((d: any) => <option key={d.id} value={d.id}>{d.name} ({VERIFY_LABEL[d.verification.result] || d.verification.result})</option>)}</select>
        <button disabled={busy || !pick[a.id]?.v || !pick[a.id]?.d} onClick={() => void run('give the truck', () => call('POST', `${P}/awards/${a.id}/truck`, { vehicleId: Number(pick[a.id].v), transporterDriverId: Number(pick[a.id].d) }))} className={btn}>{a.vehicleNumber ? 'Change truck' : 'Give truck'}</button>
        <button disabled={busy} onClick={() => { const r = window.prompt('Why do you give the load back? RefTech offers it to the next transporter.'); if (r) void run('give it back', () => call('POST', `${P}/awards/${a.id}/give-back`, { reason: r })); }} className={btnRed}>Give load back</button>
      </div>}
    </div>)}
      {rows.length === 0 && <p className="text-sm text-slate-500">No won loads.</p>}</div>
  </Card>;
}

function Fleet({ f, busy, run }: { f: any; busy: boolean; run: Run }) {
  function addTruck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const b: any = toBaseFields(Object.fromEntries(new FormData(form)), COMMON_UNIT_FIELDS); for (const k of Object.keys(b)) if (b[k] === '') delete b[k];
    void run('add the truck', () => call('POST', `${P}/trucks`, b)).then(() => form.reset());
  }
  function addDriver(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); const b: any = Object.fromEntries(fd); b.consent = fd.get('consent') === 'on'; for (const k of Object.keys(b)) if (b[k] === '') delete b[k];
    void run('add the driver', () => call('POST', `${P}/drivers`, b)).then(() => form.reset());
  }
  return <>
    <Card title="Trucks">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>Type</th><th className={th}>RefTech check</th><th className={th}>To fix</th></tr></thead>
        <tbody>{f.trucks.map((t: any) => <tr key={t.id} className="border-t"><td className={td}><b>{t.vehicleNumber}</b><div className="text-xs text-slate-500">{t.ownershipType}</div></td>
          <td className={td}>{String(t.vehicleType || '').replace(/_/g, ' ').toLowerCase()}{t.capacityTons ? `, ${fmtWeight(t.capacityTons)}` : ''}</td>
          <td className={td}><span className={pill(t.verification.result)}>{VERIFY_LABEL[t.verification.result] || t.verification.result}</span></td>
          <td className={`${td} text-xs text-red-700`}>{(t.verification.problems || []).join('; ')}</td></tr>)}
          {f.trucks.length === 0 && <tr><td colSpan={4} className={`${td} text-slate-500`}>No trucks yet.</td></tr>}</tbody></table>
      <form onSubmit={addTruck} className="mt-3 grid gap-2 md:grid-cols-4">
        <div><label className={label}>Truck number *</label><input name="vehicleNumber" required placeholder="OD02AB1234" className={input} /></div>
        <div><label className={label}>Type</label><select name="vehicleType" className={input}>{VEHICLE_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className={label}>With RefTech</label><select name="ownershipType" className={input}><option value="ATTACHED">Attached (long-term)</option><option value="MARKET">Per trip</option></select></div>
        <div><label className={label}>Capacity ({unitNow('weight')})</label><input name="capacityTons" type="number" step="any" min="0" className={input} /></div>
        <div><label className={label}>Coldest {unitNow('temp')}</label><input name="minTemperatureC" type="number" step="any" className={input} /></div>
        <div><label className={label}>Warmest {unitNow('temp')}</label><input name="maxTemperatureC" type="number" step="any" className={input} /></div>
        <div className="flex items-end"><button disabled={busy} className={btn}>Add truck</button></div>
      </form>
    </Card>
    <Card title="Drivers">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Driver</th><th className={th}>Licence</th><th className={th}>Consent</th><th className={th}>RefTech check</th><th className={th}></th></tr></thead>
        <tbody>{f.drivers.map((d: any) => <tr key={d.id} className={`border-t ${d.active ? '' : 'text-slate-400'}`}><td className={td}><b>{d.name}</b><div className="text-xs text-slate-500">{d.mobile}</div></td>
          <td className={td}>{d.licenceNumber || '-'}<div className="text-xs text-slate-500">till {day(d.licenceExpiryDate)}</div></td>
          <td className={td}>{d.consentAt ? day(d.consentAt) : 'No'}</td>
          <td className={td}><span className={pill(d.verification.result)}>{VERIFY_LABEL[d.verification.result] || d.verification.result}</span><div className="text-xs text-red-700">{(d.verification.problems || []).join('; ')}</div></td>
          <td className={`${td} text-right`}>{!d.consentAt && d.active && <button disabled={busy} onClick={() => { const dob = window.prompt(`${d.name} agrees that RefTech checks the licence on Sarathi. Date of birth (YYYY-MM-DD):`, d.dateOfBirth || ''); if (dob) void run('record the consent', () => call('POST', `${P}/drivers/${d.id}/consent`, { dateOfBirth: dob })); }} className={btnLight}>Driver agrees</button>}</td></tr>)}
          {f.drivers.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No drivers yet.</td></tr>}</tbody></table>
      <form onSubmit={addDriver} className="mt-3 grid gap-2 md:grid-cols-4">
        <div><label className={label}>Name *</label><input name="name" required className={input} /></div>
        <div><label className={label}>Mobile</label><input name="mobile" className={input} /></div>
        <div><label className={label}>Licence number</label><input name="licenceNumber" className={input} /></div>
        <div><label className={label}>Licence valid to</label><input name="licenceExpiryDate" type="date" className={input} /></div>
        <div><label className={label}>Date of birth</label><input name="dateOfBirth" type="date" className={input} /></div>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="consent" className="h-4 w-4" />The driver agrees that RefTech checks the licence on Sarathi (Parivahan)</label>
        <div className="flex items-end"><button disabled={busy} className={btn}>Add driver</button></div>
      </form>
    </Card>
  </>;
}

function Documents({ rows, types, busy, run, onError }: { rows: any[]; types: string[]; busy: boolean; run: Run; onError: (m: string) => void }) {
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
    for (const [k, v] of Array.from(fd.entries())) if (v === '') fd.delete(k);
    void run('upload the document', () => upload(`${P}/documents`, fd), 'Document uploaded. RefTech verifies it.').then(() => form.reset());
  }
  return <Card title="Documents">
    <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Document</th><th className={th}>Number</th><th className={th}>Valid to</th><th className={th}>Verified by RefTech</th><th className={th}>Files</th></tr></thead>
      <tbody>{rows.map(d => <tr key={d.id} className="border-t"><td className={td}>{docLabel(d.documentType)}</td><td className={td}>{d.documentNumber || '-'}</td><td className={td}>{day(d.validTo)}</td>
        <td className={td}>{d.verified ? 'Yes' : 'Waiting'}</td>
        <td className={td}>{d.files.map((f: any) => <button key={f.id} onClick={() => openFile(`${P}/files/${f.id}`).catch(x => onError(errorText(x, 'Could not open')))} className="mr-2 font-semibold text-sky-700 hover:underline">{f.fileName}</button>)}
          {!d.verified && <label className="ml-1 cursor-pointer text-xs font-semibold text-slate-600 hover:underline">+ file<input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) { const fd = new FormData(); fd.append('file', file); void run('add the file', () => upload(`${P}/documents/${d.id}/files`, fd), 'File added.'); } }} /></label>}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No documents yet.</td></tr>}</tbody></table>
    <form onSubmit={add} className="mt-3 grid gap-2 md:grid-cols-4">
      <div><label className={label}>Document *</label><select name="documentType" required className={input}><option value="">Choose</option>{types.map(t => <option key={t} value={t}>{docLabel(t)}</option>)}</select></div>
      <div><label className={label}>Number</label><input name="documentNumber" className={input} /></div>
      <div><label className={label}>Valid from</label><input name="validFrom" type="date" className={input} /></div>
      <div><label className={label}>Valid to</label><input name="validTo" type="date" className={input} /></div>
      <div className="md:col-span-2"><label className={label}>File (PDF or photo, 5 MB at most) *</label><input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className={input} /></div>
      <div className="flex items-end"><button disabled={busy} className={btn}>Upload</button></div>
    </form>
  </Card>;
}

function Trips({ rows }: { rows: any[] }) {
  return <Card title="Trips">
    <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Route</th><th className={th}>Truck</th><th className={th}>Start</th><th className={th}>Status</th><th className={`${th} text-right`}>Freight</th><th className={`${th} text-right`}>Advance paid</th></tr></thead>
      <tbody>{rows.map(t => <tr key={t.tripId} className="border-t"><td className={td}><b>{t.tripNumber}</b></td><td className={td}>{t.sourceCity} → {t.destinationCity}</td><td className={td}>{t.vehicleNumber}</td>
        <td className={td}>{when(t.plannedStartAt)}</td><td className={td}>{String(t.tripStatus).toLowerCase()}{t.completedAt ? <div className="text-xs">done {when(t.completedAt)}</div> : null}</td>
        <td className={`${td} text-right`}>{rupees(t.agreedFreight)}</td><td className={`${td} text-right`}>{rupees(t.advancePaid)}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No trips yet.</td></tr>}</tbody></table></div>
  </Card>;
}

/** REQ-POD-007: photo of the signed paper delivery note, per delivery of an own trip. */
function PaperNotes({ trips }: { trips: any[] }) {
  const open = trips.filter(t => String(t.bookingStatus) !== 'CANCELLED');
  const [tripId, setTripId] = useState<number | null>(null);
  const [view, setView] = useState<any>(null);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async (id: number) => {
    setError('');
    try { setView(await api(`${P}/trips/${id}/drops`)); } catch (x) { setView(null); setError(errorText(x, 'Could not load the deliveries')); }
  }, []);
  useEffect(() => { if (tripId) void load(tripId); else setView(null); }, [tripId, load]);
  async function send(d: any, f: File | undefined) {
    if (!f || !tripId) return;
    setBusy(true); setMsg(''); setError('');
    try {
      const form = new FormData(); form.append('file', f);
      const r = await upload(`${P}/trips/${tripId}/drops/${d.id}/paper`, form);
      setMsg(r.message || 'Photo received.'); await load(tripId);
    } catch (x) {
      const text = errorText(x, 'The photo could not be sent');
      setError(text.startsWith('The photo is blurred') ? `Take the photo again. ${text}.` : text);
    } finally { setBusy(false); }
  }
  if (open.length === 0) return null;
  return <Card title="Paper delivery note">
    <p className="text-sm text-slate-600">When the driver has no RefTech app, send the photo of the signed and stamped delivery note here. Hold the phone still, fill the screen with the paper, in good light.</p>
    <div className="mt-2 max-w-sm"><label className={label} htmlFor="tp-paper-trip">Trip</label>
      <select id="tp-paper-trip" value={tripId ?? ''} onChange={e => setTripId(e.target.value ? Number(e.target.value) : null)} className={input}>
        <option value="">Choose the trip</option>
        {open.map(t => <option key={t.tripId} value={t.tripId}>{t.tripNumber} · {t.sourceCity} → {t.destinationCity}</option>)}
      </select></div>
    <Banner msg={msg} error={error} />
    {view && !view.ready && <p className="mt-2 text-sm text-amber-800">{view.message}</p>}
    {view && view.ready && <ul className="mt-3 space-y-2 text-sm">{view.drops.map((d: any) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
      <span><b>Delivery {d.sequence}</b>{d.address ? `, ${d.address}` : ''} · {d.status === 'DELIVERED' ? `recorded ${d.podNumber || ''}` : 'not recorded yet'}
        <span className="block text-xs text-slate-500">{d.papers.length === 0 ? 'No photo sent yet.' : d.papers.map((p: any) => `Sent ${when(p.uploadedAt)}${p.confirmedAt ? (p.checkResult === 'MISMATCH' ? ', differs from the proof' : ', checked by RefTech') : ', waiting for RefTech'}`).join(' · ')}</span></span>
      {d.papers.length < (view.maxPerDrop || 5) && <label className={`${btnLight} cursor-pointer`}>{busy ? 'Sending...' : 'Send photo'}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void send(d, f); }} /></label>}
    </li>)}{view.drops.length === 0 && <li className="text-slate-500">This trip has no delivery yet.</li>}</ul>}
  </Card>;
}

function Bills({ rows }: { rows: any[] }) {
  return <Card title="Bills and payments">
    <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Bill</th><th className={th}>Trip</th><th className={`${th} text-right`}>Freight + extras</th><th className={`${th} text-right`}>Deductions</th>
      <th className={`${th} text-right`}>TDS</th><th className={`${th} text-right`}>Advance</th><th className={`${th} text-right`}>Balance</th><th className={th}>Status</th><th className={th}>Payments</th></tr></thead>
      <tbody>{rows.map(b => <tr key={b.id} className="border-t"><td className={td}><b>{b.invoiceNo}</b><div className="text-xs text-slate-500">{b.billNo} · {day(b.invoiceDate)}</div></td><td className={td}>{b.tripNumber}</td>
        <td className={`${td} text-right`}>{rupees(Number(b.freightAmount) + Number(b.extraCharges))}</td>
        <td className={`${td} text-right`}>{rupees(b.deductions)}{b.deductionNote && <div className="text-xs text-slate-500">{b.deductionNote}</div>}</td>
        <td className={`${td} text-right`}>{rupees(b.tdsAmount)}</td><td className={`${td} text-right`}>{rupees(b.advancePaid)}</td><td className={`${td} text-right font-semibold`}>{rupees(b.balancePayable)}</td>
        <td className={td}>{String(b.status).replace(/_/g, ' ').toLowerCase()}{b.statusReason && <div className="text-xs text-red-700">{b.statusReason}</div>}</td>
        <td className={`${td} text-xs`}>{b.payments.map((p: any, i: number) => <div key={i}>{day(p.paidOn)} {p.kind.toLowerCase()} {rupees(p.amount)} {p.mode}{p.reference ? ` ${p.reference}` : ''}</div>)}{b.payments.length === 0 && '-'}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No bills yet.</td></tr>}</tbody></table></div>
  </Card>;
}
