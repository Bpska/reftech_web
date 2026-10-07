/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-007 -- employee self-service ("My HR"). Every login that is an employee sees only its own records:
//   home        profile, reporting manager, work email, check in / check out, leave balances
//   attendance  the month with the day codes and the check-in times
//   leave       apply, cancel a pending request, the year's requests
//   payslips    approved and paid months, payslip PDF
//   letters     issued HR letters as PDF
//   documents   what HR needs (REQ-HR-008), upload a copy (HR checks it), open own files
//   my details  ask HR to change mobile, email, address, bank or emergency contact (HR approves)
//   team leave  the reporting manager approves or refuses the team's leave
//   safety      a driver's own score, hours on duty, training and incidents (REQ-HR-009)
// Office logins open it at /me inside the menu; a driver login at /driver/me from the driver page.
// Backend: /api/ess/** (EssController). Needs database_v2/56_hr_and_access.sql.
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserRound } from 'lucide-react';
import { api, apiOpen, apiUpload, currentUser } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, HR_SCRIPT, Tabs, day, rupee, thisMonth, useRunner, when } from './hr';

const CODES: [string, string][] = [['P', 'Present'], ['HD', 'Half day'], ['A', 'Absent'], ['OD', 'On duty'], ['W', 'Week off'], ['H', 'Holiday'], ['?', 'Not marked'], ['-', 'Not employed']];
const tone = (c: string) => c.startsWith('P') || c === 'OD' ? 'bg-emerald-50 text-emerald-800' : c === 'A' ? 'bg-red-100 text-red-800' : c.startsWith('HD') ? 'bg-amber-100 text-amber-800'
  : c === 'W' || c === 'H' ? 'bg-slate-100 text-slate-500' : c === '?' ? 'bg-white text-slate-400' : c ? 'bg-sky-100 text-sky-800' : 'bg-white';

