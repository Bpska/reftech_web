/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-003 -- attendance and leave (HR side). Permissions HR_ATTENDANCE (register, marks, holidays, leave types,
// opening balances) and HR_LEAVE_APPROVE (decide any leave). A reporting manager decides his team's leave in My HR.
//   Register: a code per day: P present, HD half day, A absent, OD on duty, CL/SL/EL.. leave, H holiday, W week-off,
//   ? not marked yet. Click a day to mark or correct it. Days in an approved payroll month cannot be changed.
// Backend: /api/hr/attendance, /api/hr/holidays, /api/hr/leave/** (AttendanceController).
import { FormEvent, useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, EmployeeSelect, HR_SCRIPT, NoAccess, Tabs, can, day, thisMonth, useEmployees, useMe, useRunner, when } from './hr';

const CODE_STYLE: Record<string, string> = { P: 'bg-emerald-100 text-emerald-800', HD: 'bg-lime-100 text-lime-800', A: 'bg-red-100 text-red-800', OD: 'bg-sky-100 text-sky-800',
  H: 'bg-violet-100 text-violet-800', W: 'bg-slate-100 text-slate-500', '?': 'bg-amber-50 text-amber-700', '-': 'text-slate-300' };

export function AttendancePage({ start = 'register' }: { start?: string }) {
  const me = useMe();
  const [tab, setTab] = useState(start);
  useEffect(() => setTab(start), [start]);
  const employees = useEmployees();
  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">Attendance and Leave</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'HR_ATTENDANCE', 'HR_LEAVE_APPROVE')) return <><h1 className="text-3xl font-bold">Attendance and Leave</h1><NoAccess what="work with attendance and leave" /></>;
  const hr = can(me, 'HR_ATTENDANCE');
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarCheck />Attendance and Leave</h1>
    <p className="text-slate-600">The month register, leave requests and balances, holidays and leave types.</p>
    <Tabs value={tab} onChange={setTab} tabs={[...(hr ? [['register', 'Register'] as [string, string]] : []), ['leave', 'Leave requests'], ['balances', 'Balances'],
      ...(hr ? [['holidays', 'Holidays'], ['types', 'Leave types']] as [string, string][] : [])]} />
    {tab === 'register' && hr && <Register />}
    {tab === 'leave' && <LeaveRequests employees={employees} hr={hr} />}
    {tab === 'balances' && <Balances employees={employees} hr={hr} />}
    {tab === 'holidays' && hr && <Holidays />}
    {tab === 'types' && hr && <LeaveTypes />}
  </>;
}

function Register() {
  const [month, setMonth] = useState(thisMonth()), [data, setData] = useState<any>(null), [cell, setCell] = useState<any>(null);
  const load = () => api('/api/hr/attendance/register?month=' + month).then(setData);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, [month]);
  async function mark(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    if (await r.run(() => api('/api/hr/attendance', { method: 'PUT', body: JSON.stringify({ ...b, employeeId: cell.employeeId, date: cell.date }) }), 'Day marked')) setCell(null);
  }
  async function unmark() {
    if (await r.run(() => api(`/api/hr/attendance?employeeId=${cell.employeeId}&date=${cell.date}`, { method: 'DELETE' }), 'Mark removed')) setCell(null);
  }
  const days: string[] = data?.dayNames || [];
  return <Section title={data?.title || 'Register'} right={<input type="month" value={month} onChange={e => setMonth(e.target.value)} className={input} />}>
    <Banner msg={r.msg} error={r.err} />
    <p className="mb-2 text-xs text-slate-500">P present, HD half day, A absent, OD on duty, leave code (CL, SL, EL, LOP; /2 = half day), H holiday, W week-off, ? not marked. Click a day to mark it.</p>
    {cell && <form onSubmit={mark} className="mb-3 grid gap-3 rounded-xl border-2 border-sky-200 bg-sky-50 p-3 md:grid-cols-4">
      <div className="md:col-span-full font-semibold">{cell.name}, {day(cell.date)} (now {cell.code})</div>
      <div><label className={label}>Status</label><select name="status" className={input} defaultValue="PRESENT"><option value="PRESENT">Present</option><option value="HALF_DAY">Half day</option><option value="ABSENT">Absent</option><option value="ON_DUTY">On duty (outside)</option></select></div>
      <div className="md:col-span-2"><label className={label}>Note</label><input name="note" className={input} /></div>
      <div className="flex items-end gap-2"><button disabled={r.busy} className={btn}>Save</button><button type="button" onClick={unmark} className={btnRed}>Remove mark</button><button type="button" onClick={() => setCell(null)} className={btnLight}>Close</button></div>
    </form>}
    <div className="overflow-x-auto"><table className="text-xs">
      <thead><tr className="bg-slate-50"><th className={th}>Employee</th>{days.map((d, i) => <th key={i} className="px-1 py-1 text-center font-semibold">{i + 1}<div className="font-normal text-slate-400">{d}</div></th>)}
        <th className={th}>P</th><th className={th}>HD</th><th className={th}>A</th><th className={th}>Leave</th><th className={th}>?</th></tr></thead>
      <tbody>{(data?.rows || []).map((row: any) => <tr key={row.employeeId} className="border-t">
        <td className="whitespace-nowrap px-2 py-1 font-semibold">{row.name}<div className="font-normal text-slate-500">{row.employeeCode}</div></td>
        {(row.days || []).map((c: string, i: number) => <td key={i} className="px-0.5 py-1 text-center">
          <button type="button" disabled={c === '-'} onClick={() => setCell({ employeeId: row.employeeId, name: row.name, date: `${month}-${String(i + 1).padStart(2, '0')}`, code: c })}
            className={`w-8 rounded px-0.5 py-0.5 font-bold ${CODE_STYLE[c] || 'bg-amber-100 text-amber-800'}`}>{c}</button></td>)}
        <td className="px-2">{row.present}</td><td className="px-2">{row.halfDays}</td><td className="px-2">{row.absent}</td><td className="px-2">{row.leave}</td><td className="px-2">{row.unmarked}</td>
      </tr>)}</tbody>
    </table></div>
  </Section>;
}

