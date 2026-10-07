/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-010 -- GST number check of partners and transporters: status, legal name against our name, PAN inside
// the number, the last return filed. Checked when the number is saved and every month. A transporter whose GST
// number is cancelled or suspended has freight payments held until an Admin releases them with a note.
// Backend: /api/gov/gst (GovComplianceController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, STATE_TEXT, day, pill, providerNote, sourceText, when, words } from './gov';

export function GstChecksPage() {
  const [d, setD] = useState<any>(null), [filter, setFilter] = useState('PROBLEMS'), [open, setOpen] = useState<any>(null), [typing, setTyping] = useState(false);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/api/gov/gst').then(x => { setD(x); if (open) setOpen((x.subjects || []).find((s: any) => s.subjectType === open.subjectType && s.subjectId === open.subjectId) || null); })
    .catch(e => setErr(errorText(e, 'The GST checks could not be read')));
  useEffect(() => { void load(); }, []);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { await fn(); setMsg(done); await load(); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }
  const post = (path: string, body?: any) => api(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
  async function manual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await run(() => post(`/api/gov/gst/${open.subjectType}/${open.subjectId}/manual`, Object.fromEntries(new FormData(e.currentTarget))), 'Check saved')) setTyping(false);
  }
  async function release(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(() => post(`/api/gov/gst/checks/${open.check.id}/release`, Object.fromEntries(new FormData(e.currentTarget))), 'Payments released');
  }

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">GST Checks</h1><NotReady script={SCRIPT} /></>;
  const rows: any[] = (d?.subjects || []).filter((s: any) => filter === 'ALL' || (filter === 'PROBLEMS' ? !['ACTIVE'].includes(s.state) : s.subjectType === filter));
  const c = open?.check;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Scale />GST Checks</h1>
    <p className="text-slate-600">The GST number of every partner and transporter, checked on the GST portal. Payments to a transporter with a cancelled number are held.</p>
    <Banner msg={msg} error={err} />
    {d && providerNote(d.provider, 'The GST service') && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{providerNote(d.provider, 'The GST service')}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {[['PROBLEMS', 'Needs a look'], ['PARTNER', 'Partners'], ['TRANSPORTER', 'Transporters'], ['ALL', 'All']].map(([k, t]) =>
        <button key={k} onClick={() => setFilter(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${filter === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}
    </div>
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> : !rows.length ? <p className="text-slate-500">Nothing here.</p> :
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Name</th><th>Kind</th><th>GST number</th><th>State</th><th>Legal name on GST</th><th>Last return</th><th>Checked</th><th /></tr></thead>
          <tbody>{rows.map(s => <tr key={`${s.subjectType}${s.subjectId}`} className="border-t align-top">
            <td className="p-2 font-semibold">{s.name}{s.city ? <div className="text-xs font-normal text-slate-500">{s.city}</div> : null}</td><td>{words(s.subjectType)}</td>
            <td className="font-mono text-xs">{s.gstin || '-'}</td>
            <td><span className={pill(s.state)}>{STATE_TEXT[s.state] || words(s.state)}</span>{s.check?.paymentHeld ? <div className="text-xs font-bold text-red-700">Payments held</div> : null}</td>
            <td>{s.check?.legalName || '-'}</td><td className="text-xs">{s.check?.lastReturn ? `${s.check.lastReturn} ${s.check.lastReturnPeriod || ''}, ${day(s.check.lastFiledOn)}` : '-'}</td>
            <td className="whitespace-nowrap text-xs">{s.check ? <>{when(s.check.checkedAt)}<div className="text-slate-500">{sourceText(s.check.source)}</div></> : '-'}</td>
            <td className="whitespace-nowrap p-2">{s.gstin && <><button className={btnLight} onClick={() => { setOpen(s); setTyping(false); }}>Open</button>
              {d.connected && <> <button className={btnLight} disabled={busy} onClick={() => run(() => post(`/api/gov/gst/${s.subjectType}/${s.subjectId}/check`), 'Checked on the GST service')}>Check</button></>}</>}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    {open && <Section title={`${open.name} (${open.gstin})`} right={<div className="flex gap-2">
      <button className={btnLight} onClick={() => setTyping(!typing)}>Type from the GST portal</button><button className={btnLight} onClick={() => setOpen(null)}>Close</button></div>}>
      {c ? <p className="text-sm">{words(c.status)} {c.statusDate ? `since ${day(c.statusDate)}` : ''}. Legal name {c.legalName || '-'}{c.tradeName ? `, trade name ${c.tradeName}` : ''}.
        {c.nameMatches === false ? ' The name differs from ours.' : ''}{c.panMatches === false ? ' The PAN in the number differs from the PAN we hold.' : ''}
        {' '}Checked {when(c.checkedAt)} from {sourceText(c.source)}{c.enteredByName ? ` by ${c.enteredByName}` : ''}.</p> : <p className="text-sm text-slate-500">Not checked yet.</p>}
      {c?.holdReleasedAt && <p className="mt-1 text-sm">Payments released by {c.holdReleasedByName} on {when(c.holdReleasedAt)}: {c.holdNote}</p>}
      {c?.paymentHeld && (d.canRelease
        ? <form onSubmit={release} className="mt-3 grid gap-3 rounded-xl bg-red-50 p-3 md:grid-cols-4">
          <div className="md:col-span-3"><span className={label}>Why the payments can go *</span><input name="note" required minLength={5} className={input} placeholder="Registration restored on the portal, order seen" /></div>
          <div className="flex items-end"><button className={btn} disabled={busy}>Release payments</button></div>
        </form>
        : <p className="mt-2 rounded-xl bg-red-50 p-2 text-sm text-red-900">Freight payments to this transporter are held. An Admin can release them.</p>)}
      {typing && <form onSubmit={manual} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <p className="text-sm text-slate-600 md:col-span-4">Copy from services.gst.gov.in (Search Taxpayer, by GSTIN).</p>
        <div><span className={label}>Status *</span><select name="status" required className={input}>{['ACTIVE', 'CANCELLED', 'SUSPENDED', 'INACTIVE'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
        <div><span className={label}>Status date</span><input name="statusDate" type="date" className={input} /></div>
        <div><span className={label}>Legal name *</span><input name="legalName" required className={input} /></div>
        <div><span className={label}>Trade name</span><input name="tradeName" className={input} /></div>
        <div><span className={label}>Last return</span><input name="lastReturn" className={input} placeholder="GSTR3B" /></div>
        <div><span className={label}>Period</span><input name="lastReturnPeriod" className={input} placeholder="082026" /></div>
        <div><span className={label}>Filed on</span><input name="lastFiledOn" type="date" className={input} /></div>
        <div className="flex items-end"><button className={btn} disabled={busy}>Save check</button></div>
      </form>}
    </Section>}
  </>;
}
