/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-008 -- the HR document register (permission HR_DOCUMENTS). For every active employee: each document the
// role needs (set under "What is needed") and its state: missing, waiting to be checked (sent from My HR), on file,
// expiring (within the warning days) or expired. HR files are on file at once; files sent by the person wait for a
// check. The photo, ID copy and driving licence taken at onboarding count as on file.
// Backend: /api/hr/documents/** (HrDocumentController).
import { FormEvent, useEffect, useState } from 'react';
import { FolderCheck } from 'lucide-react';
import { api, apiOpen, apiUpload } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, EmployeeSelect, HR_SCRIPT, NoAccess, Tabs, can, day, useEmployees, useMe, useRunner, when } from './hr';

export function HrDocumentsPage() {
  const me = useMe();
  const employees = useEmployees();
  const [tab, setTab] = useState('register'), [reg, setReg] = useState<any>(null), [check, setCheck] = useState<any[]>([]), [exp, setExp] = useState<any[]>([]), [types, setTypes] = useState<any[]>([]);
  const [emp, setEmp] = useState(''), [files, setFiles] = useState<any[]>([]), [filter, setFilter] = useState('PROBLEMS');
  const load = async () => {
    setReg(await api('/api/hr/documents/register')); setCheck(await api('/api/hr/documents/to-check')); setExp(await api('/api/hr/documents/expiring?days=60'));
    if (emp) setFiles(await api(`/api/hr/documents/employees/${emp}?all=true`));
  };
  const r = useRunner(load);
  useEffect(() => { if (me && can(me, 'HR_DOCUMENTS') && me.ready !== false) { load().catch(e => r.setErr(e.message)); api('/api/hr/documents/types').then(setTypes).catch(() => {}); } }, [me]);
  useEffect(() => { if (emp) api(`/api/hr/documents/employees/${emp}?all=true`).then(setFiles).catch(e => r.setErr(e.message)); else setFiles([]); }, [emp]);
  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">HR Documents</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'HR_DOCUMENTS')) return <><h1 className="text-3xl font-bold">HR Documents</h1><NoAccess what="work with the HR document register" /></>;

  const open = (d: any, employeeId?: number) => (d.id ? apiOpen(`/api/hr/documents/${d.id}/file`) : apiOpen(`/api/hr/documents/legacy/${employeeId}/${d.code}`)).catch(e => r.setErr(e.message));
  const decide = (d: any, ok: boolean) => {
    const note = ok ? '' : window.prompt('Why is the document not accepted? The person sees this.', '');
    if (note === null) return;
    void r.run(() => api(`/api/hr/documents/${d.id}/check`, { method: 'POST', body: JSON.stringify({ ok, note }) }), ok ? 'Accepted and on file' : 'Refused');
  };
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f);
    const ok = await r.run(() => apiUpload(`/api/hr/documents/employees/${emp}`, { file: fd.get('file') as File, code: String(fd.get('code')), title: String(fd.get('title') || ''),
      number: String(fd.get('number') || ''), issuedOn: String(fd.get('issuedOn') || ''), expiresOn: String(fd.get('expiresOn') || '') }), 'Document on file');
    if (ok) f.reset();
  }
  const s = reg?.summary || {};
  const rows = (reg?.rows || []).filter((x: any) => filter === 'ALL' || x.documents.some((d: any) => d.state !== 'VERIFIED' && d.state !== 'ON_FILE'));
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><FolderCheck />HR Documents</h1>
    <p className="text-slate-600">Every needed document of every active employee, what waits for a check and what expires.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-4">
      {[['Missing', s.missing, 'text-red-700'], ['To check', s.toCheck, 'text-amber-700'], ['Expiring', s.expiring, 'text-amber-700'], ['Expired', s.expired, 'text-red-800']].map(([t, v, c]) =>
        <div key={String(t)} className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">{t}</div><div className={`text-3xl font-bold ${c}`}>{v ?? '-'}</div></div>)}
    </div>
    <Tabs value={tab} onChange={setTab} tabs={[['register', 'Register'], ['check', `To check (${check.length})`], ['expiring', `Expiring (${exp.length})`], ['files', 'Files of an employee'], ['needed', 'What is needed']]} />
    <Banner msg={r.msg} error={r.err} />
    {tab === 'register' && <Section title="Register" right={<select value={filter} onChange={e => setFilter(e.target.value)} className={input}><option value="PROBLEMS">Only people with something open</option><option value="ALL">Everyone</option></select>}>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>Documents</th><th className={th}></th></tr></thead>
        <tbody>{rows.map((x: any) => <tr key={x.employeeId} className="border-t">
          <td className={td}><b>{x.name}</b><div className="text-xs text-slate-500">{x.employeeCode} {x.role} {x.department}</div></td>
          <td className={td}><div className="flex flex-wrap gap-1.5">{x.documents.map((d: any) => <span key={d.code} className="inline-flex items-center gap-1 text-xs">{d.name}: <Badge v={d.state} />{d.expiresOn && <span className="text-slate-500">{day(d.expiresOn)}</span>}</span>)}</div></td>
          <td className={td}><button onClick={() => { setEmp(String(x.employeeId)); setTab('files'); }} className={btnLight}>Files</button></td>
        </tr>)}</tbody></table></div>
    </Section>}
    {tab === 'check' && <Section title="Sent from My HR, waiting for a check">
      <table className="w-full text-sm"><tbody>{check.map(d => <tr key={d.id} className="border-t">
        <td className={td}><b>{d.employeeName}</b> {d.employeeCode}</td><td className={td}>{d.typeName}{d.number && ` - ${d.number}`}{d.expiresOn && ` (expires ${day(d.expiresOn)})`}</td><td className={td}>{when(d.uploadedAt)}</td>
        <td className={td}><div className="flex gap-1"><button onClick={() => open(d)} className={btnLight}>Open</button><button disabled={r.busy} onClick={() => decide(d, true)} className={btnLight}>Accept</button><button disabled={r.busy} onClick={() => decide(d, false)} className={btnRed}>Refuse</button></div></td>
      </tr>)}</tbody></table>
    </Section>}
    {tab === 'expiring' && <Section title="Expired or expiring in 60 days">
      <table className="w-full text-sm"><tbody>{exp.map(d => <tr key={d.id} className="border-t">
        <td className={td}><b>{d.employeeName}</b> {d.employeeCode}</td><td className={td}>{d.typeName}{d.number && ` - ${d.number}`}</td><td className={td}>{day(d.expiresOn)}</td>
        <td className={td}><span className={Number(d.daysLeft) < 0 ? 'font-bold text-red-700' : 'font-semibold text-amber-700'}>{Number(d.daysLeft) < 0 ? `expired ${-d.daysLeft} days ago` : `${d.daysLeft} days left`}</span></td>
        <td className={td}><button onClick={() => { setEmp(String(d.employeeId)); setTab('files'); }} className={btnLight}>Add the new one</button></td></tr>)}</tbody></table>
    </Section>}
    {tab === 'files' && <Section title="Files of an employee" right={<div className="w-96"><EmployeeSelect employees={employees} value={emp} onChange={setEmp} required={false} /></div>}>
      {emp && <form onSubmit={upload} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <div><label className={label}>Kind *</label><select name="code" required className={input}>{types.map(t => <option key={t.code} value={t.code}>{t.name}{t.hasExpiry ? ' (has expiry)' : ''}</option>)}</select></div>
        <div><label className={label}>Number</label><input name="number" className={input} /></div>
        <div><label className={label}>Issued on</label><input name="issuedOn" type="date" className={input} /></div>
        <div><label className={label}>Expires on</label><input name="expiresOn" type="date" className={input} /></div>
        <div className="md:col-span-2"><label className={label}>Title</label><input name="title" className={input} /></div>
        <div><label className={label}>File (PDF, JPG, PNG) *</label><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className={input} /></div>
        <div className="flex items-end"><button disabled={r.busy} className={btn}>Put on file</button></div>
      </form>}
      <table className="w-full text-sm"><tbody>{files.map((d, i) => <tr key={d.id || 'l' + i} className="border-t">
        <td className={td}><b>{d.typeName || d.code}</b>{d.title && <div className="text-xs text-slate-500">{d.title}</div>}</td><td className={td}>{d.number || '-'}</td>
        <td className={td}>{d.expiresOn ? `expires ${day(d.expiresOn)}` : '-'}</td><td className={td}><Badge v={d.status} />{d.checkNote && <div className="text-xs text-slate-500">{d.checkNote}</div>}</td>
        <td className={td}>{d.source === 'SELF' ? 'Sent by the person' : d.source === 'ONBOARDING' ? 'Onboarding' : 'HR'} {d.uploadedBy && `- ${d.uploadedBy}`}<div className="text-xs text-slate-500">{when(d.uploadedAt)}</div></td>
        <td className={td}><div className="flex gap-1"><button onClick={() => open(d, Number(emp))} className={btnLight}>Open</button>
          {d.status === 'PENDING' && d.id && <><button onClick={() => decide(d, true)} className={btnLight}>Accept</button><button onClick={() => decide(d, false)} className={btnRed}>Refuse</button></>}</div></td>
      </tr>)}</tbody></table>
    </Section>}
    {tab === 'needed' && <Needed types={types} r={r} />}
  </>;
}

function Needed({ types, r }: { types: any[]; r: ReturnType<typeof useRunner> }) {
  const [req, setReq] = useState<Record<string, string[]>>({}), [role, setRole] = useState('*');
  useEffect(() => { api('/api/hr/documents/requirements').then(setReq).catch(e => r.setErr(e.message)); }, []);
  const roles = Array.from(new Set(['*', 'DRIVER', 'EMPLOYEE', 'MANAGER', 'HR', 'BILLING', 'WAREHOUSE_MANAGER', ...Object.keys(req)]));
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const x = await r.run(() => api('/api/hr/documents/requirements/' + encodeURIComponent(role), { method: 'PUT', body: JSON.stringify({ codes: f.getAll('codes') }) }), 'Saved; the register uses it at once');
    if (x && x !== true) setReq(x);
  }
  return <Section title="What is needed" right={<select value={role} onChange={e => setRole(e.target.value)} className={input}>{roles.map(x => <option key={x} value={x}>{x === '*' ? 'Everyone' : 'Also for ' + x}</option>)}</select>}>
    <p className="mb-2 text-sm text-slate-500">"Everyone" applies to all employees; a role adds its own on top (a driver also needs the driving licence ...).</p>
    <form key={role + JSON.stringify(req[role] || [])} onSubmit={save} className="grid gap-2 md:grid-cols-3">
      {types.map(t => <label key={t.code} className="flex items-center gap-2 text-sm"><input type="checkbox" name="codes" value={t.code} defaultChecked={(req[role] || []).includes(t.code)} className="h-4 w-4" />{t.name}</label>)}
      <div className="md:col-span-full"><button disabled={r.busy} className={btn}>Save</button></div>
    </form>
  </Section>;
}
