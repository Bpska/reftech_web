/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-011 -- FSSAI licences of RefTech, of each cold store and of the customers whose food we carry. Reminders
// go out 120, 90, 60, 30, 15 and 7 days before the end and on the day. Staff check the licence on the FSSAI site
// (FoSCoS) and record what it shows; a renewal is saved as a new licence that replaces the old one.
// Backend: /api/gov/fssai (GovComplianceController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { FileBadge } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, STATE_TEXT, day, pill, when, words } from './gov';

const KINDS: [string, string][] = [['CENTRAL', 'Central licence'], ['STATE', 'State licence'], ['REGISTRATION', 'Registration']];

export function FssaiPage() {
  const [all, setAll] = useState(false), [d, setD] = useState<any>(null), [edit, setEdit] = useState<any>(null), [holder, setHolder] = useState('COMPANY'), [site, setSite] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api(`/api/gov/fssai?all=${all}`).then(setD).catch(e => setErr(errorText(e, 'The licences could not be read')));
  useEffect(() => { void load(); }, [all]);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { await fn(); setMsg(done); await load(); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }
  function startEdit(x: any) { setEdit(x); setHolder(x.holderType || 'COMPANY'); setSite(null); }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const ok = await run(() => api(edit.id ? `/api/gov/fssai/${edit.id}` : '/api/gov/fssai', { method: edit.id ? 'PUT' : 'POST', body: JSON.stringify(b) }), edit.replaces ? 'Renewal saved; the old licence is closed' : 'Licence saved');
    if (ok) setEdit(null);
  }
  async function siteCheck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await run(() => api(`/api/gov/fssai/${site.id}/site-check`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) }), 'Site check saved')) setSite(null);
  }

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">FSSAI Licences</h1><NotReady script={SCRIPT} /></>;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-3xl font-bold"><FileBadge />FSSAI Licences</h1>
        <p className="text-slate-600">Food licences of the company, the cold stores and the customers. Check them on <a href={d?.siteUrl || 'https://foscos.fssai.gov.in/'} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">FoSCoS</a>.</p></div>
      <button className={btn} onClick={() => startEdit({ holderType: 'COMPANY', licenceKind: 'STATE' })}>Add a licence</button>
    </div>
    <Banner msg={msg} error={err} />
    <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Show replaced licences</label>

    {edit && <Section title={edit.replaces ? 'Renewal' : edit.id ? `Licence ${edit.licenceNo}` : 'New licence'} right={<button className={btnLight} onClick={() => setEdit(null)}>Close</button>}>
      <form key={edit.id || edit.replaces || 'new'} onSubmit={save} className="grid gap-3 md:grid-cols-4">
        {edit.replaces && <input type="hidden" name="replaces" value={edit.replaces} />}
        <div><span className={label}>Whose *</span><select name="holderType" value={holder} onChange={e => setHolder(e.target.value)} className={input}>
          <option value="COMPANY">{d?.companyName || 'RefTech'}</option><option value="WAREHOUSE">A warehouse</option><option value="PARTNER">A customer</option></select></div>
        {holder === 'WAREHOUSE' && <div><span className={label}>Warehouse *</span><select name="warehouseId" required defaultValue={edit.warehouseId || ''} className={input}><option value="">Choose</option>{(d?.warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>}
        {holder === 'PARTNER' && <div><span className={label}>Customer *</span><select name="partnerId" required defaultValue={edit.partnerId || ''} className={input}><option value="">Choose</option>{(d?.partners || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        {holder === 'COMPANY' && <div><span className={label}>Name on the licence</span><input name="holderName" defaultValue={edit.holderName || d?.companyName || ''} className={input} /></div>}
        <div><span className={label}>Licence number (14 digits) *</span><input name="licenceNo" required pattern="\s*\d{14}\s*" defaultValue={edit.licenceNo || ''} className={input} /></div>
        <div><span className={label}>Kind *</span><select name="licenceKind" defaultValue={edit.licenceKind || 'STATE'} className={input}>{KINDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        <div><span className={label}>Valid up to *</span><input name="validUpto" type="date" required defaultValue={edit.validUpto ? String(edit.validUpto).slice(0, 10) : ''} className={input} /></div>
        <div><span className={label}>Business</span><input name="businessKind" defaultValue={edit.businessKind || ''} className={input} placeholder="Cold storage, transport" /></div>
        <div className="md:col-span-2"><span className={label}>Remarks</span><input name="remarks" defaultValue={edit.remarks || ''} className={input} /></div>
        <div className="md:col-span-4"><button className={btn} disabled={busy}>Save</button></div>
      </form>
    </Section>}

    {site && <Section title={`FSSAI site check of ${site.licenceNo}`} right={<button className={btnLight} onClick={() => setSite(null)}>Close</button>}>
      <form onSubmit={siteCheck} className="grid gap-3 md:grid-cols-4">
        <div><span className={label}>Status on the site *</span><select name="siteStatus" required className={input}>{['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED', 'NOT_FOUND'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
        <div><span className={label}>Valid up to (site)</span><input name="validUpto" type="date" className={input} /></div>
        <div><span className={label}>Remarks</span><input name="remarks" className={input} /></div>
        <div className="flex items-end"><button className={btn} disabled={busy}>Save</button></div>
      </form>
    </Section>}

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> : !d.licences?.length ? <p className="text-slate-500">No FSSAI licence yet.</p> :
        <table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Holder</th><th>Licence</th><th>Kind</th><th>Valid up to</th><th>State</th><th>Site check</th><th /></tr></thead>
          <tbody>{d.licences.map((x: any) => <tr key={x.id} className={`border-t align-top ${x.active ? '' : 'text-slate-400'}`}>
            <td className="p-2 font-semibold">{x.warehouseName || x.partnerName || x.holderName}<div className="text-xs font-normal text-slate-500">{x.holderType === 'WAREHOUSE' ? 'Warehouse' : x.holderType === 'PARTNER' ? 'Customer' : 'Company'}</div></td>
            <td className="font-mono text-xs">{x.licenceNo}</td><td>{KINDS.find(k => k[0] === x.licenceKind)?.[1] || words(x.licenceKind)}</td>
            <td>{day(x.validUpto)}{x.daysLeft != null && x.active ? <div className="text-xs text-slate-500">{x.daysLeft < 0 ? `${-x.daysLeft} days ago` : `${x.daysLeft} days left`}</div> : null}</td>
            <td>{x.active ? <span className={pill(x.state)}>{STATE_TEXT[x.state] || words(x.state)}</span> : 'Replaced'}</td>
            <td className="text-xs">{x.siteCheckedAt ? <>{words(x.siteStatus)}, {when(x.siteCheckedAt)}<div className="text-slate-500">{x.siteCheckedByName}</div></> : '-'}</td>
            <td className="whitespace-nowrap p-2">{x.active && <><button className={btnLight} onClick={() => startEdit(x)}>Edit</button> <button className={btnLight} onClick={() => { setSite(x); setEdit(null); }}>Site check</button>{' '}
              <button className={btnLight} onClick={() => startEdit({ holderType: x.holderType, warehouseId: x.warehouseId, partnerId: x.partnerId, holderName: x.holderName, licenceKind: x.licenceKind, businessKind: x.businessKind, licenceNo: x.licenceNo, replaces: x.id })}>Renewed</button></>}</td>
          </tr>)}</tbody>
        </table>}
    </section>
    {d?.register?.length > 0 && <p className="mt-3 text-xs text-slate-500">The Compliance Register also holds {d.register.length} FSSAI paper(s); its reminders now follow the same 120, 90 and 60 day steps.</p>}
  </>;
}