export function EssPage({ driver = false }: { driver?: boolean }) {
  const navigate = useNavigate();
  const [home, setHome] = useState<any>(null), [err, setErr] = useState(''), [notReady, setNotReady] = useState(false);
  const [tab, setTab] = useState('home');
  const isDriver = driver || String(currentUser().role || '').toUpperCase() === 'DRIVER';
  const load = () => api('/api/ess/me').then(setHome).catch((e: any) => {
    if (/56_hr_and_access|not ready|database_v2/i.test(e?.message || '')) setNotReady(true);
    setErr(e?.message || 'Could not load your HR details');
  });
  useEffect(() => { void load(); }, []);

  const tabs: [string, string][] = [['home', 'Home'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['payslips', 'Payslips'], ['letters', 'Letters'], ['documents', 'Documents'], ['details', 'My details']];
  if (home && home.teamPendingLeave > 0 || tab === 'team') tabs.push(['team', `Team leave${home?.teamPendingLeave ? ` (${home.teamPendingLeave})` : ''}`]);
  if (isDriver) tabs.push(['safety', 'My safety']);

  const body = notReady ? <NotReady script={HR_SCRIPT} /> : !home ? <Banner error={err} /> : <>
    <Tabs tabs={tabs} value={tab} onChange={setTab} />
    {tab === 'home' && <Home home={home} reload={load} />}
    {tab === 'attendance' && <Attendance />}
    {tab === 'leave' && <Leave reload={load} />}
    {tab === 'payslips' && <Payslips />}
    {tab === 'letters' && <Letters />}
    {tab === 'documents' && <Documents />}
    {tab === 'details' && <Details reload={load} />}
    {tab === 'team' && <TeamLeave reload={load} />}
    {tab === 'safety' && <Safety />}
  </>;

  if (driver) return <main className="min-h-screen bg-slate-50">
    <header className="bg-frost-950 text-white"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 text-lg font-black"><UserRound className="h-5 w-5" />My HR</div>
      <button type="button" onClick={() => navigate('/driver')} className="inline-flex items-center gap-1 rounded-xl border border-white/30 px-3 py-2 text-sm font-bold hover:bg-white/10"><ArrowLeft className="h-4 w-4" />My trips</button>
    </div></header>
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4">{home && <p className="font-bold">{home.name} ({home.employeeCode})</p>}{body}</div>
  </main>;

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black text-slate-900">My HR</h1>
      <p className="text-sm text-slate-600">{home ? `${home.name} (${home.employeeCode}), ${home.designation || home.role || ''}` : 'Your attendance, leave, payslips, letters and documents.'}</p></div>
    {body}
  </div>;
}

function Home({ home, reload }: { home: any; reload: () => unknown }) {
  const r = useRunner(reload);
  const t = home.today || {};
  function checkIn() {
    const send = (lat?: number, lng?: number) => r.run(() => api('/api/ess/attendance/check-in', { method: 'POST', body: JSON.stringify(lat == null ? {} : { lat, lng }) }), 'Checked in');
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => void send(p.coords.latitude, p.coords.longitude), () => void send(), { timeout: 8000 });
    else void send();
  }
  const rows: [string, any][] = [['Department', home.department], ['Designation', home.designation], ['Joined', day(home.dateOfJoining)], ['Reporting manager', home.manager || 'Not set'],
    ['Work email', home.workEmail || 'Not made yet'], ['Mobile', home.mobile], ['Personal email', home.email], ['Bank', home.bankName ? `${home.bankName} ${home.bankAccount || ''} ${home.bankIfsc || ''}` : '-']];
  return <>
    <Banner msg={r.msg} error={r.err} />
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="Today">
        <p className="text-sm text-slate-600">{day(t.date)}{t.weekOff ? ' (week off)' : ''}{t.holiday ? ` (holiday: ${t.holiday})` : ''}</p>
        <p className="mt-2">{t.checkInAt ? <>In at <b>{when(t.checkInAt)}</b></> : 'Not checked in yet.'}{t.checkOutAt && <>, out at <b>{when(t.checkOutAt)}</b></>} {t.status && <Badge v={t.status} />}</p>
        <div className="mt-3 flex gap-2">
          {!t.checkInAt && <button disabled={r.busy} onClick={checkIn} className={btn}>Check in</button>}
          {t.checkInAt && !t.checkOutAt && <button disabled={r.busy} onClick={() => r.run(() => api('/api/ess/attendance/check-out', { method: 'POST' }), 'Checked out')} className={btn}>Check out</button>}
        </div>
        {(home.pendingLeave > 0 || home.pendingProfileChange > 0) && <p className="mt-3 text-sm text-amber-800">
          {home.pendingLeave > 0 && `${home.pendingLeave} leave request(s) waiting for approval. `}{home.pendingProfileChange > 0 && 'A change of your details is with HR.'}</p>}
      </Section>
      <Section title="Me">
        <table className="w-full text-sm"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-t"><td className={td + ' text-slate-500'}>{k}</td><td className={td}>{v || '-'}</td></tr>)}</tbody></table>
      </Section>
    </div>
    <Section title="Leave balance this year"><Balances rows={home.leaveBalances} /></Section>
  </>;
}

function Balances({ rows }: { rows: any[] }) {
  return <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Leave</th><th className={th}>Entitled</th><th className={th}>Taken</th><th className={th}>Waiting</th><th className={th}>Available</th></tr></thead>
    <tbody>{(rows || []).map(b => <tr key={b.code} className="border-t"><td className={td}>{b.name} ({b.code})</td><td className={td}>{b.paid ? b.entitled : 'Unpaid'}</td><td className={td}>{b.taken}</td><td className={td}>{b.pending}</td>
      <td className={td + ' font-bold'}>{b.paid ? b.available : '-'}</td></tr>)}</tbody></table>;
}

