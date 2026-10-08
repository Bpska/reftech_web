/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-015 -- Food Safety: the HACCP plan of each site and the certifications with their audits.
//   HACCP plans: one plan per site with its versions. A draft lists the hazards of each process step (type,
//     severity x likelihood, control measure); a critical control point (CCP) has its limit, monitoring and
//     corrective action. A Manager approves a complete draft (the old version is superseded); a change needs a new
//     version. CCP checks are recorded against the approved plan; a check outside the limit needs the corrective
//     action and tells the managers.
//   Certifications: FSSAI, BRCGS, HACCP, WHO-GDP, EIA ... per site with the certificate file, validity and the next
//     audit; reminders go out at 60, 30 and 7 days (setting) and when overdue.
//   Audits: planned and done audits with the report and the result; findings with severity and due date, closed
//     with the root cause and action (MAJOR and CRITICAL with evidence).
// Editing needs the FOOD_SAFETY permission (Access Control); viewing is open to the cold chain staff.
// Backend: /api/coldchain/food-safety (FoodSafetyController). Needs database_v2/96 (and 97 for the permission).
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, apiDownload, apiUpload } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input } from '@/shared/components/FormKit';
import { at, day, notReady, opts, send, who, words } from '@/modules/coldchain/records/records';
import { Pill, Tabs, Tiles } from '@/modules/coldchain/records/ui';
import { SCRIPT96 } from '@/modules/dispatch/schedule/schedule';
import { FS, certTone, hazardBody, limitText, needsEvidence, risk, riskLevel } from './foodSafety';

