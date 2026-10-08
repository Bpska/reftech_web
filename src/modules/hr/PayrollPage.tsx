/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-004 -- payroll and payslips. HR_PAYROLL prepares the month (works out every payslip from the salary
// structure, the unpaid days of attendance and leave, PF, ESI, professional tax, TDS and the month's adjustments);
// HR_PAYROLL_APPROVE approves it (not the person who prepared it), downloads the bank list and marks it paid.
// Approved payslips appear in each person's My HR. Backend: /api/hr/payroll/** (PayrollController).
import { FormEvent, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api, apiDownload, apiOpen } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, EmployeeSelect, HR_SCRIPT, NoAccess, Tabs, can, day, lastMonth, rupee, useEmployees, useMe, useRunner, when } from './hr';

export function PayrollPage() {
  const me = useMe();
  const [tab, setTab] = useState('runs');
  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">Payroll</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'HR_PAYROLL', 'HR_PAYROLL_APPROVE')) return <><h1 className="text-3xl font-bold">Payroll</h1><NoAccess what="work with payroll" /></>;
  const prep = can(me, 'HR_PAYROLL');
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Wallet />Payroll</h1>
    <p className="text-slate-600">Prepare the month, check it, approve it (four eyes), pay it. Payslips go to My HR when approved.</p>
    <Tabs value={tab} onChange={setTab} tabs={[['runs', 'Months'], ...(prep ? [['structures', 'Salary structures'], ['adjustments', 'Adjustments']] as [string, string][] : [])]} />
    {tab === 'runs' && <Runs prep={prep} approve={can(me, 'HR_PAYROLL_APPROVE')} />}
    {tab === 'structures' && prep && <Structures />}
    {tab === 'adjustments' && prep && <Adjustments />}
  </>;
}

