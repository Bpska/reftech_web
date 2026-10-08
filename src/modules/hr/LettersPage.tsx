/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-005 -- HR letters as PDF from templates (permission HR_LETTERS). Choose the employee and the letter, fill
// the extra values the template asks for (purpose, reason ...), preview, issue: the letter gets the next number
// HR/<year>/NNNN and a PDF on the company letterhead, kept with its fingerprint. Templates are edited here; every
// save is a new version, issued letters keep the version they were made from.
// Backend: /api/hr/letters/** (LetterController).
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, apiOpen } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, EmployeeSelect, HR_SCRIPT, NoAccess, Tabs, can, useEmployees, useMe, useRunner, when } from './hr';

export function LettersPage() {
  const me = useMe();
  const employees = useEmployees(true);
  const [tab, setTab] = useState('issue'), [data, setData] = useState<any>(null), [list, setList] = useState<any[]>([]);
  const load = async () => { setData(await api('/api/hr/letters/templates')); setList(await api('/api/hr/letters')); };
  const r = useRunner(load);
  useEffect(() => { if (me && me.ready !== false && can(me, 'HR_LETTERS')) load().catch(e => r.setErr(e.message)); }, [me]);
  // Update Employee opens this page as /hr/letters?employee=<id>&letter=<template code> to start a letter for that employee.
  const [params] = useSearchParams();
  const [emp, setEmp] = useState(params.get('employee') || ''), [code, setCode] = useState((params.get('letter') || '').toUpperCase()), [extra, setExtra] = useState<Record<string, string>>({}), [preview, setPreview] = useState<any>(null);
  const templates: any[] = (data?.templates || []).filter((t: any) => t.active);
  const template = templates.find(t => t.code === code);
  const asked = (params.get('letter') || '').toUpperCase();
  const askedMissing = !!asked && !!data && code === asked && !template;
  const extras = useMemo(() => Array.from(new Set(String(template?.body || '').concat(' ', template?.subject || '').match(/\{\{extra\.([a-zA-Z0-9_]+)\}\}/g) || []))
    .map(x => x.replace('{{extra.', '').replace('}}', '')), [template]);

  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">HR Letters</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'HR_LETTERS')) return <><h1 className="text-3xl font-bold">HR Letters</h1><NoAccess what="work with HR letters" /></>;

  const body = () => ({ employeeId: emp, code, extra });
  async function doPreview() { setPreview(null); const x = await r.run(() => api('/api/hr/letters/preview', { method: 'POST', body: JSON.stringify(body()) }), ' '); if (x && x !== true) setPreview(x); r.setMsg(''); }
  async function issue(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Issue this letter? It gets a number and cannot be changed, only cancelled.')) return;
    const x = await r.run(() => api('/api/hr/letters', { method: 'POST', body: JSON.stringify(body()) }));
    if (x?.letterNumber) { r.setMsg(`Letter ${x.letterNumber} issued.`); setPreview(null); apiOpen(`/api/hr/letters/${x.id}/pdf`).catch(() => {}); }
  }
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><FileSignature />HR Letters</h1>
    <p className="text-slate-600">Offer, appointment, experience, relieving, salary certificate and other letters as numbered PDFs on the letterhead.</p>
    <Tabs value={tab} onChange={setTab} tabs={[['issue', 'Make a letter'], ['issued', `Issued (${list.length})`], ['templates', 'Templates']]} />
    <Banner msg={r.msg.trim()} error={r.err} />
    {tab === 'issue' && <Section title="Make a letter">
      <form onSubmit={issue} className="grid gap-3 md:grid-cols-3">
        <div><label className={label}>Employee *</label><EmployeeSelect employees={employees} value={emp} onChange={v => { setEmp(v); setPreview(null); }} /></div>
        <div><label className={label}>Letter *</label><select required value={code} onChange={e => { setCode(e.target.value); setExtra({}); setPreview(null); }} className={input}>
          <option value="">Choose the letter</option>{templates.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}</select></div>
        <div>{askedMissing && <p className="text-sm text-amber-800">There is no letter template {asked} in use. Choose another letter, or add it under Templates.</p>}</div>
        {extras.map(k => <div key={k}><label className={label}>{k.charAt(0).toUpperCase() + k.slice(1)}</label><input value={extra[k] || ''} onChange={e => setExtra({ ...extra, [k]: e.target.value })} className={input} /></div>)}
        <div className="flex gap-2 md:col-span-full"><button type="button" disabled={!emp || !code || r.busy} onClick={doPreview} className={btnLight}>Preview</button><button disabled={!emp || !code || r.busy} className={btn}>Issue letter</button></div>
      </form>
      {preview && <div className="mt-4 rounded-xl border bg-slate-50 p-4">
        <div className="font-bold">{preview.subject}</div>
        <div className="mt-2 whitespace-pre-line text-sm">{preview.body}</div>
        {preview.missing?.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Not known yet: {preview.missing.join(', ')}. Fill them in HR (or in the boxes above) before issuing.</div>}
      </div>}
    </Section>}
    {tab === 'issued' && <Section title="Issued letters">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Number</th><th className={th}>Employee</th><th className={th}>Letter</th><th className={th}>Status</th><th className={th}>Issued</th><th className={th}></th></tr></thead>
        <tbody>{list.map(l => <tr key={l.id} className="border-t">
          <td className={`${td} font-semibold`}>{l.letterNumber}</td><td className={td}>{l.employeeName}<div className="text-xs text-slate-500">{l.employeeCode}</div></td><td className={td}>{l.subject}</td>
          <td className={td}><Badge v={l.status} />{l.cancelledReason && <div className="text-xs text-slate-500">{l.cancelledReason}</div>}</td><td className={td}>{l.issuedBy}<div className="text-xs text-slate-500">{when(l.issuedAt)}</div></td>
          <td className={td}><div className="flex gap-1"><button onClick={() => apiOpen(`/api/hr/letters/${l.id}/pdf`).catch(e => r.setErr(e.message))} className={btnLight}>PDF</button>
            {l.status === 'ISSUED' && <button onClick={() => { const why = window.prompt('Why is this letter cancelled?', ''); if (why) void r.run(() => api(`/api/hr/letters/${l.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: why }) }), 'Letter cancelled'); }} className={btnRed}>Cancel</button>}</div></td>
        </tr>)}</tbody></table>
    </Section>}
    {tab === 'templates' && data && <Templates data={data} r={r} />}
  </>;
}

function Templates({ data, r }: { data: any; r: ReturnType<typeof useRunner> }) {
  const [code, setCode] = useState('');
  const t = (data.templates || []).find((x: any) => x.code === code);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const b: any = Object.fromEntries(f); b.active = f.get('active') === 'on';
    const c = String(b.code || code).trim().toUpperCase();
    await r.run(() => api('/api/hr/letters/templates/' + encodeURIComponent(c), { method: 'PUT', body: JSON.stringify(b) }), 'Template saved as a new version');
  }
  return <Section title="Templates">
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-1">
        {(data.templates || []).map((x: any) => <button key={x.code} onClick={() => setCode(x.code)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${code === x.code ? 'bg-sky-700 text-white' : 'bg-slate-50 hover:bg-slate-100'}`}>
          <b>{x.name}</b> <span className="opacity-70">v{x.version}{!x.active && ' (off)'}</span></button>)}
        <button onClick={() => setCode('_NEW')} className={`${btnLight} mt-2 w-full`}>New template</button>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><b>Fields you can use</b>
          {Object.entries(data.fields || {}).map(([k, v]) => <div key={k}><code>{`{{${k}}}`}</code> {String(v)}</div>)}</div>
      </div>
      {code && <form key={code} onSubmit={save} className="space-y-3 md:col-span-2">
        {code === '_NEW' && <div><label className={label}>Code *</label><input name="code" required placeholder="TRANSFER" className={input} /></div>}
        <div><label className={label}>Name *</label><input name="name" required defaultValue={t?.name} className={input} /></div>
        <div><label className={label}>Subject *</label><input name="subject" required defaultValue={t?.subject} className={input} /></div>
        <div><label className={label}>Text *</label><textarea name="body" required rows={14} defaultValue={t?.body} className={`${input} font-mono text-sm`} /></div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={t ? t.active : true} className="h-4 w-4" />In use</label>
        <button disabled={r.busy} className={btn}>Save as new version</button>
      </form>}
    </div>
  </Section>;
}
