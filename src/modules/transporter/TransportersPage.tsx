/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-001 -- Transporter master and onboarding; own, attached or market truck.
//   Transporters: profile (GSTIN with its check character, PAN, bank), contacts, lanes served, documents
//   (GST certificate, PAN card and cancelled cheque must be on file before approval), drivers and trucks.
//   Onboarding: Draft -> Send for approval (the checklist must be complete) -> an Admin approves. Changing
//   the GSTIN, PAN or bank details of an approved transporter sends it back for approval. Who sent it may
//   not approve it unless app.transporter.allow-self-approval=true.
//   Fleet ownership: every truck of the vehicle master is OWN, ATTACHED (a transporter's truck working for
//   RefTech long-term) or MARKET (hired per trip).
//
// Backend: TransporterController (/api/transporters/**).
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, td, th } from '@/shared/components/FormKit';
import { OWNERSHIP, SCRIPT, STATE_LABEL, VEHICLE_TYPES, day, docLabel, role, tag } from './transporter';
import { fmtTempRange, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const PROFILE: Field[] = [
  { name: 'transporterCode', label: 'Code', required: true, placeholder: 'KRL' }, { name: 'name', label: 'Trade name', required: true }, { name: 'legalName', label: 'Legal name' },
  { name: 'gstin', label: 'GSTIN', placeholder: '21AAKCK4321M1ZL' }, { name: 'pan', label: 'PAN', placeholder: 'AAKCK4321M', hint: 'Must match characters 3-12 of the GSTIN' },
  { name: 'reeferCapable', label: 'Runs reefer trucks', type: 'checkbox' },
  { name: 'address', label: 'Address', wide: true }, { name: 'city', label: 'City' }, { name: 'state', label: 'State' }, { name: 'postalCode', label: 'PIN code' },
  { name: 'contactName', label: 'Main contact' }, { name: 'contactPhone', label: 'Phone' }, { name: 'contactEmail', label: 'Email' },
  { name: 'bankAccountName', label: 'Bank account name' }, { name: 'bankAccountNumber', label: 'Account number' }, { name: 'bankIfsc', label: 'IFSC', placeholder: 'HDFC0001234' },
  { name: 'bankName', label: 'Bank' }, { name: 'bankBranch', label: 'Branch' }, { name: 'notes', label: 'Notes', wide: true },
];

export function TransportersPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'fleet' ? 'fleet' : 'list';
  const id = Number(params.get('id') || 0);
  const [status, setStatus] = useState('');
  const [list, setList] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try { setList(await api(`/api/transporters${status ? `?status=${status}` : ''}`)); }
    catch (x) { setError(errorText(x, 'Could not load the transporters')); }
  }, [status]);
  const loadOne = useCallback(async () => {
    if (!id) { setT(null); return; }
    try { setT(await api(`/api/transporters/${id}`)); }
    catch (x) { setError(errorText(x, 'Could not load the transporter')); }
  }, [id]);
  useEffect(() => { if (me.staff) void loadList(); }, [loadList]);
  useEffect(() => { if (me.staff) void loadOne(); }, [loadOne]);

  /** Runs a change; the backend answers with the transporter (and a message). */
  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await action(); setMsg(r?.message || done); if (r?.id && r?.transporterCode && r.id === id) setT(r); else await loadOne(); await loadList(); return r ?? true; }
    catch (x) { setError(errorText(x, 'Could not save')); return null; }
    finally { setBusy(false); }
  }
  const call = (method: string, path: string, body?: unknown) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Transporters</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Handshake className="h-8 w-8 text-sky-700" />Transporters</h1>
    <p className="text-slate-600">Transport companies whose trucks work for RefTech, their onboarding, and who owns each truck.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button onClick={() => setParams({})} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'list' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>Transporters</button>
      <button onClick={() => setParams({ tab: 'fleet' })} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'fleet' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>Fleet ownership</button>
      <Link to="/transporters/contracts" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">Rate contracts</Link>
    </div>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script={SCRIPT} />}
    {list?.ready && tab === 'fleet' && <Fleet transporters={list.transporters} me={me} busy={busy} run={run} call={call} />}
    {list?.ready && tab === 'list' && <>
      {adding && <Section title="Add a transporter"><QuickForm fields={PROFILE} busy={busy} submitText="Add transporter" onCancel={() => setAdding(false)}
        onSubmit={v => run(() => call('POST', '/api/transporters', v), 'Transporter added.').then(r => { if (r?.id) { setAdding(false); setParams({ id: String(r.id) }); } })} /></Section>}
      {t && <Detail t={t} me={me} busy={busy} run={run} call={call} allowSelf={list.allowSelfApproval} documentTypes={list.documentTypes || []} onClose={() => setParams({})} />}
      <Section title="Transporters" right={<div className="flex gap-2">
        <select value={status} onChange={x => setStatus(x.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="">All</option>
          {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED'].map(s => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}</select>
        {me.manager && <button onClick={() => setAdding(true)} className={btn}>Add transporter</button>}</div>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Transporter</th><th className={th}>GSTIN</th><th className={th}>Contact</th><th className={th}>Status</th>
            <th className={`${th} text-right`}>Trucks</th><th className={`${th} text-right`}>Drivers</th><th className={`${th} text-right`}>Lanes</th><th className={`${th} text-right`}>Contracts in force</th><th className={th}>Papers</th></tr></thead>
          <tbody>{list.transporters.map((x: any) => <tr key={x.id} onClick={() => setParams({ id: String(x.id) })} className={`cursor-pointer border-t hover:bg-sky-50 ${x.id === id ? 'bg-sky-50' : ''} ${x.active ? '' : 'opacity-60'}`}>
            <td className={td}><b>{x.name}</b><div className="text-xs text-slate-500">{x.transporterCode} · {x.city || ''}{x.reeferCapable ? ' · reefer' : ''}</div></td>
            <td className={`${td} font-mono`}>{x.gstin || '-'}</td><td className={td}>{x.contactName || '-'}<div className="text-xs text-slate-500">{x.contactPhone || ''}</div></td>
            <td className={td}><span className={tag(x.onboardingStatus)}>{STATE_LABEL[x.onboardingStatus] || x.onboardingStatus}</span></td>
            <td className={`${td} text-right`}>{x.truckCount}</td><td className={`${td} text-right`}>{x.driverCount}</td><td className={`${td} text-right`}>{x.laneCount}</td><td className={`${td} text-right`}>{x.contractsInForce}</td>
            <td className={td}>{x.documentsExpiringSoon > 0 ? <span className="font-semibold text-amber-700">{x.documentsExpiringSoon} expiring or expired</span> : 'OK'}</td>
          </tr>)}
            {list.transporters.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No transporters.</td></tr>}</tbody></table></div>
      </Section>
    </>}
  </>;
}

function Detail({ t, me, busy, run, call, allowSelf, documentTypes, onClose }: {
  t: any; me: ReturnType<typeof role>; busy: boolean; run: (a: () => Promise<any>, done: string) => Promise<any>;
  call: (m: string, p: string, b?: unknown) => Promise<any>; allowSelf: boolean; documentTypes: string[]; onClose: () => void;
}) {
  const [edit, setEdit] = useState('');
  const base = `/api/transporters/${t.id}`;
  const s = t.onboardingStatus;
  const reasonThen = (action: string, text: string) => { const r = window.prompt(text); if (r !== null) void run(() => call('POST', `${base}/${action}`, { reason: r }), 'Saved.'); };
  const add = (key: string, title: string, fields: Field[], path: string, done: string) => edit === key && <div className="mt-2 rounded-xl bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold">{title}</div>
    <QuickForm fields={fields} busy={busy} submitText="Add" onCancel={() => setEdit('')} onSubmit={v => run(() => call('POST', `${base}/${path}`, v), done).then(r => { if (r) setEdit(''); })} /></div>;
  const addBtn = (key: string, text: string) => me.manager && <button onClick={() => setEdit(edit === key ? '' : key)} className={btnLight}>{text}</button>;
  const remove = (path: string, what: string) => { if (window.confirm(`Remove ${what}?`)) void run(() => call('DELETE', `${base}/${path}`), `${what} removed.`); };

  return <Section id="transporter" title={<>{t.name} <span className={tag(s)}>{STATE_LABEL[s] || s}</span></>} right={<div className="flex flex-wrap gap-2">
    {me.manager && <button onClick={() => setEdit(edit === 'profile' ? '' : 'profile')} className={btnLight}>Edit profile</button>}
    {me.manager && ['DRAFT', 'REJECTED'].includes(s) && <button disabled={busy} onClick={() => void run(() => call('POST', `${base}/submit`), 'Sent for approval.')} className={btn}>Send for approval</button>}
    {me.admin && s === 'SUBMITTED' && <button disabled={busy} onClick={() => void run(() => call('POST', `${base}/approve`), 'Approved.')} className={btn}>Approve</button>}
    {me.admin && s === 'SUBMITTED' && <button disabled={busy} onClick={() => reasonThen('reject', 'Reason for rejecting:')} className={btnRed}>Reject</button>}
    {me.manager && s === 'APPROVED' && <button disabled={busy} onClick={() => reasonThen('suspend', 'Reason for suspending:')} className={btnRed}>Suspend</button>}
    {me.admin && s === 'SUSPENDED' && <button disabled={busy} onClick={() => reasonThen('reactivate', 'Why can it work again?')} className={btnLight}>Reactivate</button>}
    <button onClick={onClose} className={btnLight}>Close</button></div>}>
    <div className="grid gap-3 text-sm md:grid-cols-3">
      <div><div className="text-slate-500">{t.transporterCode} · {t.legalName || t.name}</div><div>GSTIN <b className="font-mono">{t.gstin || '-'}</b> · PAN <b className="font-mono">{t.pan || '-'}</b></div>
        <div>{[t.address, t.city, t.state, t.postalCode].filter(Boolean).join(', ') || '-'}</div></div>
      <div>{t.contactName || '-'} · {t.contactPhone || ''} · {t.contactEmail || ''}<div>Bank: {t.bankName || '-'} {t.bankBranch || ''} · A/c <span className="font-mono">{t.bankAccountNumber || '-'}</span> · IFSC <span className="font-mono">{t.bankIfsc || '-'}</span></div></div>
      <div>{t.submittedAt && <div>Sent by {t.submittedByName} on {day(t.submittedAt)}</div>}{t.approvedAt && <div>Approved by {t.approvedByName} on {day(t.approvedAt)}</div>}
        {t.statusReason && <div className="text-amber-800">{t.statusReason}</div>}
        {s === 'SUBMITTED' && !allowSelf && <div className="text-xs text-slate-500">An Admin other than the one who sent it approves (four-eyes).</div>}</div>
    </div>
    {t.checklist?.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Before sending for approval:</b><ul className="ml-5 list-disc">{t.checklist.map((c: string) => <li key={c}>{c}</li>)}</ul></div>}
    {edit === 'profile' && <div className="mt-3 rounded-xl bg-slate-50 p-3"><div className="mb-2 text-sm text-slate-600">{s === 'APPROVED' ? 'Changing the GSTIN, PAN or bank details sends the transporter back for approval.' : ''}</div>
      <QuickForm fields={PROFILE} initial={t} busy={busy} submitText="Save" onCancel={() => setEdit('')} onSubmit={v => run(() => call('PUT', base, v), 'Saved.').then(r => { if (r) setEdit(''); })} /></div>}

    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border p-3"><div className="flex items-center justify-between"><b>Documents</b>{addBtn('doc', 'Add document')}</div>
        {add('doc', 'Add a document', [{ name: 'documentType', label: 'Type', type: 'select', required: true, options: documentTypes.map(d => [d, docLabel(d)]) },
          { name: 'documentNumber', label: 'Number' }, { name: 'validFrom', label: 'Valid from', type: 'date' }, { name: 'validTo', label: 'Valid to', type: 'date' }, { name: 'notes', label: 'Notes', wide: true }], 'documents', 'Document added.')}
        <table className="mt-2 w-full text-sm"><tbody>{t.documents.map((d: any) => <tr key={d.id} className="border-t">
          <td className={td}><b>{docLabel(d.documentType)}</b><div className="text-xs text-slate-500">{d.documentNumber || ''}</div></td>
          <td className={`${td} ${d.expired ? 'font-bold text-red-700' : ''}`}>{d.validTo ? `to ${day(d.validTo)}` : 'no end date'}{d.expired && ' (expired)'}</td>
          <td className={td}>{d.verified ? <span className="text-emerald-700">Verified by {d.verifiedByName}</span> : me.manager ? <button disabled={busy} onClick={() => void run(() => call('POST', `${base}/documents/${d.id}/verify`), 'Document verified.')} className={btnLight}>Verify</button> : 'Not verified'}</td>
          <td className={`${td} text-right`}>{me.manager && <button onClick={() => remove(`documents/${d.id}`, 'the document')} className={btnRed}>Remove</button>}</td></tr>)}
          {t.documents.length === 0 && <tr><td className={`${td} text-slate-500`}>No documents.</td></tr>}</tbody></table></div>

      <div className="rounded-xl border p-3"><div className="flex items-center justify-between"><b>Lanes served</b>{addBtn('lane', 'Add lane')}</div>
        {add('lane', 'Add a lane', [{ name: 'originCity', label: 'From', required: true }, { name: 'destinationCity', label: 'To', required: true }, { name: 'reefer', label: 'Reefer', type: 'checkbox' }, { name: 'notes', label: 'Notes' }], 'lanes', 'Lane added.')}
        <div className="mt-2 flex flex-wrap gap-2">{t.lanes.map((l: any) => <span key={l.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">{l.originCity} → {l.destinationCity}{l.reefer ? ' (reefer)' : ''}
          {me.manager && <button onClick={() => remove(`lanes/${l.id}`, 'the lane')} className="ml-2 text-red-600">×</button>}</span>)}
          {t.lanes.length === 0 && <span className="text-sm text-slate-500">No lanes.</span>}</div>

        <div className="mt-4 flex items-center justify-between"><b>Contacts</b>{addBtn('contact', 'Add contact')}</div>
        {add('contact', 'Add a contact', [{ name: 'name', label: 'Name', required: true }, { name: 'designation', label: 'Designation' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' }], 'contacts', 'Contact added.')}
        <table className="mt-2 w-full text-sm"><tbody>{t.contacts.map((c: any) => <tr key={c.id} className="border-t"><td className={td}><b>{c.name}</b><div className="text-xs text-slate-500">{c.designation || ''}</div></td><td className={`${td} break-all`}>{c.phone || ''}<div className="text-xs">{c.email || ''}</div></td>
          <td className={`${td} text-right`}>{me.manager && <button onClick={() => remove(`contacts/${c.id}`, 'the contact')} className={btnRed}>Remove</button>}</td></tr>)}</tbody></table></div>

      <div className="rounded-xl border p-3"><div className="flex items-center justify-between"><b>Trucks</b>{addBtn('truck', 'Add truck')}</div>
        {add('truck', 'Add a truck (a new number is added to the vehicle master)', [{ name: 'vehicleNumber', label: 'Registration number', required: true, placeholder: 'OD02AB1234' },
          { name: 'ownershipType', label: 'Ownership', type: 'select', required: true, options: OWNERSHIP.slice(1) }, { name: 'vehicleType', label: 'Type', type: 'select', required: true, options: VEHICLE_TYPES },
          { name: 'capacityTons', label: 'Capacity', type: 'number', unit: 'weight' }, { name: 'minTemperatureC', label: 'Min temperature', type: 'number', unit: 'temp' }, { name: 'maxTemperatureC', label: 'Max temperature', type: 'number', unit: 'temp' },
          { name: 'make', label: 'Make' }, { name: 'model', label: 'Model' }], 'trucks', 'Truck added.')}
        <table className="mt-2 w-full text-sm"><tbody>{t.trucks.map((v: any) => <tr key={v.id} className="border-t"><td className={`${td} font-mono font-bold`}>{v.vehicleNumber}</td>
          <td className={td}><span className={tag(v.ownershipType)}>{v.ownershipType}</span></td><td className={td}>{v.vehicleType} · {fmtWeight(v.capacityTons)}</td>
          <td className={td}>{fmtTempRange(v.minTemperatureC, v.maxTemperatureC)}</td><td className={td}>{v.status}</td></tr>)}
          {t.trucks.length === 0 && <tr><td className={`${td} text-slate-500`}>No trucks.</td></tr>}</tbody></table></div>

      <div className="rounded-xl border p-3"><div className="flex items-center justify-between"><b>Drivers</b>{addBtn('driver', 'Add driver')}</div>
        {add('driver', 'Add a driver', [{ name: 'name', label: 'Name', required: true }, { name: 'mobile', label: 'Mobile' }, { name: 'licenceNumber', label: 'Licence number' },
          { name: 'licenceExpiryDate', label: 'Licence valid to', type: 'date' }], 'drivers', 'Driver added.')}
        <table className="mt-2 w-full text-sm"><tbody>{t.drivers.map((d: any) => <tr key={d.id} className={`border-t ${d.active ? '' : 'opacity-60'}`}><td className={td}><b>{d.name}</b><div className="text-xs">{d.mobile || ''}</div></td>
          <td className={td}>{d.licenceNumber || '-'}<div className={`text-xs ${d.licenceExpired ? 'font-bold text-red-700' : ''}`}>{d.licenceExpiryDate ? `to ${day(d.licenceExpiryDate)}` : ''}{d.licenceExpired ? ' (expired)' : ''}</div></td>
          <td className={`${td} text-right`}>{me.manager && <button disabled={busy} onClick={() => void run(() => call('POST', `${base}/drivers/${d.id}/active`, { active: !d.active }), 'Driver saved.')} className={d.active ? btnRed : btnLight}>{d.active ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}
          {t.drivers.length === 0 && <tr><td className={`${td} text-slate-500`}>No drivers.</td></tr>}</tbody></table>

        <div className="mt-4 flex items-center justify-between"><b>Rate contracts</b><Link to={`/transporters/contracts?transporter=${t.id}`} className={btnLight}>Open</Link></div>
        <div className="mt-2 space-y-1 text-sm">{t.contracts.map((c: any) => <Link key={c.id} to={`/transporters/contracts?id=${c.id}`} className="block rounded-lg border px-2 py-1 hover:bg-sky-50">
          <span className="font-mono font-bold">{c.contractNo}</span> · {day(c.validFrom)} to {day(c.validTo)} · {c.laneCount} lines · {c.inForce ? <span className="text-emerald-700">in force</span> : c.status}</Link>)}
          {t.contracts.length === 0 && <div className="text-slate-500">No contracts.</div>}</div>
      </div>
    </div>
  </Section>;
}

function Fleet({ transporters, me, busy, run, call }: {
  transporters: any[]; me: ReturnType<typeof role>; busy: boolean; run: (a: () => Promise<any>, done: string) => Promise<any>; call: (m: string, p: string, b?: unknown) => Promise<any>;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [pick, setPick] = useState<Record<number, { ownershipType: string; transporterId: string }>>({});
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => { try { setRows(await api('/api/transporters/vehicles')); } catch { setRows([]); } }, []);
  useEffect(() => { void load(); }, [load]);
  const approved = transporters.filter(x => x.onboardingStatus === 'APPROVED' && x.active);
  const shown = rows.filter(v => !filter || v.ownershipType === filter);
  const count = (o: string) => rows.filter(v => v.ownershipType === o).length;
  return <Section title="Fleet ownership" right={<select value={filter} onChange={x => setFilter(x.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
    <option value="">All ({rows.length})</option>{OWNERSHIP.map(([k, l]) => <option key={k} value={k}>{l} ({count(k)})</option>)}</select>}>
    <p className="mb-2 text-sm text-slate-600">An attached or market truck must name its transporter. Only approved transporters are offered.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>Type</th><th className={th}>Range</th><th className={th}>Ownership</th><th className={th}>Transporter</th><th className={th}>Status</th>{me.manager && <th className={th}>Change to</th>}</tr></thead>
      <tbody>{shown.map(v => { const p = pick[v.id] || { ownershipType: v.ownershipType, transporterId: v.transporterId ? String(v.transporterId) : '' };
        return <tr key={v.id} className="border-t"><td className={`${td} font-mono font-bold`}>{v.vehicleNumber}</td><td className={td}>{v.vehicleType} · {fmtWeight(v.capacityTons)}</td>
          <td className={td}>{fmtTempRange(v.minTemperatureC, v.maxTemperatureC)}</td><td className={td}><span className={tag(v.ownershipType)}>{v.ownershipType}</span></td>
          <td className={td}>{v.transporterName || '-'}</td><td className={td}>{v.status}</td>
          {me.manager && <td className={td}><div className="flex gap-2">
            <select value={p.ownershipType} onChange={x => setPick(m => ({ ...m, [v.id]: { ...p, ownershipType: x.target.value } }))} className={input}>{OWNERSHIP.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {p.ownershipType !== 'OWN' && <select value={p.transporterId} onChange={x => setPick(m => ({ ...m, [v.id]: { ...p, transporterId: x.target.value } }))} className={input}><option value="">Transporter</option>
              {approved.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
            <button disabled={busy} onClick={() => void run(() => call('PATCH', `/api/transporters/vehicles/${v.id}/ownership`, { ownershipType: p.ownershipType, transporterId: p.ownershipType === 'OWN' ? null : p.transporterId || null }), `Truck ${v.vehicleNumber} saved.`).then(() => load())} className={btnLight}>Save</button>
          </div></td>}</tr>; })}
        {shown.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No trucks.</td></tr>}</tbody></table></div>
  </Section>;
}
