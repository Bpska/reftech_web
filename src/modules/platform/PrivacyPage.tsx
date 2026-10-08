/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-001 -- Privacy (company Admin; India DPDP Act 2023): switches for hiding identity and mobile numbers, the
// consent text for driver location sharing, the data-protection officer, and requests of people about their data:
// EXPORT (a JSON file), ERASE (names, contact and identity data removed) or CORRECT (done by hand).
// Another Admin than the one who asked must approve (four eyes).
// Backend: /api/platform/privacy/** (PrivacyController).
import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { Badge, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';

const SUBJECTS: [string, string][] = [['EMPLOYEE', 'Employee'], ['DRIVER', 'Driver'], ['PARTNER_USER', 'Customer login']];
const TYPES: [string, string][] = [['EXPORT', 'Copy of the data'], ['ERASE', 'Remove the data'], ['CORRECT', 'Correct the data']];

export function PrivacyPage() {
  const st = usePlatform();
  const [s, setS] = useState<any>(null), [reload, setReload] = useState(0);
  const [form, setForm] = useState({ subjectType: 'EMPLOYEE', subjectId: '', requestType: 'EXPORT', reason: '' }), [who, setWho] = useState('');
  const load = async () => { setS(await api('/api/platform/privacy/settings')); setReload(n => n + 1); };
  const r = useRunner(load);
  useEffect(() => { if (st?.ready && st.admin) load().catch(e => r.setErr(e.message)); }, [st?.ready, st?.admin]);
  useEffect(() => {
    setWho('');
    if (!form.subjectId || !/^\d+$/.test(form.subjectId)) return;
    const t = setTimeout(() => api(`/api/platform/privacy/subject?type=${form.subjectType}&id=${form.subjectId}`)
      .then(x => setWho(`${x.name} (${x.code || '-'}, ${x.status})`)).catch(e => setWho(e.message)), 400);
    return () => clearTimeout(t);
  }, [form.subjectType, form.subjectId]);
  const title = <PageTitle icon={<ShieldCheck aria-hidden />} title="Privacy">Personal data settings and requests of people about their data (India DPDP Act 2023).</PageTitle>;
  if (!st) return <>{title}<p className="mt-4 text-slate-500">Loading...</p></>;
  if (!st.ready) return <>{title}<ScriptMissing /></>;
  if (!st.admin) return <>{title}<NotAllowed what="change privacy settings (Admin only)" /></>;

  function saveSettings(e: FormEvent) {
    e.preventDefault();
    void r.run(() => api('/api/platform/privacy/settings', { method: 'PUT', body: JSON.stringify(s) }), 'Privacy settings saved');
  }
  function create(e: FormEvent) {
    e.preventDefault();
    void r.run(async () => { const x = await api('/api/platform/privacy/requests', { method: 'POST', body: JSON.stringify(form) }); setForm(f => ({ ...f, subjectId: '', reason: '' })); return x; });
  }
  function act(id: number, what: 'approve' | 'reject' | 'done', ask: string, needed = false) {
    const note = window.prompt(ask, '');
    if (note === null || (needed && !note.trim())) return;
    void r.run(() => api(`/api/platform/privacy/requests/${id}/${what}`, { method: 'POST', body: JSON.stringify({ note }) }));
  }

  return <>
    {title}
    <Banner msg={r.msg} error={r.err} />
    {s && <Section title="Settings">
      <form onSubmit={saveSettings} className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!s.maskIdentityInExports} onChange={e => setS({ ...s, maskIdentityInExports: e.target.checked })} />
          Hide identity numbers (Aadhaar, PAN, licence) in exports, showing only the last 4 characters</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!s.maskMobileForPartners} onChange={e => setS({ ...s, maskMobileForPartners: e.target.checked })} />
          Hide mobile numbers of drivers and staff from customer logins (they see ******3210)</label>
        <div className="md:col-span-2"><label htmlFor="consent" className={label}>Consent text shown to drivers before location sharing</label>
          <textarea id="consent" rows={3} maxLength={2000} className={input} value={s.consentText || ''} onChange={e => setS({ ...s, consentText: e.target.value })} />
          <p className="mt-1 text-xs text-slate-500">Each driver sees this on the driver page and presses "I agree" once. When you change the text, every driver is asked again.</p></div>
        <div><label htmlFor="dpo-name" className={label}>Data-protection officer (name)</label>
          <input id="dpo-name" className={input} value={s.dpoName || ''} onChange={e => setS({ ...s, dpoName: e.target.value })} /></div>
        <div><label htmlFor="dpo-email" className={label}>Data-protection officer (email)</label>
          <input id="dpo-email" type="email" className={input} value={s.dpoEmail || ''} onChange={e => setS({ ...s, dpoEmail: e.target.value })} /></div>
        <div className="md:col-span-2"><button disabled={r.busy} className={btn}>Save settings</button></div>
      </form>
    </Section>}

    <Section title="New request from a person">
      <form onSubmit={create} className="grid gap-3 md:grid-cols-4">
        <div><label htmlFor="p-type" className={label}>Person is</label>
          <select id="p-type" className={input} value={form.subjectType} onChange={e => setForm({ ...form, subjectType: e.target.value })}>{SUBJECTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div><label htmlFor="p-id" className={label}>Number of the person</label>
          <input id="p-id" inputMode="numeric" className={input} value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value.trim() })} required aria-describedby="p-who" />
          <div id="p-who" className="mt-0.5 text-xs text-slate-600" aria-live="polite">{who}</div></div>
        <div><label htmlFor="p-req" className={label}>Asks for</label>
          <select id="p-req" className={input} value={form.requestType} onChange={e => setForm({ ...form, requestType: e.target.value })}>{TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div className="md:col-span-4"><label htmlFor="p-reason" className={label}>Reason or the person's words</label>
          <textarea id="p-reason" rows={2} maxLength={1000} className={input} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required /></div>
        <div className="md:col-span-4 text-sm text-slate-600">Removing data is only possible after the person is marked as left. Another Admin must approve each request.</div>
        <div><button disabled={r.busy} className={btn}>Save request</button></div>
      </form>
    </Section>

    <Section title="Requests">
      <DataTable path="/api/platform/privacy/requests" reloadKey={reload}
        filters={[{ name: 'status', label: 'Status', options: [['OPEN', 'Open'], ['APPROVED', 'Approved'], ['DONE', 'Done'], ['REJECTED', 'Rejected']] },
          { name: 'requestType', label: 'Asks for', options: TYPES }, { name: 'subjectType', label: 'Person', options: SUBJECTS }]}
        columns={[
          { key: 'createdAt', label: 'Asked', sort: 'createdAt', render: x => <>{when(x.createdAt)}<div className="text-xs text-slate-500">{x.requestedBy}</div></> },
          { key: 'subjectName', label: 'Person', sort: 'subjectName', render: x => <>{x.subjectName}<div className="text-xs text-slate-500">{x.subjectType} #{x.subjectId}</div></> },
          { key: 'requestType', label: 'Asks for' },
          { key: 'reason', label: 'Reason', className: 'max-w-xs' },
          { key: 'status', label: 'Status', sort: 'status', render: x => <><Badge v={x.status} />{x.approvedBy && <div className="text-xs text-slate-500">{x.approvedBy}</div>}</> },
          { key: 'result', label: 'Result', className: 'max-w-xs', render: x => x.result || x.decisionNote || '-' },
          { key: 'actions', label: 'Actions', render: x => <div className="flex flex-wrap gap-1">
            {x.status === 'OPEN' && <>
              <button type="button" disabled={r.busy} className={btnLight} onClick={() => act(x.id, 'approve', 'Note for the approval (optional)')}>Approve</button>
              <button type="button" disabled={r.busy} className={btnRed} onClick={() => act(x.id, 'reject', 'Why is the request rejected?', true)}>Reject</button></>}
            {x.status === 'APPROVED' && x.requestType === 'CORRECT' && <button type="button" disabled={r.busy} className={btnLight} onClick={() => act(x.id, 'done', 'What was corrected?')}>Done</button>}
            {x.fileId && <button type="button" className={btnLight} onClick={() => apiDownload(`/api/platform/privacy/requests/${x.id}/file`, `personal-data-${x.id}.json`).catch(e => r.setErr(e.message))}>Download</button>}
          </div> },
        ]} />
    </Section>
  </>;
}