export function FoodSafetyPage() {
  const me = who();
  const [tab, setTab] = useState('PLANS');
  const [o, setO] = useState<any>(null), [data, setData] = useState<any>(null), [plan, setPlan] = useState<any>(null);
  const [form, setForm] = useState<any>(null), [site, setSite] = useState('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);

  useEffect(() => { api(`${FS}/options`).then(setO).catch(e => setErr(errorText(e, 'The options could not be read.'))); }, [reload]);
  useEffect(() => {
    if (!o?.ready) return;
    const fail = (e: unknown) => setErr(errorText(e, 'The list could not be read.'));
    const q = site ? `?warehouseId=${site}` : '';
    if (tab === 'PLANS') api(`${FS}/plans${q}`).then(setData).catch(fail);
    if (tab === 'CERTS') api(`${FS}/certifications${q}`).then(setData).catch(fail);
    if (tab === 'AUDITS') api(`${FS}/audits`).then(setData).catch(fail);
    if (plan?.id) api(`${FS}/plans/${plan.id}`).then(setPlan).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, tab, reload, site]);
  useEffect(() => { setForm(null); setPlan(null); setData(null); }, [tab]);

  if (notReady(o)) return <><h1 className="text-3xl font-bold">Food Safety</h1><NotReady script={o.script || SCRIPT96} /></>;

  const edit = !!o?.canEdit;
  async function run(fn: () => Promise<any>, after?: (x: any) => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(x); setReload(r => r + 1); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const openPlan = (id: number) => api(`${FS}/plans/${id}`).then(p => { setPlan(p); setForm(null); }).catch(e => setErr(errorText(e, 'The plan could not be read.')));
  const upload = (path: string, file?: File) => { if (file) void run(() => apiUpload(path, { file })); };
  const download = (path: string, name: string) => apiDownload(path, name).catch(e => setErr(errorText(e, 'The file could not be downloaded.')));
  const sites: [number, string][] = (o?.sites || []).map((s: any) => [s.id, s.name]);
  const sum = o?.summary || {};

  return <>
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldCheck />Food Safety</h1>
      <p className="text-slate-600">The HACCP plan of each site with its critical control points, and the certifications (FSSAI, BRCGS, HACCP, WHO-GDP, EIA) with their audits and findings.</p>
    </div>
    <Banner msg={msg} error={err} />
    <Tiles items={[['Approved plans', sum.approvedPlans ?? '-'], ['Sites without a plan', sum.sitesWithoutPlan ?? '-', sum.sitesWithoutPlan ? 'DUE_SOON' : undefined],
      ['Certificates due soon', sum.certsDueSoon ?? '-', sum.certsDueSoon ? 'DUE_SOON' : undefined], ['Open findings', sum.openFindings ?? '-'],
      ['Overdue findings', sum.overdueFindings ?? '-', sum.overdueFindings ? 'OVERDUE' : undefined], ['CCP checks out (7 days)', sum.checksOutLast7Days ?? '-', sum.checksOutLast7Days ? 'OUT_OF_RANGE' : undefined]]} />
    {!edit && <p className="mt-2 text-sm text-slate-500">You can view the food safety records. Changing them needs the Food Safety permission.</p>}
    <Tabs value={tab} onChange={setTab} tabs={[['PLANS', 'HACCP plans'], ['CERTS', 'Certifications'], ['AUDITS', 'Audits & findings']]} />
    {tab !== 'AUDITS' && <div className="mt-3 flex flex-wrap gap-2">
      <select className={`${input} w-60`} value={site} onChange={e => setSite(e.target.value)} aria-label="Site"><option value="">All sites</option>{sites.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      {edit && !plan && <button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : tab === 'PLANS' ? 'New HACCP plan' : 'Add a certification'}</button>}
    </div>}

    {tab === 'PLANS' && !plan && <>
      {form && <Section title="New HACCP plan"><QuickForm cols={3} busy={busy} submitText="Save draft" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${FS}/plans`, v), x => { setForm(null); if (x?.id) openPlan(x.id); })} fields={[
        { name: 'warehouseId', label: 'Site', type: 'select', options: sites, required: true }, { name: 'title', label: 'Title', required: true }, { name: 'reviewDue', label: 'Review due (blank: in a year)', type: 'date' },
        { name: 'scope', label: 'Scope (process steps covered)', type: 'textarea', wide: true }, { name: 'products', label: 'Products' }, { name: 'team', label: 'HACCP team' },
      ]} /></Section>}
      <Section title="Plans">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.length ? <p className="text-slate-500">No HACCP plan yet.</p> : <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Site</th><th>Plan</th><th>Version</th><th>Hazards / CCPs</th><th>Approved</th><th>Review due</th><th>Status</th></tr></thead>
          <tbody>{data.map((p: any) => <tr key={p.id} className="border-t align-top">
            <td className="p-2">{p.siteName}</td><td><button className="font-semibold text-sky-700 hover:underline" onClick={() => openPlan(p.id)}>{p.title}</button></td><td>v{p.version}</td>
            <td>{p.hazards} / {p.ccps}</td><td>{p.approvedAt ? <>{at(p.approvedAt)}<div className="text-xs">{p.approvedByName}</div></> : '-'}</td>
            <td>{day(p.reviewDue)}{p.reviewOverdue ? <div><Pill state="OVERDUE" text="Review overdue" /></div> : null}</td>
            <td><Pill state={p.status === 'APPROVED' ? 'OK' : p.status === 'DRAFT' ? 'DUE_SOON' : 'INACTIVE'} text={words(p.status)} /></td></tr>)}</tbody></table>}
      </Section>
    </>}

    {tab === 'PLANS' && plan && <PlanView plan={plan} edit={edit} manager={me.manager} busy={busy} run={run} onBack={() => setPlan(null)} />}

    {tab === 'CERTS' && <>
      {form && <Section title={form.id ? `Edit ${words(form.scheme)} ${form.certificateNo || ''}` : 'Add a certification'}><QuickForm cols={4} busy={busy} submitText="Save" initial={form} onCancel={() => setForm(null)}
        onSubmit={v => run(() => send(form.id ? `${FS}/certifications/${form.id}` : `${FS}/certifications`, v, form.id ? 'PUT' : 'POST'), () => setForm(null))} fields={[
          { name: 'warehouseId', label: 'Site', type: 'select', options: sites, required: true }, { name: 'scheme', label: 'Scheme', type: 'select', options: opts(o?.schemes || []), required: true },
          { name: 'certificateNo', label: 'Certificate / licence number' }, { name: 'certifyingBody', label: 'Certifying body' },
          { name: 'issuedOn', label: 'Issued on', type: 'date' }, { name: 'validUntil', label: 'Valid until', type: 'date' }, { name: 'nextAuditOn', label: 'Next audit', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: opts(['PLANNED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'WITHDRAWN']) },
          { name: 'ownerName', label: 'Owner' }, { name: 'remindDays', label: `Reminder days (blank: ${o?.remindDays})`, placeholder: '60,30,7' }, { name: 'scope', label: 'Scope', wide: true }, { name: 'notes', label: 'Notes', wide: true },
        ]} /></Section>}
      <Section title="Certifications">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.length ? <p className="text-slate-500">No certification yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Site</th><th>Scheme</th><th>Certificate</th><th>Valid until</th><th>Next audit</th><th>Last audit</th><th>Open findings</th><th>State</th><th>File</th><th /></tr></thead>
          <tbody>{data.map((c: any) => <tr key={c.id} className="border-t align-top">
            <td className="p-2">{c.siteName}</td><td className="font-semibold">{words(c.scheme)}</td><td>{c.certificateNo || '-'}<div className="text-xs text-slate-500">{c.certifyingBody || ''}</div></td>
            <td>{day(c.validUntil)}</td><td>{day(c.nextAuditOn)}{c.daysToAudit != null ? <div className="text-xs">{c.daysToAudit < 0 ? `${-c.daysToAudit} days late` : `in ${c.daysToAudit} days`}</div> : null}</td>
            <td>{day(c.lastAuditOn)}</td><td>{c.openFindings}</td><td><Pill state={certTone(c.state)} text={words(c.state)} /></td>
            <td>{c.fileId ? <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => download(`${FS}/certifications/${c.id}/certificate`, c.fileName || `Certificate_${c.id}.pdf`)}>Download</button> : '-'}
              {edit && <label className="ml-2 cursor-pointer text-xs font-bold text-sky-700 hover:underline">{c.fileId ? 'Replace' : 'Attach'}<input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => upload(`${FS}/certifications/${c.id}/certificate`, e.target.files?.[0])} /></label>}</td>
            <td>{edit && <button className={btnLight} onClick={() => setForm(c)}>Edit</button>}</td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'AUDITS' && <Audits data={data} o={o} edit={edit} busy={busy} run={run} upload={upload} download={download} />}
  </>;
}

function PlanView({ plan, edit, manager, busy, run, onBack }: { plan: any; edit: boolean; manager: boolean; busy: boolean; run: (fn: () => Promise<any>, after?: (x: any) => void) => Promise<any>; onBack: () => void }) {
  const [hz, setHz] = useState<any>(null), [check, setCheck] = useState<any>(null);
  const draft = plan.status === 'DRAFT';
  const ccps = (plan.hazards || []).filter((h: any) => h.isCcp);
  return <>
    <div className="mt-3 flex flex-wrap gap-2">
      <button className={btnLight} onClick={onBack}>Back to plans</button>
      {edit && draft && <button className={btn} onClick={() => setHz(hz ? null : { severity: 2, likelihood: 2 })}>{hz ? 'Cancel' : 'Add a hazard'}</button>}
      {manager && draft && <button className={btn} disabled={busy || !!plan.approvalProblems?.length} onClick={() => window.confirm('Approve this plan? The current approved version is superseded.') && run(() => send(`${FS}/plans/${plan.id}/approve`))}>Approve</button>}
      {edit && plan.status === 'APPROVED' && <button className={btnLight} disabled={busy} onClick={() => run(() => send(`${FS}/plans/${plan.id}/new-version`))}>Make a new version</button>}
      {plan.status === 'APPROVED' && ccps.length > 0 && <button className={btn} onClick={() => setCheck(check ? null : {})}>{check ? 'Cancel' : 'Record a CCP check'}</button>}
    </div>
    <Section title={`${plan.title} · v${plan.version}`} right={<Pill state={plan.status === 'APPROVED' ? 'OK' : plan.status === 'DRAFT' ? 'DUE_SOON' : 'INACTIVE'} text={words(plan.status)} />}>
      <div className="grid gap-2 text-sm md:grid-cols-3"><div><b>Site</b> {plan.siteName}<div><b>Products</b> {plan.products || '-'}</div></div>
        <div><b>Scope</b> {plan.scope || '-'}</div><div><b>Team</b> {plan.team || '-'}<div><b>Review due</b> {day(plan.reviewDue)}</div>{plan.approvedAt ? <div>Approved {at(plan.approvedAt)} by {plan.approvedByName}</div> : null}</div></div>
      {draft && !!plan.approvalProblems?.length && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Before it can be approved:</b><ul className="ml-5 list-disc">{plan.approvalProblems.map((p: string) => <li key={p}>{p}</li>)}</ul></div>}
    </Section>
    {hz && <Section title={hz.id ? `Edit step ${hz.processStep}` : 'Add a hazard'}><HazardForm initial={hz} busy={busy} onCancel={() => setHz(null)}
      onSubmit={b => run(() => send(hz.id ? `${FS}/plans/${plan.id}/hazards/${hz.id}` : `${FS}/plans/${plan.id}/hazards`, b, hz.id ? 'PUT' : 'POST'), () => setHz(null))} /></Section>}
    {check && <Section title="Record a CCP check"><QuickForm cols={3} busy={busy} submitText="Save check" onCancel={() => setCheck(null)} onSubmit={v => run(() => send(`${FS}/plans/${plan.id}/checks`, v), () => setCheck(null))} fields={[
      { name: 'hazardId', label: 'CCP', type: 'select', options: ccps.map((h: any) => [h.id, `${h.ccpCode} ${h.processStep} (${limitText(h)})`]), required: true },
      { name: 'value', label: 'Value measured', type: 'number' }, { name: 'withinLimit', label: 'Inside the limit (when no number)', type: 'checkbox' },
      { name: 'observation', label: 'Observation' }, { name: 'checkedBy', label: 'Checked by' }, { name: 'checkedAt', label: 'Checked at (blank: now)' },
      { name: 'correctiveAction', label: 'Corrective action (needed when outside the limit)', type: 'textarea', wide: true },
    ]} /></Section>}
    <Section title={`Hazard analysis (${plan.hazards?.length || 0})`}>
      {!plan.hazards?.length ? <p className="text-slate-500">No hazard yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">Step</th><th>Hazard</th><th>Risk</th><th>Control measure</th><th>CCP and limit</th><th>Monitoring</th><th>Corrective action</th><th /></tr></thead>
        <tbody>{plan.hazards.map((h: any) => <tr key={h.id} className="border-t align-top">
          <td className="p-2 font-semibold">{h.seq}. {h.processStep}</td><td>{words(h.hazardType)}<div className="max-w-xs text-xs">{h.hazard}</div></td>
          <td><Pill state={riskLevel(risk(h.severity, h.likelihood))} text={`${h.severity} x ${h.likelihood} = ${h.risk}`} /></td><td className="max-w-xs text-xs">{h.controlMeasure || '-'}</td>
          <td>{h.isCcp ? <><b>{h.ccpCode}</b><div className="text-xs">{limitText(h)}</div></> : 'No'}</td>
          <td className="max-w-xs text-xs">{h.monitoring || '-'}{h.monitoringFrequency ? <div>{h.monitoringFrequency}</div> : null}{h.responsible ? <div>{h.responsible}</div> : null}</td>
          <td className="max-w-xs text-xs">{h.correctiveAction || '-'}{h.problems?.length ? <div className="text-amber-700">{h.problems.join('; ')}</div> : null}</td>
          <td>{edit && draft && <><button className={btnLight} onClick={() => setHz(h)}>Edit</button>
            <button className={btnRed} disabled={busy} onClick={() => window.confirm('Remove this hazard?') && run(() => api(`${FS}/plans/${plan.id}/hazards/${h.id}`, { method: 'DELETE' }))}>Remove</button></>}</td></tr>)}</tbody></table></div>}
    </Section>
    {!!plan.checks?.length && <Section title="Latest CCP checks">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Checked</th><th>CCP</th><th>Value</th><th>Result</th><th>Corrective action</th><th>By</th></tr></thead>
        <tbody>{plan.checks.map((c: any) => <tr key={c.id} className="border-t"><td className="p-2">{at(c.checkedAt)}</td><td>{c.ccpCode} {c.processStep}</td><td>{c.value != null ? `${c.value} ${c.unit || ''}` : c.observation || '-'}</td>
          <td><Pill state={c.withinLimit ? 'OK' : 'OUT_OF_RANGE'} text={c.withinLimit ? 'Inside' : 'Outside'} /></td><td>{c.correctiveAction || '-'}</td><td>{c.checkedBy || '-'}</td></tr>)}</tbody></table>
    </Section>}
  </>;
}

function HazardForm({ initial, busy, onSubmit, onCancel }: { initial: any; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [sev, setSev] = useState(initial.severity), [lik, setLik] = useState(initial.likelihood);
  const r = risk(sev, lik);
  return <div onChange={e => { const t = e.target as HTMLSelectElement; if (t.name === 'severity') setSev(t.value); if (t.name === 'likelihood') setLik(t.value); }}>
    <p className="mb-2 text-sm">Risk: <Pill state={riskLevel(r)} text={r === null ? '-' : `${r} (${words(riskLevel(r))})`} /></p>
    <QuickForm cols={4} busy={busy} submitText="Save hazard" initial={initial} onCancel={onCancel} onSubmit={v => onSubmit(hazardBody(v))} fields={[
      { name: 'processStep', label: 'Process step', required: true }, { name: 'hazardType', label: 'Type', type: 'select', options: opts(['BIOLOGICAL', 'CHEMICAL', 'PHYSICAL', 'ALLERGEN']), required: true },
      { name: 'severity', label: 'Severity (1 low - 3 high)', type: 'select', options: [[1, '1'], [2, '2'], [3, '3']], required: true },
      { name: 'likelihood', label: 'Likelihood (1 - 3)', type: 'select', options: [[1, '1'], [2, '2'], [3, '3']], required: true },
      { name: 'hazard', label: 'Hazard', type: 'textarea', wide: true, required: true }, { name: 'controlMeasure', label: 'Control measure', wide: true },
      { name: 'isCcp', label: 'Critical control point', type: 'checkbox' }, { name: 'ccpCode', label: 'CCP number', placeholder: 'CCP-1' }, { name: 'criticalLimit', label: 'Critical limit (words)' },
      { name: 'limitMin', label: 'Lower limit', type: 'number' }, { name: 'limitMax', label: 'Upper limit', type: 'number' }, { name: 'limitUnit', label: 'Unit', placeholder: '°C' },
      { name: 'monitoring', label: 'Monitoring (what, how)' }, { name: 'monitoringFrequency', label: 'How often' }, { name: 'responsible', label: 'Who' },
      { name: 'correctiveAction', label: 'Corrective action', wide: true }, { name: 'verification', label: 'Verification' }, { name: 'records', label: 'Records kept' },
    ]} />
  </div>;
}

function Audits({ data, o, edit, busy, run, upload, download }: { data: any; o: any; edit: boolean; busy: boolean; run: (fn: () => Promise<any>, after?: (x: any) => void) => Promise<any>;
  upload: (path: string, file?: File) => void; download: (path: string, name: string) => void }) {
  const [form, setForm] = useState<any>(null), [certs, setCerts] = useState<any[]>([]);
  useEffect(() => { api(`${FS}/certifications`).then(x => setCerts(Array.isArray(x) ? x : [])).catch(() => setCerts([])); }, []);
  return <>
    {edit && <div className="mt-3"><button className={btn} onClick={() => setForm(form?.kind === 'PLAN' ? null : { kind: 'PLAN' })}>{form?.kind === 'PLAN' ? 'Cancel' : 'Plan an audit'}</button></div>}
    {form?.kind === 'PLAN' && <Section title="Plan an audit"><QuickForm cols={4} busy={busy} submitText="Save" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${FS}/audits`, v), () => setForm(null))} fields={[
      { name: 'certificationId', label: 'Certification', type: 'select', options: certs.map(c => [c.id, `${words(c.scheme)} ${c.siteName}`]), required: true },
      { name: 'auditType', label: 'Type', type: 'select', options: opts(o?.auditTypes || []), required: true }, { name: 'plannedOn', label: 'Planned on', type: 'date', required: true }, { name: 'auditor', label: 'Auditor' },
    ]} /></Section>}
    {form?.kind === 'RESULT' && <Section title={`Result of the ${words(form.audit.auditType)} audit`}><QuickForm cols={4} busy={busy} submitText="Save result" onCancel={() => setForm(null)}
      onSubmit={v => run(() => send(`${FS}/audits/${form.audit.id}/result`, v), () => setForm(null))} fields={[
        { name: 'doneOn', label: 'Done on', type: 'date', required: true }, { name: 'result', label: 'Result', type: 'select', options: opts(['PASSED', 'PASSED_WITH_FINDINGS', 'FAILED', 'CANCELLED']), required: true },
        { name: 'score', label: 'Score', type: 'number' }, { name: 'grade', label: 'Grade' }, { name: 'nextAuditOn', label: 'Next audit (blank: usual interval)', type: 'date' }, { name: 'validUntil', label: 'New valid until', type: 'date' },
        { name: 'notes', label: 'Notes', wide: true },
      ]} /></Section>}
    {form?.kind === 'FINDING' && <Section title="Add a finding"><QuickForm cols={4} busy={busy} submitText="Save finding" onCancel={() => setForm(null)}
      onSubmit={v => run(() => send(`${FS}/audits/${form.audit.id}/findings`, v), () => setForm(null))} fields={[
        { name: 'severity', label: 'Severity', type: 'select', options: opts(o?.severities || []), required: true }, { name: 'clause', label: 'Clause' },
        { name: 'dueOn', label: 'Due (blank: by severity)', type: 'date' }, { name: 'ownerName', label: 'Owner' }, { name: 'description', label: 'Finding', type: 'textarea', wide: true, required: true },
      ]} /></Section>}
    {form?.kind === 'CLOSE' && <Section title={`Close finding ${form.finding.refNo}`}><QuickForm cols={3} busy={busy} submitText="Close finding" onCancel={() => setForm(null)}
      onSubmit={v => run(() => send(`${FS}/findings/${form.finding.id}/close`, v), () => setForm(null))} fields={[
        { name: 'rootCause', label: 'Root cause', required: form.finding.severity !== 'OBSERVATION' }, { name: 'actionTaken', label: 'Action taken', required: true }, { name: 'closedOn', label: 'Closed on (blank: today)', type: 'date' },
      ]} />{needsEvidence(form.finding.severity) && !form.finding.evidenceFileId && <p className="mt-2 text-sm text-amber-700">Attach the evidence first: a {words(form.finding.severity).toLowerCase()} finding cannot close without it.</p>}</Section>}
    <Section title="Audits">
      {!data ? <p className="text-slate-500">Loading...</p> : !data.length ? <p className="text-slate-500">No audit yet.</p> : data.map((a: any) => <div key={a.id} className="mb-3 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><b>{words(a.scheme)}</b> · {a.siteName} · {words(a.auditType)} · planned {day(a.plannedOn)}{a.doneOn ? `, done ${day(a.doneOn)}` : ''}{a.auditor ? ` · ${a.auditor}` : ''}
            {a.score != null ? ` · score ${a.score}` : ''}{a.grade ? ` · grade ${a.grade}` : ''}</div>
          <div className="flex flex-wrap items-center gap-2">{a.result ? <Pill state={a.result === 'FAILED' ? 'FAIL' : a.result === 'CANCELLED' ? 'INACTIVE' : 'OK'} text={words(a.result)} /> : <Pill state="DUE_SOON" text="Planned" />}
            {a.reportFileId ? <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => download(`${FS}/audits/${a.id}/report`, a.reportFileName || `AuditReport_${a.id}.pdf`)}>Report</button> : null}
            {edit && <label className="cursor-pointer text-xs font-bold text-sky-700 hover:underline">{a.reportFileId ? 'Replace report' : 'Attach report'}<input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => upload(`${FS}/audits/${a.id}/report`, e.target.files?.[0])} /></label>}
            {edit && !a.result && <button className={btnLight} onClick={() => setForm({ kind: 'RESULT', audit: a })}>Record result</button>}
            {edit && <button className={btnLight} onClick={() => setForm({ kind: 'FINDING', audit: a })}>Add finding</button>}</div>
        </div>
        {!!a.findings?.length && <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Ref</th><th>Severity</th><th>Finding</th><th>Owner</th><th>Due</th><th>Status</th><th>Evidence</th><th /></tr></thead>
          <tbody>{a.findings.map((f: any) => <tr key={f.id} className="border-t align-top">
            <td className="p-2">{f.refNo}{f.clause ? <div className="text-xs">{f.clause}</div> : null}</td><td><Pill state={f.severity === 'CRITICAL' || f.severity === 'MAJOR' ? 'HIGH' : 'MEDIUM'} text={words(f.severity)} /></td>
            <td className="max-w-sm">{f.description}{f.status === 'CLOSED' ? <div className="text-xs text-slate-500">Root cause: {f.rootCause || '-'}. Action: {f.actionTaken}. Closed {day(f.closedOn)} by {f.closedByName}</div> : null}</td>
            <td>{f.ownerName || '-'}</td><td>{day(f.dueOn)}</td><td><Pill state={f.overdue ? 'OVERDUE' : f.status === 'OPEN' ? 'OPEN' : 'CLOSED'} text={f.overdue ? 'Overdue' : words(f.status)} /></td>
            <td>{f.evidenceFileId ? <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => download(`${FS}/findings/${f.id}/evidence`, `Evidence_${f.refNo}.pdf`)}>Download</button> : '-'}
              {edit && f.status === 'OPEN' && <label className="ml-2 cursor-pointer text-xs font-bold text-sky-700 hover:underline">Attach<input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e => upload(`${FS}/findings/${f.id}/evidence`, e.target.files?.[0])} /></label>}</td>
            <td>{edit && f.status === 'OPEN' && <button className={btnLight} onClick={() => setForm({ kind: 'CLOSE', finding: f })}>Close</button>}</td></tr>)}</tbody></table>}
      </div>)}
    </Section>
  </>;
}