function LeaveRequests({ employees, hr }: { employees: any[]; hr: boolean }) {
  const [status, setStatus] = useState('PENDING'), [rows, setRows] = useState<any[]>([]), [types, setTypes] = useState<any[]>([]);
  const load = () => api('/api/hr/leave/requests?status=' + (status === 'ALL' ? '' : status)).then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, [status]);
  useEffect(() => { api('/api/hr/leave/types').then(setTypes).catch(() => {}); }, []);
  const decide = (x: any, ok: boolean) => {
    const note = window.prompt(ok ? 'Note (optional)' : 'Why is the leave refused?', '');
    if (note === null) return;
    void r.run(() => api(`/api/hr/leave/requests/${x.id}/${ok ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ note }) }));
  };
  async function enter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const b: any = Object.fromEntries(new FormData(f)); b.halfDay = b.halfDay === 'on';
    if (await r.run(() => api('/api/hr/leave/requests', { method: 'POST', body: JSON.stringify(b) }), 'Leave entered; it waits for a decision')) f.reset();
  }
  return <>
    <Section title="Leave requests" right={<select value={status} onChange={e => setStatus(e.target.value)} className={input}>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'].map(s => <option key={s}>{s}</option>)}</select>}>
      <Banner msg={r.msg} error={r.err} />
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>Leave</th><th className={th}>Dates</th><th className={th}>Days</th><th className={th}>Reason</th><th className={th}>Status</th><th className={th}>Decided</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id} className="border-t">
          <td className={td}><b>{x.employeeName}</b><div className="text-xs text-slate-500">{x.employeeCode}</div></td>
          <td className={td}>{x.leaveName || x.leaveCode}</td><td className={td}>{day(x.fromDate)}{x.toDate !== x.fromDate && <> to {day(x.toDate)}</>}{x.halfDay && ' (half)'}</td>
          <td className={td}>{x.days}</td><td className={td}>{x.reason}</td><td className={td}><Badge v={x.status} /></td>
          <td className={td}>{x.decidedBy ? <>{x.decidedBy}<div className="text-xs text-slate-500">{when(x.decidedAt)} {x.decisionNote}</div></> : '-'}</td>
          <td className={td}><div className="flex gap-1">
            {x.status === 'PENDING' && <><button disabled={r.busy} onClick={() => decide(x, true)} className={btnLight}>Approve</button><button disabled={r.busy} onClick={() => decide(x, false)} className={btnRed}>Refuse</button></>}
            {['PENDING', 'APPROVED'].includes(x.status) && <button disabled={r.busy} onClick={() => { if (confirm('Cancel this leave?')) void r.run(() => api(`/api/hr/leave/requests/${x.id}/cancel`, { method: 'POST' })); }} className={btnLight}>Cancel</button>}
          </div></td>
        </tr>)}</tbody></table></div>
    </Section>
    {hr && <Section title="Enter leave for someone">
      <form onSubmit={enter} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><label className={label}>Employee *</label><EmployeeSelect employees={employees} /></div>
        <div><label className={label}>Leave *</label><select name="leaveCode" required className={input}>{types.filter(t => t.active).map(t => <option key={t.code} value={t.code}>{t.name}</option>)}</select></div>
        <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="halfDay" className="h-4 w-4" />Half day</label>
        <div><label className={label}>From *</label><input name="fromDate" type="date" required className={input} /></div>
        <div><label className={label}>To</label><input name="toDate" type="date" className={input} /></div>
        <div className="md:col-span-2"><label className={label}>Reason</label><input name="reason" className={input} /></div>
        <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Enter leave</button></div>
      </form>
    </Section>}
  </>;
}

function Balances({ employees, hr }: { employees: any[]; hr: boolean }) {
  const [emp, setEmp] = useState(''), [year, setYear] = useState(new Date().getFullYear()), [rows, setRows] = useState<any[]>([]);
  const load = () => emp ? api(`/api/hr/leave/balances?employeeId=${emp}&year=${year}`).then(setRows) : Promise.resolve(setRows([]));
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, [emp, year]);
  async function opening(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.currentTarget));
    await r.run(() => api('/api/hr/leave/opening', { method: 'PUT', body: JSON.stringify({ ...b, employeeId: emp, year }) }), 'Opening balance saved');
  }
  return <Section title="Leave balances" right={<div className="flex gap-2"><div className="w-80"><EmployeeSelect employees={employees} value={emp} onChange={setEmp} required={false} /></div>
    <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className={`${input} w-28`} /></div>}>
    <Banner msg={r.msg} error={r.err} />
    {emp && <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Leave</th><th className={th}>Paid</th><th className={th}>For the year</th><th className={th}>Carried / opening</th><th className={th}>Taken</th><th className={th}>Waiting</th><th className={th}>Left</th></tr></thead>
      <tbody>{rows.map(x => <tr key={x.code} className="border-t"><td className={td}><b>{x.name}</b> ({x.code})</td><td className={td}>{x.paid ? 'Yes' : 'No'}</td><td className={td}>{x.entitled ?? '-'}</td>
        <td className={td}>{x.opening}</td><td className={td}>{x.taken}</td><td className={td}>{x.pending}</td><td className={`${td} font-bold`}>{x.available ?? '-'}</td></tr>)}</tbody></table>}
    {emp && hr && <form onSubmit={opening} className="mt-4 grid gap-3 md:grid-cols-4">
      <div><label className={label}>Leave</label><select name="leaveCode" className={input}>{rows.filter(x => x.paid).map(x => <option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
      <div><label className={label}>Opening days for {year}</label><input name="days" type="number" step="0.5" required className={input} /></div>
      <div><label className={label}>Note</label><input name="note" className={input} placeholder="Carried from last year" /></div>
      <div className="flex items-end"><button disabled={r.busy} className={btn}>Set opening balance</button></div>
    </form>}
  </Section>;
}

function Holidays() {
  const [year, setYear] = useState(new Date().getFullYear()), [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/hr/holidays?year=' + year).then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, [year]);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const b: any = Object.fromEntries(new FormData(f)); b.optional = b.optional === 'on';
    if (await r.run(() => api('/api/hr/holidays', { method: 'POST', body: JSON.stringify(b) }), 'Holiday added')) f.reset();
  }
  return <Section title="Holidays" right={<input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className={`${input} w-28`} />}>
    <Banner msg={r.msg} error={r.err} />
    <form onSubmit={add} className="mb-4 grid gap-3 md:grid-cols-4">
      <div><label className={label}>Date *</label><input name="date" type="date" required className={input} /></div>
      <div><label className={label}>Name *</label><input name="name" required className={input} /></div>
      <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="optional" className="h-4 w-4" />Optional holiday</label>
      <div className="flex items-end"><button disabled={r.busy} className={btn}>Add holiday</button></div>
    </form>
    <table className="w-full text-sm"><tbody>{rows.map(h => <tr key={h.id} className="border-t"><td className={td}>{day(h.date)}</td><td className={td}>{h.name}{h.optional && ' (optional)'}</td>
      <td className={td}><button onClick={() => { if (confirm(`Remove ${h.name}?`)) void r.run(() => api('/api/hr/holidays/' + h.id, { method: 'DELETE' }), 'Removed'); }} className={btnRed}>Remove</button></td></tr>)}</tbody></table>
  </Section>;
}

function LeaveTypes() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/hr/leave/types').then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const b: any = Object.fromEntries(f);
    b.paid = f.get('paid') === 'on'; b.active = f.get('active') === 'on';
    await r.run(() => api('/api/hr/leave/types/' + encodeURIComponent(String(b.code).toUpperCase()), { method: 'PUT', body: JSON.stringify(b) }), 'Leave type saved');
  }
  return <Section title="Leave types">
    <Banner msg={r.msg} error={r.err} />
    <p className="mb-2 text-sm text-slate-500">Days for the year are given in full to people who joined before the year; people who join in the year get them for the months left.</p>
    {[...rows, { code: '', name: '', daysPerYear: '', paid: true, carryForwardMax: 0, active: true, isNew: true }].map(t =>
      <form key={t.code || 'new'} onSubmit={save} className="grid gap-2 border-t py-2 md:grid-cols-7">
        <input name="code" defaultValue={t.code} readOnly={!t.isNew} required placeholder="Code" className={input} />
        <input name="name" defaultValue={t.name} required placeholder="Name" className={`${input} md:col-span-2`} />
        <input name="daysPerYear" type="number" step="0.5" defaultValue={t.daysPerYear ?? ''} placeholder="Days a year" className={input} />
        <input name="carryForwardMax" type="number" step="0.5" defaultValue={t.carryForwardMax ?? 0} placeholder="Carry forward" title="Most days carried to next year" className={input} />
        <div className="flex items-center gap-3 text-sm"><label className="flex items-center gap-1"><input type="checkbox" name="paid" defaultChecked={t.paid} />Paid</label><label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={t.active} />On</label></div>
        <button disabled={r.busy} className={btnLight}>{t.isNew ? 'Add' : 'Save'}</button>
      </form>)}
  </Section>;
}