function Attendance() {
  const [month, setMonth] = useState(thisMonth()), [d, setD] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => { setD(null); api('/api/ess/attendance?month=' + month).then(setD).catch((e: any) => setErr(e.message)); }, [month]);
  const row = d?.rows?.[0];
  return <Section title={d?.title || 'Attendance'} right={<input type="month" value={month} onChange={e => setMonth(e.target.value)} className={input + ' w-44'} />}>
    <Banner error={err} />
    {row && <>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {row.days.map((c: string, i: number) => <div key={i} className={`rounded-lg border p-1.5 ${tone(c)}`}><div className="text-[10px] text-slate-400">{i + 1} {d.dayNames?.[i]}</div><div className="font-bold">{c || ' '}</div></div>)}
      </div>
      <p className="mt-3 text-sm">Present {row.present}, half days {row.halfDays}, absent {row.absent}, leave {row.leave}, holidays {row.holidays}, week offs {row.weekOffs}, not marked {row.unmarked}.</p>
      <p className="mt-1 text-xs text-slate-500">{CODES.map(([c, n]) => `${c} ${n}`).join(' · ')} · a leave code (CL, SL, EL...) is approved leave.</p>
    </>}
    {(d?.times || []).length > 0 && <table className="mt-3 w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Day</th><th className={th}>In</th><th className={th}>Out</th><th className={th}>Status</th><th className={th}>Note</th></tr></thead>
      <tbody>{d.times.map((x: any) => <tr key={x.date} className="border-t"><td className={td}>{day(x.date)}</td><td className={td}>{when(x.checkInAt)}</td><td className={td}>{when(x.checkOutAt)}</td><td className={td}><Badge v={x.status} /></td><td className={td}>{x.note}</td></tr>)}</tbody></table>}
  </Section>;
}

function Leave({ reload }: { reload: () => unknown }) {
  const [d, setD] = useState<any>(null);
  const load = async () => { setD(await api('/api/ess/leave')); await reload(); };
  const r = useRunner(load);
  useEffect(() => { api('/api/ess/leave').then(setD).catch((e: any) => r.setErr(e.message)); }, []);
  async function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f);
    const body = { leaveCode: fd.get('leaveCode'), fromDate: fd.get('fromDate'), toDate: fd.get('toDate') || fd.get('fromDate'), halfDay: fd.get('halfDay') === 'on', reason: fd.get('reason') };
    if (await r.run(() => api('/api/ess/leave', { method: 'POST', body: JSON.stringify(body) }), 'Leave asked. Your manager will approve it')) f.reset();
  }
  return <>
    <Banner msg={r.msg} error={r.err} />
    <Section title="Ask for leave">
      <form onSubmit={apply} className="grid gap-3 md:grid-cols-6">
        <div><label className={label}>Leave *</label><select name="leaveCode" required className={input}>{(d?.types || []).filter((t: any) => t.active !== false).map((t: any) => <option key={t.code} value={t.code}>{t.name} ({t.code})</option>)}</select></div>
        <div><label className={label}>From *</label><input name="fromDate" type="date" required className={input} /></div>
        <div><label className={label}>To</label><input name="toDate" type="date" className={input} /></div>
        <div className="flex items-end gap-2 pb-2"><input id="halfDay" name="halfDay" type="checkbox" /><label htmlFor="halfDay" className="text-sm">Half day</label></div>
        <div className="md:col-span-2"><label className={label}>Reason</label><input name="reason" className={input} /></div>
        <div><button disabled={r.busy} className={btn}>Ask</button></div>
      </form>
    </Section>
    {d && <Section title={`Balance ${d.year}`}><Balances rows={d.balances} /></Section>}
    <Section title="My requests">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Leave</th><th className={th}>Days</th><th className={th}>Reason</th><th className={th}>Status</th><th className={th}>Decided</th><th className={th}></th></tr></thead>
        <tbody>{(d?.requests || []).map((x: any) => <tr key={x.id} className="border-t"><td className={td}>{x.leaveName || x.leaveCode}<div className="text-xs text-slate-500">{day(x.fromDate)}{x.toDate !== x.fromDate && ` to ${day(x.toDate)}`}{x.halfDay && ' (half day)'}</div></td>
          <td className={td}>{x.days}</td><td className={td}>{x.reason}</td><td className={td}><Badge v={x.status} /></td><td className={td}>{x.decidedBy ? `${x.decidedBy} ${when(x.decidedAt)}` : '-'}{x.decisionNote && <div className="text-xs text-slate-500">{x.decisionNote}</div>}</td>
          <td className={td}>{(x.status === 'PENDING' || (x.status === 'APPROVED' && String(x.fromDate) > new Date().toISOString().slice(0, 10))) &&
            <button disabled={r.busy} onClick={() => { if (confirm('Cancel this leave?')) void r.run(() => api(`/api/ess/leave/${x.id}/cancel`, { method: 'POST' }), 'Cancelled'); }} className={btnRed}>Cancel</button>}</td></tr>)}</tbody></table>
    </Section>
  </>;
}

