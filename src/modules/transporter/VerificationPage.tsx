/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-008, REQ-TAL-009 -- one transporter's hired trucks checked on VAHAN and its drivers' licences on Sarathi
// (with the driver's consent), its transporter portal logins and the documents it uploaded on the portal.
// Under the rule BLOCK (app.tal.verify.rule) a hired truck or driver that is not verified is not placed on a load.
//
// Backend: VerificationController (/api/transporters/verification/**), TransporterPortalAdminController.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { SCRIPT_46, VERIFY_LABEL, call, openFile, pill } from '@/modules/tender/tender';
import { day, docLabel, role } from './transporter';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function VerificationPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const id = params.get('id') || '';
  const [transporters, setTransporters] = useState<any[]>([]);
  const [v, setV] = useState<any>(null), [logins, setLogins] = useState<any[]>([]), [docs, setDocs] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<null | { kind: 'truck' | 'driver'; id: number; name: string }>(null);

  useEffect(() => { if (me.staff) api('/api/transporters').then(r => setTransporters(r.transporters || [])).catch(() => setTransporters([])); }, []);
  const load = useCallback(async () => {
    if (!id) { setV(null); return; }
    try {
      const [a, b, c] = await Promise.all([api(`/api/transporters/verification/${id}`), api(`/api/transporters/${id}/portal-logins`).catch(() => []), api(`/api/transporters/${id}/portal-documents`).catch(() => [])]);
      setV(a); setLogins(Array.isArray(b) ? b : []); setDocs(Array.isArray(c) ? c : []);
    } catch (x) { setV({ error: errorText(x, 'Could not read the verification') }); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function run(what: string, f: () => Promise<any>, ok: string | ((r: any) => string)) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await f(); setMsg(typeof ok === 'string' ? ok : ok(r)); await load(); }
    catch (x) { setError(errorText(x, `Could not ${what}`)); } finally { setBusy(false); }
  }
  const consent = (d: any) => {
    const dob = window.prompt(`Date of birth of ${d.name} (YYYY-MM-DD), needed by Sarathi. The driver agreed in writing that RefTech checks the licence:`, d.dateOfBirth || '');
    if (dob !== null) void run('record the consent', () => call('POST', `/api/transporters/verification/drivers/${d.id}/consent`, { method: 'SIGNED_FORM', dateOfBirth: dob || undefined }), 'Consent recorded.');
  };

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Verification</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  const notReady = v && v.ready === false;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldCheck className="h-8 w-8 text-sky-700" />Verification &amp; portal</h1>
    <p className="text-slate-600">Hired trucks on VAHAN, drivers' licences on Sarathi, the transporter's portal logins and the documents it uploaded.</p>
    <Banner msg={msg} error={error} />
    <div className="mt-2 max-w-md"><select value={id} onChange={e => setParams(e.target.value ? { id: e.target.value } : {})} className={input}>
      <option value="">Choose the transporter</option>{transporters.map(t => <option key={t.id} value={t.id}>{t.name} ({t.onboardingStatus})</option>)}</select></div>
    {notReady && <NotReady script={SCRIPT_46} />}
    {v?.error && <p className="mt-3 text-red-700">{v.error}</p>}
    {v?.trucks && <>
      <p className="mt-3 text-sm text-slate-600">Rule: <b>{v.rule}</b> (a check is good for {v.maxAgeDays} days) · VAHAN: {v.govReady ? v.vahanProvider?.provider || v.vahanProvider || 'set' : 'government module missing (script 43)'} · Sarathi: {v.govReady ? v.sarathiProvider?.provider || v.sarathiProvider || 'set' : '-'}</p>
      {manual && <ManualForm m={manual} busy={busy} onCancel={() => setManual(null)} onSave={b => void run('save', () => call('POST', `/api/transporters/verification/${manual.kind === 'truck' ? 'trucks' : 'drivers'}/${manual.id}/manual`, b), () => { setManual(null); return 'Saved.'; })} />}
      <Section title="Trucks (VAHAN)">
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Truck</th><th className={th}>State</th><th className={th}>Last check</th><th className={th}>Problems</th><th className={th}></th></tr></thead>
          <tbody>{v.trucks.map((t: any) => <tr key={t.id} className="border-t">
            <td className={td}><b>{t.vehicleNumber}</b><div className="text-xs text-slate-500">{t.ownershipType}{t.capacityTons ? `, ${fmtWeight(t.capacityTons)}` : ''}</div></td>
            <td className={td}><span className={pill(t.verification.result)}>{VERIFY_LABEL[t.verification.result] || t.verification.result}</span></td>
            <td className={td}>{t.verification.checkedAt ? day(t.verification.checkedAt) : '-'}<div className="text-xs text-slate-500">{t.verification.source || ''}{t.verification.ownerName ? `, ${t.verification.ownerName}` : ''}</div></td>
            <td className={`${td} text-xs`}><span className="text-red-700">{(t.verification.problems || []).join('; ')}</span><span className="block text-amber-700">{(t.verification.warnings || []).join('; ')}</span></td>
            <td className={`${td} whitespace-nowrap text-right`}>{v.govReady && me.manager && <>
              <button disabled={busy} onClick={() => void run('check on VAHAN', () => call('POST', `/api/transporters/verification/trucks/${t.id}/check`), `${t.vehicleNumber} checked on VAHAN.`)} className={btnLight}>Check now</button>{' '}
              <button onClick={() => setManual({ kind: 'truck', id: t.id, name: t.vehicleNumber })} className={btnLight}>Enter by hand</button></>}</td>
          </tr>)}
            {v.trucks.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No trucks.</td></tr>}</tbody></table></div>
      </Section>
      <Section title="Drivers (Sarathi)">
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Driver</th><th className={th}>Consent</th><th className={th}>State</th><th className={th}>Valid (transport)</th><th className={th}>Problems</th><th className={th}></th></tr></thead>
          <tbody>{v.drivers.map((d: any) => <tr key={d.id} className={`border-t ${d.active ? '' : 'text-slate-400'}`}>
            <td className={td}><b>{d.name}</b><div className="text-xs text-slate-500">{d.licenceNumber || 'no licence number'}{d.mobile ? ` · ${d.mobile}` : ''}</div></td>
            <td className={td}>{d.consentAt ? <>{day(d.consentAt)}<div className="text-xs text-slate-500">{String(d.consentMethod || '').replace(/_/g, ' ').toLowerCase()}</div></> : <span className="text-amber-700">No</span>}</td>
            <td className={td}><span className={pill(d.verification.result)}>{VERIFY_LABEL[d.verification.result] || d.verification.result}</span></td>
            <td className={td}>{d.verification.transportUpto ? day(d.verification.transportUpto) : '-'}</td>
            <td className={`${td} text-xs text-red-700`}>{(d.verification.problems || []).join('; ')}</td>
            <td className={`${td} whitespace-nowrap text-right`}>{me.manager && <>
              {!d.consentAt && <button onClick={() => consent(d)} className={btnLight}>Record consent</button>}{' '}
              {d.consentAt && v.govReady && <button disabled={busy} onClick={() => void run('check on Sarathi', () => call('POST', `/api/transporters/verification/drivers/${d.id}/check`), `${d.name}'s licence checked on Sarathi.`)} className={btnLight}>Check now</button>}{' '}
              {d.consentAt && <button onClick={() => setManual({ kind: 'driver', id: d.id, name: d.name })} className={btnLight}>Enter by hand</button>}</>}</td>
          </tr>)}
            {v.drivers.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No drivers.</td></tr>}</tbody></table></div>
      </Section>
      <Logins id={id} logins={logins} manager={me.manager} busy={busy} run={run} />
      <Section title="Documents and uploaded files">
        <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Document</th><th className={th}>Number</th><th className={th}>Valid to</th><th className={th}>Verified</th><th className={th}>Files</th></tr></thead>
          <tbody>{docs.map(d => <tr key={d.id} className="border-t"><td className={td}>{docLabel(d.documentType)}<div className="text-xs text-slate-500">added by {d.addedVia === 'PORTAL' ? 'the transporter' : 'RefTech'}</div></td>
            <td className={td}>{d.documentNumber || '-'}</td><td className={td}>{day(d.validTo)}</td><td className={td}>{d.verified ? 'Yes' : <span className="text-amber-700">Not yet (verify on the Transporters page)</span>}</td>
            <td className={td}>{d.files.map((f: any) => <button key={f.id} onClick={() => openFile(`/api/transporters/document-files/${f.id}`).catch(x => setError(errorText(x, 'Could not open')))} className="mr-2 font-semibold text-sky-700 hover:underline">{f.fileName}</button>)}{d.files.length === 0 && '-'}</td></tr>)}
            {docs.length === 0 && <tr><td colSpan={5} className={`${td} text-slate-500`}>No documents.</td></tr>}</tbody></table>
      </Section>
    </>}
  </>;
}

