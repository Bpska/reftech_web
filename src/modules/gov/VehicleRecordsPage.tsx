/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-005, 016 -- Truck Records: the Parivahan (VAHAN) record of every truck, read every night or with
// "Check now", or typed from the Parivahan site when it is not connected. Each paper (fitness, insurance, PUC,
// permit, national permit, road tax) is set beside the Compliance Register: matches, differs, empty, expiring,
// expired. A Manager can put the Parivahan date into the register.
// Backend: /api/gov/vehicles (GovRecordsController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { DigiLockerBox } from './DigiLockerBox';
import { SCRIPT, day, pill, providerNote, role, sourceText, when, words } from './gov';

const FIELDS: [string, string, string?][] = [
  ['registrationStatus', 'Registration status *'], ['ownerName', 'Owner'], ['vehicleClass', 'Vehicle class'], ['rtoName', 'RTO'],
  ['registrationDate', 'Registration date', 'date'], ['financer', 'Financer'],
  ['fitnessNo', 'Fitness number'], ['fitnessUpto', 'Fitness up to', 'date'], ['insurer', 'Insurer'], ['insurancePolicy', 'Insurance policy'],
  ['insuranceUpto', 'Insurance up to', 'date'], ['pucNo', 'PUC number'], ['pucUpto', 'PUC up to', 'date'], ['taxNo', 'Tax receipt'], ['taxUpto', 'Road tax up to', 'date'],
  ['permitType', 'Permit type'], ['permitNo', 'Permit number'], ['permitUpto', 'Permit up to', 'date'], ['permitStates', 'Permit states'],
  ['npNo', 'National permit number'], ['npUpto', 'National permit up to', 'date'], ['npAuthUpto', 'NP authorisation up to', 'date'],
];