function Payslips() {
  const [rows, setRows] = useState<any[]>([]), [err, setErr] = useState('');
  useEffect(() => { api('/api/ess/payslips').then(setRows).catch((e: any) => setErr(e.message)); }, []);
  return <Section title="Payslips">
    <Banner error={err} />
    {rows.length === 0 ? <p className="text-sm text-slate-500">No payslip yet. A payslip shows here once HR approves the month.</p> :
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Month</th><th className={th}>Paid days</th><th className={th}>Gross</th><th className={th}>Deductions</th><th className={th}>Net pay</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id} className="border-t"><td className={td}>{new Date(String(p.payMonth).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td><td className={td}>{p.paidDays}</td><td className={td}>{rupee(p.gross)}</td>
          <td className={td}>{rupee(p.totalDeductions)}</td><td className={td + ' font-bold'}>{rupee(p.netPay)}</td><td className={td}><Badge v={p.status} /></td>
          <td className={td}><button onClick={() => apiOpen(`/api/ess/payslips/${p.id}.pdf`).catch(e => setErr(e.message))} className={btnLight}>PDF</button></td></tr>)}</tbody></table>}
  </Section>;
}

function Letters() {
  const [rows, setRows] = useState<any[]>([]), [err, setErr] = useState('');
  useEffect(() => { api('/api/ess/letters').then(setRows).catch((e: any) => setErr(e.message)); }, []);
  return <Section title="My letters">
    <Banner error={err} />
    {rows.length === 0 ? <p className="text-sm text-slate-500">No letter issued to you yet.</p> :
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Number</th><th className={th}>Letter</th><th className={th}>Issued</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(l => <tr key={l.id} className="border-t"><td className={td}>{l.letterNumber}</td><td className={td}>{l.subject}</td><td className={td}>{when(l.issuedAt)}</td>
          <td className={td}><button onClick={() => apiOpen(`/api/ess/letters/${l.id}/pdf`).catch(e => setErr(e.message))} className={btnLight}>PDF</button></td></tr>)}</tbody></table>}
  </Section>;
}

function Documents() {
  const [d, setD] = useState<any>(null);
  const load = async () => setD(await api('/api/ess/documents'));
  const r = useRunner(load);
  useEffect(() => { load().catch((e: any) => r.setErr(e.message)); }, []);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f);
    const file = fd.get('file') as File;
    if (!file || !file.size) { r.setErr('Choose the file'); return; }
    if (await r.run(() => apiUpload('/api/ess/documents', { file, code: String(fd.get('code')), number: String(fd.get('number') || ''), issuedOn: String(fd.get('issuedOn') || ''), expiresOn: String(fd.get('expiresOn') || '') }),
      'Uploaded. HR will check it')) f.reset();
  }
  return <>
    <Banner msg={r.msg} error={r.err} />
    {d?.register && <Section title="What HR needs from you">
      <div className="flex flex-wrap gap-2">{(d.register.documents || []).map((x: any) => <span key={x.code} className="rounded-lg bg-slate-50 px-2 py-1 text-sm">{x.name} <Badge v={x.state} />{x.expiresOn && <span className="text-xs text-slate-500"> to {day(x.expiresOn)}</span>}</span>)}</div>
    </Section>}
    <Section title="Upload a document">
      <form onSubmit={upload} className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2"><label className={label}>Document *</label><select name="code" required className={input}>{(d?.types || []).filter((t: any) => t.active !== false).map((t: any) => <option key={t.code} value={t.code}>{t.name}</option>)}</select></div>
        <div><label className={label}>Number</label><input name="number" className={input} /></div>
        <div><label className={label}>Issued on</label><input name="issuedOn" type="date" className={input} /></div>
        <div><label className={label}>Valid to</label><input name="expiresOn" type="date" className={input} /></div>
        <div className="md:col-span-4"><label className={label}>File (PDF, JPG, PNG) *</label><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required className={input} /></div>
        <div className="flex items-end"><button disabled={r.busy} className={btn}>Upload</button></div>
      </form>
    </Section>
    <Section title="My documents">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Document</th><th className={th}>Number</th><th className={th}>Valid to</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{(d?.documents || []).map((x: any, i: number) => <tr key={x.id ?? 'l' + i} className="border-t"><td className={td}>{x.typeName || x.title}{x.checkNote && <div className="text-xs text-slate-500">{x.checkNote}</div>}</td>
          <td className={td}>{x.number || '-'}</td><td className={td}>{x.expiresOn ? day(x.expiresOn) : '-'}</td><td className={td}><Badge v={x.status} /></td>
          <td className={td}>{!x.legacy && x.id && <button onClick={() => apiOpen(`/api/ess/documents/${x.id}/file`).catch(e => r.setErr(e.message))} className={btnLight}>Open</button>}</td></tr>)}</tbody></table>
    </Section>
  </>;
}