function Runs({ prep, approve }: { prep: boolean; approve: boolean }) {
  const [rows, setRows] = useState<any[]>([]), [open, setOpen] = useState<any>(null), [month, setMonth] = useState(lastMonth());
  const load = async () => { setRows(await api('/api/hr/payroll/runs')); if (open) setOpen(await api('/api/hr/payroll/runs/' + open.id)); };
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  const show = (id: number) => api('/api/hr/payroll/runs/' + id).then(setOpen).catch(e => r.setErr(e.message));
  async function prepare(e: FormEvent) {
    e.preventDefault();
    const x = await r.run(() => api('/api/hr/payroll/runs', { method: 'POST', body: JSON.stringify({ month }) }), 'Payroll worked out. Check the payslips, then ask the approver.');
    if (x?.id) setOpen(x);
  }
  const act = (what: string, body: any = {}) => r.run(() => api(`/api/hr/payroll/runs/${open.id}/${what}`, { method: 'POST', body: JSON.stringify(body) }));
  return <>
    <Banner msg={r.msg} error={r.err} />
    {prep && <Section title="Prepare a month">
      <form onSubmit={prepare} className="flex flex-wrap items-end gap-3">
        <div><label className={label}>Month</label><input type="month" value={month} onChange={e => setMonth(e.target.value)} className={input} /></div>
        <button disabled={r.busy} className={btn}>Prepare / work out again</button>
        <span className="text-sm text-slate-500">A draft can be worked out again after attendance, leave or salary changes. An approved month cannot.</span>
      </form>
    </Section>}
    <Section title="Months">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Month</th><th className={th}>Status</th><th className={th}>People</th><th className={th}>Gross</th><th className={th}>Deductions</th><th className={th}>Net pay</th><th className={th}>Prepared</th><th className={th}>Approved</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id} className={`border-t ${open?.id === x.id ? 'bg-sky-50' : ''}`}>
          <td className={`${td} font-semibold`}>{String(x.payMonth).slice(0, 7)}</td><td className={td}><Badge v={x.status} /></td><td className={td}>{x.employees}</td>
          <td className={td}>{rupee(x.totalGross)}</td><td className={td}>{rupee(x.totalDeductions)}</td><td className={`${td} font-semibold`}>{rupee(x.totalNet)}</td>
          <td className={td}>{x.preparedBy}<div className="text-xs text-slate-500">{when(x.preparedAt)}</div></td><td className={td}>{x.approvedBy || '-'}<div className="text-xs text-slate-500">{when(x.approvedAt)}</div></td>
          <td className={td}><button onClick={() => show(x.id)} className={btnLight}>Open</button></td></tr>)}</tbody></table>
    </Section>
    {open && <Section title={`Payroll ${String(open.payMonth).slice(0, 7)}`} right={<div className="flex flex-wrap gap-2"><Badge v={open.status} />
      {approve && open.status === 'DRAFT' && <button disabled={r.busy} onClick={() => { if (confirm('Approve this payroll? The payslips go to the employees and the month is locked.')) void act('approve'); }} className={btn}>Approve</button>}
      {approve && open.status !== 'CANCELLED' && open.status !== 'DRAFT' && <button onClick={() => apiDownload(`/api/hr/payroll/runs/${open.id}/bank.csv`, `salary-${String(open.payMonth).slice(0, 7)}.csv`).catch(e => r.setErr(e.message))} className={btnLight}>Bank list (CSV)</button>}
      {approve && open.status === 'APPROVED' && <button disabled={r.busy} onClick={() => { const ref = window.prompt('Bank reference of the payment', ''); if (ref !== null) void act('paid', { paymentRef: ref }); }} className={btnLight}>Mark paid</button>}
      {(prep || approve) && ['DRAFT', 'APPROVED'].includes(open.status) && <button disabled={r.busy} onClick={() => { const n = window.prompt('Why is this payroll cancelled?', ''); if (n) void act('cancel', { note: n }); }} className={btnRed}>Cancel</button>}
    </div>}>
      {open.paidOn && <p className="mb-2 text-sm">Paid on {day(open.paidOn)} {open.paymentRef && `(ref ${open.paymentRef})`}</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1300px] text-sm">
        <thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>Paid days</th><th className={th}>Unpaid</th><th className={th}>Basic</th><th className={th}>HRA</th><th className={th}>Other earnings</th><th className={th}>Gross</th>
          <th className={th}>PF</th><th className={th}>ESI</th><th className={th}>PT</th><th className={th}>TDS</th><th className={th}>Other ded.</th><th className={th}>Net pay</th><th className={th}>Bank</th><th className={th}></th></tr></thead>
        <tbody>{(open.payslips || []).map((p: any) => <tr key={p.id} className="border-t">
          <td className={td}><b>{p.employeeName}</b><div className="text-xs text-slate-500">{p.employeeCode} {p.designation}</div></td>
          <td className={td}>{p.paidDays} / {p.monthDays}</td><td className={td}>{p.lopDays || '-'}</td><td className={td}>{rupee(p.basic)}</td><td className={td}>{rupee(p.hra)}</td>
          <td className={td}>{rupee(Number(p.conveyance || 0) + Number(p.specialAllowance || 0) + Number(p.otherAllowance || 0) + Number(p.extraEarnings || 0))}</td>
          <td className={`${td} font-semibold`}>{rupee(p.gross)}</td><td className={td}>{rupee(p.pfEmployee)}</td><td className={td}>{rupee(p.esiEmployee)}</td><td className={td}>{rupee(p.professionalTax)}</td>
          <td className={td}>{rupee(p.tds)}</td><td className={td}>{rupee(p.otherDeductions)}</td><td className={`${td} font-bold`}>{rupee(p.netPay)}</td>
          <td className={td}>{p.hasBank ? 'Yes' : <span className="font-semibold text-red-700">Missing</span>}</td>
          <td className={td}><button onClick={() => apiOpen(`/api/hr/payroll/payslips/${p.id}.pdf`).catch(e => r.setErr(e.message))} className={btnLight}>Payslip</button></td></tr>)}</tbody>
      </table></div>
    </Section>}
  </>;
}