function Logins({ id, logins, manager, busy, run }: { id: string; logins: any[]; manager: boolean; busy: boolean; run: (w: string, f: () => Promise<any>, ok: string | ((r: any) => string)) => Promise<void> }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  return <Section title="Transporter portal logins">
    <p className="text-sm text-slate-600">The transporter signs in on the <b>Transporter</b> tab of the login page and sees only its own tenders, quotes, awarded loads, trucks, drivers, documents, trips and bills.</p>
    <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Username</th><th className={th}>Made by</th><th className={th}>State</th><th className={th}></th></tr></thead>
      <tbody>{logins.map(l => <tr key={l.id} className="border-t"><td className={td}><b>{l.username}</b></td><td className={td}>{l.createdByName} · {day(l.createdAt)}</td>
        <td className={td}>{l.active ? 'Active' : <span className="text-slate-500">Off</span>}</td>
        <td className={`${td} whitespace-nowrap text-right`}>{manager && <>
          <button disabled={busy} onClick={() => void run('switch the login', () => call('POST', `/api/transporters/portal-logins/${l.id}/active`, { active: !l.active }), l.active ? 'Login switched off and signed out.' : 'Login switched on.')} className={l.active ? btnRed : btnLight}>{l.active ? 'Switch off' : 'Switch on'}</button>{' '}
          <button disabled={busy} onClick={() => { const p = window.prompt(`New password for ${l.username} (8 characters or more):`); if (p) void run('reset the password', () => call('POST', `/api/transporters/portal-logins/${l.id}/password`, { password: p }), r => r.message); }} className={btnLight}>New password</button></>}</td></tr>)}
        {logins.length === 0 && <tr><td colSpan={4} className={`${td} text-slate-500`}>No portal login yet.</td></tr>}</tbody></table>
    {manager && <div className="mt-3 grid gap-2 md:grid-cols-4">
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className={input} />
      <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password (8+ characters)" className={input} />
      <button disabled={busy || username.length < 4 || password.length < 8} className={btn}
        onClick={() => void run('make the login', () => call('POST', `/api/transporters/${id}/portal-logins`, { username, password }), r => { setUsername(''); setPassword(''); return r.message; })}>Make login</button>
    </div>}
  </Section>;
}