export function VehicleRecordsPage() {
  const r = role();
  const [d, setD] = useState<any>(null), [open, setOpen] = useState<any>(null), [typing, setTyping] = useState(false);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/api/gov/vehicles').then(setD).catch(e => setErr(errorText(e, 'The truck records could not be read')));
  const openTruck = (id: number) => api(`/api/gov/vehicles/${id}`).then(x => { setOpen(x); setTyping(false); }).catch(e => setErr(errorText(e, 'The record could not be read')));
  useEffect(() => { void load(); }, []);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setOpen(x); setMsg(done); await load(); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }
  const check = (id: number) => run(() => api(`/api/gov/vehicles/${id}/check`, { method: 'POST' }), 'Record read from Parivahan');
  const useDate = (docType: string) => run(() => api(`/api/gov/vehicles/${open.vehicleId}/use-parivahan-date`, { method: 'POST', body: JSON.stringify({ docType }) }), 'The Compliance Register now has the Parivahan date');
  async function manual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b: any = Object.fromEntries(f); b.blacklisted = f.get('blacklisted') === 'on';
    if (await run(() => api(`/api/gov/vehicles/${open.vehicleId}/manual`, { method: 'POST', body: JSON.stringify(b) }), 'Record saved')) setTyping(false);
  }

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">Truck Records</h1><NotReady script={SCRIPT} /></>;
  const rec = open?.record;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Landmark />Truck Records (Parivahan)</h1>
    <p className="text-slate-600">The government record of every truck, beside the papers in the <Link to="/compliance" className="font-semibold text-sky-700 hover:underline">Compliance Register</Link>.</p>
    <Banner msg={msg} error={err} />
    {d && providerNote(d.provider, 'Parivahan') && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{providerNote(d.provider, 'Parivahan')}</p>}
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> :
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Truck</th><th>Registration</th><th>Problems</th><th>Next expiry</th><th>Unpaid challans</th><th>Checked</th><th /></tr></thead>
          <tbody>{d.vehicles.map((v: any) => <tr key={v.vehicleId} className={`border-t align-top ${open?.vehicleId === v.vehicleId ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold">{v.vehicleNumber}<div className="text-xs font-normal text-slate-500">{words(v.ownershipType)}</div></td>
            <td>{v.registrationStatus ? <span className={pill(v.registrationStatus)}>{words(v.registrationStatus)}</span> : <span className="text-slate-400">not checked</span>}
              {v.blacklisted ? <span className={`ml-1 ${pill('BLACKLISTED')}`}>Blacklisted</span> : null}</td>
            <td className="max-w-sm text-xs">{v.problems?.length ? v.problems.join('; ') : '-'}</td>
            <td>{day(v.nextExpiry)}</td>
            <td>{Number(v.pendingChallans) > 0 ? <Link to={`/gov/challans?vehicleId=${v.vehicleId}`} className="font-bold text-red-700 hover:underline">{Number(v.pendingChallans)}</Link> : '0'}</td>
            <td className="whitespace-nowrap text-xs">{v.checkedAt ? <>{when(v.checkedAt)}<div className="text-slate-500">{sourceText(v.source)}</div></> : '-'}</td>
            <td className="whitespace-nowrap p-2"><button className={btnLight} onClick={() => openTruck(v.vehicleId)}>Open</button> {d.connected && <button className={btnLight} disabled={busy} onClick={() => check(v.vehicleId)}>Check now</button>}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    {open && <Section title={`${open.vehicleNumber}`} right={<div className="flex gap-2">
      {open.connected && <button className={btnLight} disabled={busy} onClick={() => check(open.vehicleId)}>Check now</button>}
      <button className={btnLight} onClick={() => setTyping(!typing)}>Type from Parivahan</button>
      <button className={btnLight} onClick={() => setOpen(null)}>Close</button></div>}>
      {!rec ? <p className="text-sm text-slate-500">Not checked on Parivahan yet.</p> : <>
        <p className="text-sm">
          <span className={pill(rec.registrationStatus)}>{words(rec.registrationStatus)}</span>
          {rec.blacklisted ? <span className={`ml-1 ${pill('BLACKLISTED')}`}>Blacklisted{rec.blacklistReason ? `: ${rec.blacklistReason}` : ''}</span> : null}
          <span className="ml-2 text-slate-600">Owner {rec.ownerName || '-'}, class {rec.vehicleClass || '-'}, RTO {rec.rtoName || '-'}, registered {day(rec.registrationDate)}{rec.financer ? `, financed by ${rec.financer}` : ''}.
            Permit {rec.permitType || '-'}{rec.permitStates ? ` for ${rec.permitStates}` : ''}. Read {when(rec.checkedAt)} from {sourceText(rec.source)}{rec.enteredByName ? ` by ${rec.enteredByName}` : ''}.</span>
        </p>
        <table className="mt-3 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Paper</th><th>Number</th><th>Parivahan</th><th>Compliance Register</th><th>Result</th><th /></tr></thead>
          <tbody>{open.papers.map((p: any) => <tr key={p.docType} className="border-t">
            <td className="p-2 font-semibold">{p.label}</td><td className="text-xs">{p.number || '-'}</td><td>{day(p.parivahanUpto)}</td><td>{day(p.registerUpto)}</td>
            <td><span className={pill(p.result)}>{p.resultLabel}</span>{p.daysLeft != null && p.daysLeft >= 0 ? <span className="ml-1 text-xs text-slate-500">{p.daysLeft} days left</span> : null}</td>
            <td className="p-2">{p.canUseParivahan && (r.manager ? <button className={btnLight} disabled={busy} onClick={() => useDate(p.docType)}>Use Parivahan date</button> : <span className="text-xs text-slate-500">A Manager can use the Parivahan date</span>)}</td>
          </tr>)}</tbody></table>
      </>}

      {typing && <form onSubmit={manual} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <p className="text-sm text-slate-600 md:col-span-4">Copy the record from parivahan.gov.in or the mParivahan app.</p>
        {FIELDS.map(([k, t, type]) => <div key={k}><span className={label}>{t}</span>
          {k === 'registrationStatus'
            ? <select name={k} required defaultValue={rec?.registrationStatus || 'ACTIVE'} className={input}>{['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select>
            : <input name={k} type={type || 'text'} defaultValue={type === 'date' ? '' : rec?.[k] || ''} className={input} />}</div>)}
        <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="blacklisted" defaultChecked={!!rec?.blacklisted} />Blacklisted</label>
        <div><span className={label}>Blacklist reason</span><input name="blacklistReason" defaultValue={rec?.blacklistReason || ''} className={input} /></div>
        <div className="md:col-span-2"><span className={label}>Note</span><input name="note" className={input} /></div>
        <div className="md:col-span-4"><button className={btn} disabled={busy}>Save record</button></div>
      </form>}

      <DigiLockerBox subjectType="VEHICLE" subjectId={open.vehicleId} />
      {open.history?.length > 0 && <div className="mt-4"><h3 className="font-bold">Checks</h3>
        <ul className="mt-1 space-y-1 text-sm">{open.history.map((h: any) => <li key={h.id}><span className="text-slate-500">{when(h.checkedAt)}</span> · {sourceText(h.source)} · {words(h.registrationStatus)}{h.blacklisted ? ', blacklisted' : ''}{h.enteredByName ? ` · ${h.enteredByName}` : ''}</li>)}</ul></div>}
    </Section>}
  </>;
}