function Details({ reload }: { reload: () => unknown }) {
  const [fields, setFields] = useState<any[]>([]), [changes, setChanges] = useState<any[]>([]);
  const load = async () => { setFields(await api('/api/ess/profile')); setChanges(await api('/api/ess/profile-changes')); await reload(); };
  const r = useRunner(load);
  useEffect(() => { load().catch((e: any) => r.setErr(e.message)); }, []);
  const pending = changes.some(c => c.status === 'PENDING');
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await r.run(() => api('/api/ess/profile-changes', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) }), 'Sent to HR. The change applies once HR approves it');
  }
  return <>
    <Banner msg={r.msg} error={r.err} />
    <Section title="Change my details">
      <p className="text-sm text-slate-600">Change what is wrong and send it. HR checks and approves; your record changes only then.</p>
      {fields.length > 0 && <form key={changes.length} onSubmit={send} className="mt-3 grid gap-3 md:grid-cols-3">
        {fields.map(f => <div key={f.field}><label className={label}>{f.label}</label>{f.field === 'address'
          ? <textarea name={f.field} defaultValue={f.value ?? ''} rows={2} className={input} disabled={pending} />
          : <input name={f.field} defaultValue={f.value ?? ''} className={input} disabled={pending} />}</div>)}
        <div className="md:col-span-3"><button disabled={r.busy || pending} className={btn}>Send to HR</button>{pending && <span className="ml-3 text-sm text-amber-800">Your earlier change is still with HR.</span>}</div>
      </form>}
    </Section>
    <Section title="My change requests">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Asked</th><th className={th}>Change</th><th className={th}>Status</th><th className={th}>Decided</th><th className={th}></th></tr></thead>
        <tbody>{changes.map(c => <tr key={c.id} className="border-t"><td className={td}>{when(c.requestedAt)}</td>
          <td className={td}>{(c.changes || []).map((x: any) => <div key={x.field}><b>{x.label}</b>: {x.from || '(empty)'} to {x.to || '(empty)'}</div>)}</td>
          <td className={td}><Badge v={c.status} /></td><td className={td}>{c.decidedBy ? `${c.decidedBy} ${when(c.decidedAt)}` : '-'}{c.decisionNote && <div className="text-xs text-slate-500">{c.decisionNote}</div>}</td>
          <td className={td}>{c.status === 'PENDING' && <button disabled={r.busy} onClick={() => r.run(() => api(`/api/ess/profile-changes/${c.id}/cancel`, { method: 'POST' }), 'Cancelled')} className={btnRed}>Cancel</button>}</td></tr>)}</tbody></table>
    </Section>
  </>;
}