const TRUCK_FIELDS: [string, string, string?][] = [['registrationStatus', 'Registration status (ACTIVE)'], ['ownerName', 'Owner name'], ['fitnessUpto', 'Fitness valid to', 'date'], ['insuranceUpto', 'Insurance valid to', 'date'],
  ['permitUpto', 'Permit valid to', 'date'], ['pucUpto', 'PUC valid to', 'date'], ['taxUpto', 'Road tax valid to', 'date'], ['note', 'Note (where it was read)']];
const DRIVER_FIELDS: [string, string, string?][] = [['status', 'Status on Sarathi (ACTIVE)'], ['holderName', 'Name on the licence'], ['transportUpto', 'Transport valid to', 'date'], ['nonTransportUpto', 'Non-transport valid to', 'date'],
  ['classes', 'Classes (e.g. HGMV, TRANS)'], ['note', 'Note (where it was read)']];

function ManualForm({ m, busy, onSave, onCancel }: { m: { kind: 'truck' | 'driver'; name: string }; busy: boolean; onSave: (b: any) => void; onCancel: () => void }) {
  const fields = m.kind === 'truck' ? TRUCK_FIELDS : DRIVER_FIELDS;
  return <Section title={`Enter by hand: ${m.name}`}>
    <form className="grid gap-3 md:grid-cols-4" onSubmit={e => { e.preventDefault(); const b: any = Object.fromEntries(new FormData(e.currentTarget)); for (const k of Object.keys(b)) if (b[k] === '') delete b[k]; onSave(b); }}>
      {fields.map(([k, l, type]) => <div key={k}><label className={label}>{l}</label><input name={k} type={type || 'text'} className={input} /></div>)}
      <div className="flex items-end gap-2 md:col-span-full"><button disabled={busy} className={btn}>Save</button><button type="button" onClick={onCancel} className={btnLight}>Cancel</button></div>
    </form>
  </Section>;
}