function Structures() {
  const [rows, setRows] = useState<any[]>([]), [edit, setEdit] = useState<any>(null), [history, setHistory] = useState<any[]>([]);
  const load = () => api('/api/hr/payroll/structures').then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, []);
  function open(x: any) { setEdit(x); api('/api/hr/payroll/structures/' + x.employeeId).then(setHistory).catch(() => setHistory([])); }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const b: any = Object.fromEntries(f); b.pf = f.get('pf') === 'on'; b.esi = f.get('esi') === 'on';
    if (await r.run(() => api('/api/hr/payroll/structures/' + edit.employeeId, { method: 'PUT', body: JSON.stringify(b) }), 'Salary structure saved')) setEdit(null);
  }
  const n = (k: string, l: string) => <div><label className={label}>{l}</label><input name={k} type="number" step="0.01" min="0" defaultValue={edit?.[k] ?? 0} className={input} /></div>;
  return <>
    <Banner msg={r.msg} error={r.err} />
    {edit && <Section title={`Salary of ${edit.name}`}>
      <form key={edit.employeeId} onSubmit={save} className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>From *</label><input name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 8) + '01'} className={input} /></div>
        {n('basic', 'Basic')}{n('hra', 'House rent allowance')}{n('conveyance', 'Conveyance')}{n('specialAllowance', 'Special allowance')}{n('otherAllowance', 'Other allowance')}{n('tdsMonthly', 'TDS a month')}
        <div><label className={label}>PT state</label><input name="ptState" maxLength={2} defaultValue={edit.ptState || ''} placeholder="Company default" className={input} /></div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="pf" defaultChecked={edit.pf !== false} className="h-4 w-4" />PF</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="esi" defaultChecked={edit.esi !== false} className="h-4 w-4" />ESI (when gross is within the limit)</label>
        <div className="flex items-end gap-2 md:col-span-full"><button disabled={r.busy} className={btn}>Save new structure</button><button type="button" onClick={() => setEdit(null)} className={btnLight}>Close</button></div>
      </form>
      {history.length > 0 && <table className="mt-4 w-full text-xs"><thead><tr className="bg-slate-50"><th className={th}>From</th><th className={th}>Basic</th><th className={th}>HRA</th><th className={th}>Conveyance</th><th className={th}>Special</th><th className={th}>Other</th><th className={th}>By</th></tr></thead>
        <tbody>{history.map(h => <tr key={h.id} className="border-t"><td className={td}>{day(h.effectiveFrom)}</td><td className={td}>{rupee(h.basic)}</td><td className={td}>{rupee(h.hra)}</td><td className={td}>{rupee(h.conveyance)}</td><td className={td}>{rupee(h.specialAllowance)}</td><td className={td}>{rupee(h.otherAllowance)}</td><td className={td}>{h.createdBy}</td></tr>)}</tbody></table>}
    </Section>}
    <Section title="Salary structures">
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>From</th><th className={th}>Basic</th><th className={th}>HRA</th><th className={th}>Conveyance</th><th className={th}>Special</th><th className={th}>Gross a month</th><th className={th}>PF / ESI</th><th className={th}>Bank</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.employeeId} className="border-t">
          <td className={td}><b>{x.name}</b><div className="text-xs text-slate-500">{x.employeeCode} {x.designation}</div></td>
          <td className={td}>{x.derived ? <span className="text-amber-700">From salary in HR</span> : day(x.effectiveFrom)}</td><td className={td}>{rupee(x.basic)}</td><td className={td}>{rupee(x.hra)}</td><td className={td}>{rupee(x.conveyance)}</td><td className={td}>{rupee(x.specialAllowance)}</td>
          <td className={`${td} font-semibold`}>{rupee(x.gross)}</td><td className={td}>{x.pf ? 'PF' : '-'} / {x.esi ? 'ESI' : '-'}</td><td className={td}>{x.hasBank ? 'Yes' : <span className="text-red-700">Missing</span>}</td>
          <td className={td}><button onClick={() => open(x)} className={btnLight}>Change</button></td></tr>)}</tbody></table></div>
    </Section>
  </>;
}

function Adjustments() {
  const employees = useEmployees();
  const [month, setMonth] = useState(lastMonth()), [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/hr/payroll/adjustments?month=' + month).then(setRows);
  const r = useRunner(load);
  useEffect(() => { load().catch(e => r.setErr(e.message)); }, [month]);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget;
    if (await r.run(() => api('/api/hr/payroll/adjustments', { method: 'POST', body: JSON.stringify({ ...Object.fromEntries(new FormData(f)), month }) }), 'Added. Work out the month again to include it.')) f.reset();
  }
  return <Section title="Adjustments of the month" right={<input type="month" value={month} onChange={e => setMonth(e.target.value)} className={input} />}>
    <Banner msg={r.msg} error={r.err} />
    <p className="mb-2 text-sm text-slate-500">One-time earnings (bonus, arrears, overtime) or deductions (advance recovery, canteen) for this month only.</p>
    <form onSubmit={add} className="mb-4 grid gap-3 md:grid-cols-5">
      <div className="md:col-span-2"><label className={label}>Employee *</label><EmployeeSelect employees={employees} /></div>
      <div><label className={label}>Kind *</label><select name="kind" className={input}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select></div>
      <div><label className={label}>What *</label><input name="label" required placeholder="Overtime" className={input} /></div>
      <div><label className={label}>Amount *</label><input name="amount" type="number" step="0.01" min="0.01" required className={input} /></div>
      <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Add</button></div>
    </form>
    <table className="w-full text-sm"><tbody>{rows.map(x => <tr key={x.id} className="border-t"><td className={td}><b>{x.employeeName}</b> {x.employeeCode}</td><td className={td}>{x.kind}</td><td className={td}>{x.label}</td><td className={td}>{rupee(x.amount)}</td><td className={td}>{x.createdBy}</td>
      <td className={td}><button onClick={() => r.run(() => api('/api/hr/payroll/adjustments/' + x.id, { method: 'DELETE' }), 'Removed')} className={btnRed}>Remove</button></td></tr>)}</tbody></table>
  </Section>;
}
