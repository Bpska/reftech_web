/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-007, 012 -- Driving Licences: the Sarathi record of every driver, checked when the driver is added or the
// consent is recorded, and every month (consent first,
// as the data protection law asks), or typed from the Sarathi site. The Sarathi date is set beside the HR date;
// a Manager confirms it into HR. Consent is recorded (written form or electronic) and can be withdrawn.
// DigiLocker: the driver shares the licence, or staff upload the PDF.
// Backend: /api/gov/licences (GovRecordsController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { IdCard } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { DigiLockerBox } from './DigiLockerBox';
import { SCRIPT, STATE_TEXT, day, nowLocal, pill, providerNote, role, sourceText, when, words } from './gov';

export function DriverLicencesPage() {
  const r = role();
  const [d, setD] = useState<any>(null), [open, setOpen] = useState<any>(null), [form, setForm] = useState<'' | 'consent' | 'manual'>('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/api/gov/licences').then(setD).catch(e => setErr(errorText(e, 'The licences could not be read')));
  const openDriver = (id: number) => api(`/api/gov/licences/${id}`).then(x => { setOpen(x); setForm(''); }).catch(e => setErr(errorText(e, 'The driver could not be read')));
  useEffect(() => { void load(); }, []);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { await fn(); setMsg(done); await load(); if (open) await openDriver(open.driverId); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }
  const post = (path: string, body?: any) => api(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
  async function consent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(e.currentTarget));
    if (b.consentAt) b.consentAt = new Date(b.consentAt).toISOString();
    // REQ-GOV-007: the licence is read at once when the consent is saved; the answer says how that went.
    let note = '';
    const ok = await run(async () => { const x = await post(`/api/gov/licences/${open.driverId}/consent`, b); note = x?.checkNote || ''; return x; }, 'Consent recorded');
    if (ok && note) setMsg(`Consent recorded. ${note}.`);
  }
  async function manual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(() => post(`/api/gov/licences/${open.driverId}/manual`, Object.fromEntries(new FormData(e.currentTarget))), 'Check saved');
  }

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">Driving Licences</h1><NotReady script={SCRIPT} /></>;
  const latest = open?.checks?.[0];
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><IdCard />Driving Licences (Sarathi)</h1>
    <p className="text-slate-600">The licence of every driver from Sarathi, beside the date in HR. A licence is checked only with the driver's consent.</p>
    <Banner msg={msg} error={err} />
    {d && providerNote(d.provider, 'Sarathi') && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{providerNote(d.provider, 'Sarathi')}</p>}
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> : !d.drivers?.length ? <p className="text-slate-500">No driver.</p> :
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Driver</th><th>Licence</th><th>HR date</th><th>Sarathi (transport)</th><th>Consent</th><th>State</th><th>Checked</th><th /></tr></thead>
          <tbody>{d.drivers.map((x: any) => <tr key={x.driverId} className={`border-t align-top ${open?.driverId === x.driverId ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold">{x.name}</td><td className="font-mono text-xs">{x.licenceNo || '-'}{!x.hasDob ? <div className="font-sans text-amber-700">date of birth missing in HR</div> : null}</td>
            <td>{day(x.hrExpiry)}</td><td>{day(x.check?.transportUpto)}</td>
            <td className="text-xs">{x.consent ? `${words(x.consent.method)}, ${day(x.consent.consentAt)}` : <span className="font-semibold text-violet-700">none</span>}</td>
            <td><span className={pill(x.state)}>{STATE_TEXT[x.state] || words(x.state)}</span></td>
            <td className="whitespace-nowrap text-xs">{x.check ? <>{when(x.check.checkedAt)}<div className="text-slate-500">{sourceText(x.check.source)}</div></> : '-'}</td>
            <td className="whitespace-nowrap p-2"><button className={btnLight} onClick={() => openDriver(x.driverId)}>Open</button>
              {d.connected && x.consent && x.hasDob && <> <button className={btnLight} disabled={busy} onClick={() => run(() => post(`/api/gov/licences/${x.driverId}/check`), 'Licence read from Sarathi')}>Check</button></>}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    {open && <Section title={open.name} right={<div className="flex flex-wrap gap-2">
      {open.connected && open.consent && open.hasDob && <button className={btnLight} disabled={busy} onClick={() => run(() => post(`/api/gov/licences/${open.driverId}/check`), 'Licence read from Sarathi')}>Check on Sarathi</button>}
      <button className={btnLight} onClick={() => setForm(form === 'manual' ? '' : 'manual')}>Type from Sarathi</button>
      <button className={btnLight} onClick={() => setForm(form === 'consent' ? '' : 'consent')}>Record consent</button>
      {open.consent && <button className={btnRed} disabled={busy} onClick={() => window.confirm('Record that the driver withdrew consent? No more checks will be made.') && run(() => post(`/api/gov/licences/${open.driverId}/consent/withdraw`), 'Consent withdrawn')}>Consent withdrawn</button>}
      <button className={btnLight} onClick={() => setOpen(null)}>Close</button></div>}>
      <p className="text-sm text-slate-700">Licence {open.licenceNo || 'not recorded'}, HR date {day(open.hrExpiry)}.{!open.hasDob ? ' The date of birth is missing in HR, so Sarathi cannot be asked.' : ''}
        {' '}{open.consent ? `Consent: ${words(open.consent.method)} on ${day(open.consent.consentAt)}${open.consent.documentRef ? ` (${open.consent.documentRef})` : ''}.` : 'No consent recorded.'}</p>

      {form === 'consent' && <form onSubmit={consent} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <div><span className={label}>How *</span><select name="method" required className={input}><option value="WRITTEN">Written form</option><option value="ELECTRONIC">Electronic (OTP or app)</option></select></div>
        <div><span className={label}>Given on *</span><input name="consentAt" type="datetime-local" required defaultValue={nowLocal()} className={input} /></div>
        <div><span className={label}>Form or reference</span><input name="documentRef" className={input} placeholder="Consent form 2026/41, HR file (needed for written)" /></div>
        <div><span className={label}>Purpose</span><input name="purpose" defaultValue={open.purpose} className={input} /></div>
        <div className="md:col-span-4"><button className={btn} disabled={busy}>Save consent</button></div>
      </form>}

      {form === 'manual' && <form onSubmit={manual} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <p className="text-sm text-slate-600 md:col-span-4">Copy the licence from sarathi.parivahan.gov.in (Services on DL, DL status).</p>
        <div><span className={label}>Status *</span><select name="status" required className={input}>{['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
        <div><span className={label}>Licence number</span><input name="licenceNo" defaultValue={open.licenceNo || ''} className={input} /></div>
        <div><span className={label}>Holder name</span><input name="holderName" defaultValue={open.name} className={input} /></div>
        <div><span className={label}>Transport valid up to</span><input name="transportUpto" type="date" className={input} /></div>
        <div><span className={label}>Non-transport valid up to</span><input name="nonTransportUpto" type="date" className={input} /></div>
        <div><span className={label}>Classes</span><input name="classes" className={input} placeholder="LMV, HGMV, TRANS" /></div>
        <div><span className={label}>Hazardous goods up to</span><input name="hazardousUpto" type="date" className={input} /></div>
        <div><span className={label}>Issued by</span><input name="issuedBy" className={input} placeholder="RTO Bhubaneswar" /></div>
        <div className="md:col-span-3"><span className={label}>Note</span><input name="note" className={input} /></div>
        <div className="flex items-end"><button className={btn} disabled={busy}>Save check</button></div>
      </form>}

      {latest && <div className="mt-4 text-sm">
        <h3 className="font-bold">Latest check</h3>
        <p>{words(latest.status)}, transport up to {day(latest.transportUpto)}{latest.classes ? `, classes ${latest.classes}` : ''}{latest.hazardousUpto ? `, hazardous up to ${day(latest.hazardousUpto)}` : ''}. {when(latest.checkedAt)} from {sourceText(latest.source)}{latest.enteredByName ? ` by ${latest.enteredByName}` : ''}.</p>
        {latest.needsConfirm && (r.manager
          ? <button className={`${btn} mt-2`} disabled={busy} onClick={() => run(() => post(`/api/gov/licences/checks/${latest.id}/confirm`), 'HR now has the Sarathi date')}>Put the Sarathi date {day(latest.transportUpto)} into HR</button>
          : <p className="mt-1 text-amber-800">The Sarathi date differs from HR. A Manager can confirm it into HR.</p>)}
        {latest.confirmedAt && <p className="text-xs text-slate-500">Confirmed into HR by {latest.confirmedByName}, {when(latest.confirmedAt)}.</p>}
      </div>}

      <DigiLockerBox subjectType="DRIVER" subjectId={open.driverId} onChanged={() => { void load(); }} />

      {open.consents?.length > 0 && <div className="mt-4"><h3 className="font-bold">Consents</h3>
        <ul className="mt-1 space-y-1 text-sm">{open.consents.map((c: any) => <li key={c.id}>{when(c.consentAt)} · {words(c.method)}{c.documentRef ? ` · ${c.documentRef}` : ''} · recorded by {c.recordedByName}{c.withdrawnAt ? <span className="text-red-700"> · withdrawn {when(c.withdrawnAt)}</span> : ''}</li>)}</ul></div>}
      {open.checks?.length > 1 && <div className="mt-4"><h3 className="font-bold">Earlier checks</h3>
        <ul className="mt-1 space-y-1 text-sm">{open.checks.slice(1).map((c: any) => <li key={c.id}>{when(c.checkedAt)} · {sourceText(c.source)} · {words(c.status)}, transport up to {day(c.transportUpto)}</li>)}</ul></div>}
    </Section>}
  </>;
}
