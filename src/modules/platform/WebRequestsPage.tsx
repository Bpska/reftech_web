/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-004 -- Website Requests (/web-requests): what visitors sent from the public pages (pickup and quote
// requests, messages), and the list of branches and warehouses the website locator shows. Staff with WEB_REQUESTS.
// A pickup request becomes a load request (REQ-PRT-003, Load Requests) for an existing partner; a quote request
// keeps the quoted amount (it is the enquiry until a CRM is built). Backend: /api/web-requests/**.
import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { day, inr, post, put, qty, useRunner, when } from '@/modules/cnf/cnf';
import { Grid, Info, Pill } from '@/modules/cnf/CnfKit';
import { WEB_SCRIPT, nextStatuses } from './webRequests';

export function WebRequestsPage() {
  const r = useRunner();
  const [tab, setTab] = useState<'requests' | 'locations'>('requests');
  const [ready, setReady] = useState<any>(null);
  useEffect(() => { api('/api/web-requests/status').then(setReady).catch(x => r.setError((x as Error).message)); }, []);
  if (ready?.ready === false) return <NotReady script={ready.script || WEB_SCRIPT} />;
  return <div>
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Globe className="h-7 w-7 text-sky-700" />Website Requests</h1>
    <p className="mt-1 text-sm text-slate-600">Pickup requests, quote requests and messages from the public website (/pickup), and the places the website locator shows (/locations).</p>
    <div className="mt-4 flex gap-2">
      {(['requests', 'locations'] as const).map(k => <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{k === 'requests' ? 'Requests' : 'Locations'}</button>)}
    </div>
    <Banner msg={r.msg} error={r.error} />
    {tab === 'requests' ? <Requests r={r} /> : <Locations r={r} />}
  </div>;
}

function Requests({ r }: { r: ReturnType<typeof useRunner> }) {
  const [status, setStatus] = useState('OPEN');
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [n, setN] = useState(0);
  useEffect(() => { api(`/api/web-requests?status=${status}&kind=${kind}`).then(x => setRows(x.requests || [])).catch(x => r.setError((x as Error).message)); }, [status, kind, n]);
  useEffect(() => { api('/api/web-requests/partners').then(x => setPartners(x.partners || [])).catch(() => {}); }, []);
  useEffect(() => { if (sel) setSel(rows.find(x => x.id === sel.id) || null); }, [rows]);
  return <>
    <Section title="Requests" right={<div className="flex gap-2">
      <select className={`${input} w-auto`} value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
        {[['OPEN', 'Open (new and contacted)'], ['NEW', 'New'], ['CONTACTED', 'Contacted'], ['QUOTED', 'Quoted'], ['CONVERTED', 'Load request made'], ['CLOSED', 'Closed'], ['SPAM', 'Spam'], ['ALL', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      <select className={`${input} w-auto`} value={kind} onChange={e => setKind(e.target.value)} aria-label="Kind">
        {[['', 'Every kind'], ['PICKUP', 'Pickup'], ['QUOTE', 'Quote'], ['CONTACT', 'Message']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>}>
      <Grid rows={rows} empty="Nothing here." onRow={x => setSel(x)} selected={sel?.id} cols={[
        { key: 'reference', title: 'Reference' }, { key: 'createdAt', title: 'Sent', render: x => when(x.createdAt) }, { key: 'kind', title: 'Kind', render: x => <Pill s={x.kind} /> },
        { key: 'fullName', title: 'Name', render: x => <>{x.fullName}{x.company ? <span className="text-slate-500"> · {x.company}</span> : null}</> }, { key: 'phone', title: 'Phone' },
        { key: 'lane', title: 'From - to', render: x => [x.pickupCity, x.deliveryCity].filter(Boolean).join(' - ') }, { key: 'pickupDate', title: 'Pickup', render: x => day(x.pickupDate) },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
      ]} />
    </Section>
    {sel && <Detail key={sel.id} r={r} x={sel} partners={partners} reload={() => setN(v => v + 1)} />}
  </>;
}

function Detail({ r, x, partners, reload }: { r: ReturnType<typeof useRunner>; x: any; partners: any[]; reload: () => void }) {
  const [note, setNote] = useState(x.staffNote || '');
  const [amount, setAmount] = useState(x.quotedAmount ?? '');
  const [partnerId, setPartnerId] = useState('');
  const [tons, setTons] = useState(x.weightTons ?? '');
  const move = (status: string) => r.run(() => put(`/api/web-requests/${x.id}`, { status, note, quotedAmount: amount === '' ? null : Number(amount) })).then(o => o && reload());
  return <Section title={<>{x.reference} <Pill s={x.status} /></>}>
    <Info items={[['Name', x.fullName], ['Company', x.company], ['Phone', <a className="text-sky-700 underline" href={`tel:${x.phone}`}>{x.phone}</a>], ['Email', x.email],
      ['Pickup', [x.pickupAddress, x.pickupCity, x.pickupPincode].filter(Boolean).join(', ')], ['Delivery', [x.deliveryCity, x.deliveryPincode].filter(Boolean).join(', ')],
      ['Goods', x.goods], ['Temperature', x.temperatureClass], ['Weight', x.weightTons ? `${qty(x.weightTons)} t` : ''], ['Pallets', x.pallets], ['Pickup date', day(x.pickupDate)], ['How often', x.frequency],
      ['Quoted', x.quotedAmount != null ? inr(x.quotedAmount) : ''], ['Load request', x.loadNumber || (x.loadRequestId ? `#${x.loadRequestId}` : '')], ['Handled by', x.handledByName], ['Handled', when(x.handledAt)]]} />
    {x.message && <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm">{x.message}</p>}
    {nextStatuses(x.status).length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-4">
      <label className="text-sm md:col-span-2"><span className={label}>Note</span><input className={input} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
      {x.kind !== 'CONTACT' && <label className="text-sm"><span className={label}>Quoted amount (Rs)</span><input className={input} type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} /></label>}
      <div className="flex flex-wrap items-end gap-2 md:col-span-full">{nextStatuses(x.status).map(s => <button key={s} className={btnLight} disabled={r.busy} onClick={() => move(s)}>Mark {s.toLowerCase()}</button>)}</div>
    </div>}
    {x.kind !== 'CONTACT' && ['NEW', 'CONTACTED', 'QUOTED'].includes(x.status) && <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <h3 className="font-bold">Make a load request</h3>
      <p className="text-sm text-slate-600">For a partner that already exists (add a new customer on Manage Partners first). The load request is REQUESTED; accept it with the rate on Load Requests.</p>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <label className="text-sm"><span className={label}>Partner</span><select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}>
          <option value="">Choose</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="text-sm"><span className={label}>Weight (tons)</span><input className={input} type="number" min={0} step="0.1" value={tons} onChange={e => setTons(e.target.value)} /></label>
        <div className="flex items-end"><button className={btn} disabled={r.busy || !partnerId} onClick={() => r.run(() => post(`/api/web-requests/${x.id}/convert`, { partnerId: Number(partnerId), weightTons: tons === '' ? null : Number(tons), note })).then(o => o && reload())}>Make load request</button></div>
      </div>
    </div>}
  </Section>;
}

function Locations({ r }: { r: ReturnType<typeof useRunner> }) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [n, setN] = useState(0);
  useEffect(() => { api('/api/web-requests/locations').then(x => setRows(x.locations || [])).catch(x => r.setError((x as Error).message)); }, [n]);
  const save = (v: Record<string, unknown>) => r.run(() => (edit?.id ? put(`/api/web-requests/locations/${edit.id}`, v) : post('/api/web-requests/locations', v))).then(o => { if (o) { setEdit(null); setN(x => x + 1); } });
  return <Section title="Locations on the website" right={<div className="flex gap-2">
    <button className={btnLight} onClick={() => r.run(() => post('/api/web-requests/locations/from-warehouses')).then(o => o && setN(x => x + 1))}>Add every warehouse</button>
    <button className={btnLight} onClick={() => setEdit({ kind: 'BRANCH', showOnWebsite: true, active: true })}>Add location</button></div>}>
    <Grid rows={rows} empty="No location yet." onRow={x => setEdit(x)} selected={edit?.id} cols={[
      { key: 'code', title: 'Code' }, { key: 'name', title: 'Name' }, { key: 'kind', title: 'Kind' }, { key: 'city', title: 'City' },
      { key: 'temperatureZones', title: 'Zones', render: x => x.temperatureZones || <span className="text-slate-500">from the chambers</span> },
      { key: 'showOnWebsite', title: 'On website', render: x => (x.showOnWebsite && x.active ? 'Yes' : 'No') },
    ]} />
    {edit && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm key={edit.id ?? 'new'} initial={edit} busy={r.busy} submitText="Save location" onCancel={() => setEdit(null)} cols={4} onSubmit={save} fields={[
      { name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true },
      { name: 'kind', label: 'Kind', type: 'select', required: true, options: [['BRANCH', 'Branch'], ['WAREHOUSE', 'Warehouse'], ['HUB', 'Hub']] },
      { name: 'warehouseId', label: 'Warehouse id (zones from its chambers)', type: 'number' },
      { name: 'address', label: 'Address', wide: true }, { name: 'city', label: 'City' }, { name: 'state', label: 'State' }, { name: 'pincode', label: 'PIN code' },
      { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' }, { name: 'latitude', label: 'Latitude', type: 'number' }, { name: 'longitude', label: 'Longitude', type: 'number' },
      { name: 'openingHours', label: 'Opening hours' }, { name: 'temperatureZones', label: 'Temperature zones (empty = from chambers)' }, { name: 'services', label: 'Services', wide: true },
      { name: 'sortOrder', label: 'Order', type: 'number' }, { name: 'showOnWebsite', label: 'Show on the website', type: 'checkbox' }, { name: 'active', label: 'Active', type: 'checkbox' },
    ]} /></div>}
  </Section>;
}