function TeamLeave({ reload }: { reload: () => unknown }) {
  const [status, setStatus] = useState('PENDING'), [rows, setRows] = useState<any[]>([]);
  const load = async () => { setRows(await api('/api/ess/team/leave?status=' + status)); await reload(); };
  const r = useRunner(load);
  useEffect(() => { api('/api/ess/team/leave?status=' + status).then(setRows).catch((e: any) => r.setErr(e.message)); }, [status]);
  function decide(id: number, ok: boolean) {
    const note = ok ? '' : prompt('Why is the leave refused?');
    if (!ok && note === null) return;
    void r.run(() => api(`/api/ess/team/leave/${id}/${ok ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ note }) }), ok ? 'Approved' : 'Refused');
  }
  return <Section title="Leave of my team" right={<select value={status} onChange={e => setStatus(e.target.value)} className={input + ' w-40'}><option value="PENDING">Waiting</option><option value="ALL">All</option></select>}>
    <Banner msg={r.msg} error={r.err} />
    {rows.length === 0 ? <p className="text-sm text-slate-500">Nothing waiting for you.</p> :
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>Leave</th><th className={th}>Days</th><th className={th}>Reason</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id} className="border-t"><td className={td}>{x.employeeName} ({x.employeeCode})</td><td className={td}>{x.leaveName || x.leaveCode}<div className="text-xs text-slate-500">{day(x.fromDate)}{x.toDate !== x.fromDate && ` to ${day(x.toDate)}`}{x.halfDay && ' (half day)'}</div></td>
          <td className={td}>{x.days}</td><td className={td}>{x.reason}</td><td className={td}><Badge v={x.status} /></td>
          <td className={td}>{x.status === 'PENDING' && <div className="flex gap-2"><button disabled={r.busy} onClick={() => decide(x.id, true)} className={btnLight}>Approve</button><button disabled={r.busy} onClick={() => decide(x.id, false)} className={btnRed}>Refuse</button></div>}</td></tr>)}</tbody></table>}
  </Section>;
}

function Safety() {
  const [d, setD] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => { api('/api/ess/safety').then(setD).catch((e: any) => setErr(e.message)); }, []);
  if (!d) return <Banner error={err} />;
  return <>
    <Section title={<>My safety score {d.score} <Badge v={d.band} /></>}>
      <p className="text-sm">On duty {d.hours24h} h in the last 24 hours (limit {d.maxHours24h ?? d.settings?.maxHours24h ?? 10}), {d.hours7d} h in 7 days (limit {d.maxHours7d ?? d.settings?.maxHours7d ?? 56}); longest rest {d.longestRest24h} h.</p>
      <p className={`mt-2 font-bold ${d.fitToDrive === false ? 'text-red-700' : 'text-emerald-700'}`}>{d.fitToDrive === false ? 'Rest before your next trip.' : 'You may start a trip.'}</p>
      {(d.problems || []).map((p: string) => <div key={p} className="text-sm text-red-700">{p}</div>)}
      {(d.warnings || []).map((p: string) => <div key={p} className="text-sm text-amber-700">{p}</div>)}
      <p className="mt-2 text-xs text-slate-500">Licence {d.licenceNumber || '-'}{d.licenceExpiryDate && `, valid to ${day(d.licenceExpiryDate)}`}.</p>
    </Section>
    <Section title="My training">
      <div className="flex flex-wrap gap-2">{(d.training || []).map((t: any) => <span key={t.code} className="rounded-lg bg-slate-50 px-2 py-1 text-sm">{t.name} <Badge v={t.state} /> {t.validUntil && <span className="text-xs text-slate-500">to {day(t.validUntil)}</span>}</span>)}</div>
      <table className="mt-3 w-full text-sm"><tbody>{(d.trainingRecords || []).map((t: any) => <tr key={t.id} className="border-t"><td className={td}>{t.name}</td><td className={td}>done {day(t.completedOn)}</td><td className={td}>{t.validUntil ? `valid to ${day(t.validUntil)}` : 'No expiry'}</td></tr>)}</tbody></table>
    </Section>
    {(d.incidents || []).length > 0 && <Section title="Incidents">
      <table className="w-full text-sm"><tbody>{d.incidents.map((x: any) => <tr key={x.id} className="border-t"><td className={td}>{when(x.occurredAt)}</td><td className={td}>{String(x.kind || '').replace(/_/g, ' ')}</td><td className={td}><Badge v={x.severity} /></td><td className={td}>{x.description}</td><td className={td}><Badge v={x.status} /></td></tr>)}</tbody></table>
    </Section>}
  </>;
}
