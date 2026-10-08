/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-010 -- Recruitment (permission HR_RECRUITMENT): HR writes job openings and publishes them on the Careers page
// of the website; candidates apply there with a resume; HR moves each application through the stages
// NEW, SCREENING, SHORTLISTED, INTERVIEW, OFFERED, HIRED (or REJECTED, WITHDRAWN) with a rating and notes.
// Backend: /api/hr/careers/** (RecruitmentController); the public side is /api/public/careers/** (website/careers).
import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, Download, ExternalLink, Star } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, NoAccess, Tabs, can, day, useMe, useRunner, when } from './hr';
import { TYPE_LABEL, experienceText } from '@/website/careers/careers';

export const CAREERS_SCRIPT = 'database_v2/82_careers_and_recruitment.sql (on reftech_hr)';
const STAGES = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];
const EMPTY = { title: '', department: '', location: '', employmentType: 'FULL_TIME', openings: 1, experienceMin: '', experienceMax: '', salaryText: '', summary: '', description: '', requirements: '', closesOn: '' };

export function RecruitmentPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('application') ? 'applications' : 'openings');
  const [opts, setOpts] = useState<any>(null);
  const [postings, setPostings] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [postingId, setPostingId] = useState(params.get('posting') || '');
  const [stage, setStage] = useState('');
  const [q, setQ] = useState('');
  const [apps, setApps] = useState<any[]>([]);
  const [pipe, setPipe] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<any | null>(null);
  const allowed = !!me && can(me, 'HR_RECRUITMENT');
  const ready = opts?.ready !== false;

  const loadPostings = async () => setPostings(await api('/api/hr/careers/postings'));
  const loadApps = async () => {
    const qs = new URLSearchParams();
    if (postingId) qs.set('postingId', postingId);
    if (stage) qs.set('status', stage);
    if (q.trim()) qs.set('q', q.trim());
    setApps(await api('/api/hr/careers/applications?' + qs));
    setPipe(await api('/api/hr/careers/pipeline' + (postingId ? '?postingId=' + postingId : '')));
  };
  const openApp = async (id: number | string) => setOpen(await api('/api/hr/careers/applications/' + id));
  const reloadAll = async () => { await loadPostings(); await loadApps(); if (open) await openApp(open.id); };
  const r = useRunner(reloadAll);

  useEffect(() => {
    if (!allowed) return;
    api('/api/hr/careers/options').then(o => {
      setOpts(o);
      if (o.ready === false) return;
      loadPostings().catch(e => r.setErr(e.message));
      const a = params.get('application');
      if (a) openApp(a).catch(e => r.setErr(e.message));
    }).catch(e => r.setErr(e.message));
  }, [allowed]);
  useEffect(() => { if (allowed && ready && opts) loadApps().catch(e => r.setErr(e.message)); }, [allowed, opts, postingId, stage]);

  if (me && !allowed) return <><h1 className="text-3xl font-bold">Recruitment</h1><NoAccess what="publish job openings or review applicants" /></>;
  if (opts && opts.ready === false) return <><h1 className="text-3xl font-bold">Recruitment</h1><NotReady script={CAREERS_SCRIPT} /></>;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    const x = await r.run(() => edit?.id ? api('/api/hr/careers/postings/' + edit.id, { method: 'PUT', body: JSON.stringify(body) })
      : api('/api/hr/careers/postings', { method: 'POST', body: JSON.stringify(body) }), edit?.id ? 'Opening saved' : 'Opening saved as a draft. Publish it to show it on the Careers page.');
    if (x) setEdit(null);
  }
  const setStatus = (p: any, status: string, ok: string) => {
    if (status === 'CLOSED' && !window.confirm(`Close "${p.title}"? It leaves the Careers page; the applications stay.`)) return;
    void r.run(() => api(`/api/hr/careers/postings/${p.id}/status`, { method: 'POST', body: JSON.stringify({ status }) }), ok);
  };
  const showApplicants = (p: any) => { setPostingId(String(p.id)); setStage(''); setTab('applications'); setParams({ posting: String(p.id) }); };

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><BriefcaseBusiness />Recruitment</h1>
    <p className="text-slate-600">Job openings on the <a href="/careers" target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">Careers page</a> of the website, and the applications that come in.
      Resumes: PDF, DOC or DOCX up to {opts?.resumeMaxMb || 5} MB.</p>
    <Banner msg={r.msg} error={r.err} />
    <Tabs value={tab} onChange={setTab} tabs={[['openings', `Openings (${postings.length})`], ['applications', 'Applications']]} />

    {tab === 'openings' && <>
      {!edit && <div className="mt-4"><button className={btn} onClick={() => setEdit({ ...EMPTY })}>New opening</button></div>}
      {edit && <Section title={edit.id ? `Change ${edit.code}` : 'New opening'}>
        <form key={edit.id || 'new'} onSubmit={save} className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2"><label className={label}>Job title *</label><input name="title" required maxLength={160} defaultValue={edit.title} className={input} /></div>
          <div><label className={label}>Department</label><input name="department" maxLength={80} defaultValue={edit.department || ''} className={input} placeholder="Operations, Warehouse ..." /></div>
          <div><label className={label}>Location *</label><input name="location" required maxLength={120} defaultValue={edit.location} className={input} /></div>
          <div><label className={label}>Type</label><select name="employmentType" defaultValue={edit.employmentType} className={input}>{(opts?.types || Object.keys(TYPE_LABEL)).map((t: string) => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}</select></div>
          <div><label className={label}>Number of positions</label><input name="openings" type="number" min={1} max={999} defaultValue={edit.openings} className={input} /></div>
          <div><label className={label}>Experience from (years)</label><input name="experienceMin" type="number" min={0} max={60} step="0.5" defaultValue={edit.experienceMin ?? ''} className={input} /></div>
          <div><label className={label}>Experience up to (years)</label><input name="experienceMax" type="number" min={0} max={60} step="0.5" defaultValue={edit.experienceMax ?? ''} className={input} /></div>
          <div><label className={label}>Apply by (closing date)</label><input name="closesOn" type="date" defaultValue={edit.closesOn || ''} className={input} /></div>
          <div className="md:col-span-3"><label className={label}>Salary shown on the website (optional)</label><input name="salaryText" maxLength={120} defaultValue={edit.salaryText || ''} className={input} placeholder="Rs 22,000 - 30,000 a month" /></div>
          <div className="md:col-span-3"><label className={label}>One-line summary (shown in the list)</label><input name="summary" maxLength={400} defaultValue={edit.summary || ''} className={input} /></div>
          <div className="md:col-span-3"><label className={label}>Job description * <span className="font-normal text-slate-500">(start a line with - for a bullet)</span></label><textarea name="description" required rows={6} defaultValue={edit.description} className={input} /></div>
          <div className="md:col-span-3"><label className={label}>What we look for (qualifications, licences, skills)</label><textarea name="requirements" rows={4} defaultValue={edit.requirements || ''} className={input} /></div>
          <div className="flex gap-2 md:col-span-3"><button disabled={r.busy} className={btn}>Save</button><button type="button" className={btnLight} onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      </Section>}
      <Section title="Openings">
        {postings.length === 0 ? <p className="text-slate-500">No openings yet. Press New opening to write the first one.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Opening</th><th className={th}>Place and type</th><th className={th}>Status</th><th className={th}>Applications</th><th className={th}>Apply by</th><th className={th}>Changed</th><th className={th}></th></tr></thead>
            <tbody>{postings.map(p => <tr key={p.id} className="border-t">
              <td className={td}><b>{p.title}</b><div className="text-xs text-slate-500">{p.code}{p.department && ` · ${p.department}`} · {p.openings} position{p.openings === 1 ? '' : 's'}</div></td>
              <td className={td}>{p.location}<div className="text-xs text-slate-500">{TYPE_LABEL[p.employmentType] || p.employmentType}{experienceText(p.experienceMin, p.experienceMax) && ` · ${experienceText(p.experienceMin, p.experienceMax)}`}</div></td>
              <td className={td}><Badge v={p.status} />{p.status === 'PUBLISHED' && !p.live && <div className="text-xs text-amber-700">closing date passed; not on the website</div>}{p.live && <div className="text-xs text-emerald-700">on the website</div>}</td>
              <td className={td}><button className="font-semibold text-sky-700 underline" onClick={() => showApplicants(p)}>{p.applications}</button>{p.newApplications > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">{p.newApplications} new</span>}{p.hired > 0 && <div className="text-xs text-emerald-700">{p.hired} hired</div>}</td>
              <td className={td}>{p.closesOn ? day(p.closesOn) : '-'}</td>
              <td className={td}>{p.updatedBy || p.createdBy || '-'}<div className="text-xs text-slate-500">{when(p.updatedAt)}</div></td>
              <td className={td}><div className="flex flex-wrap gap-1">
                <button className={btnLight} disabled={r.busy} onClick={() => { setEdit(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Change</button>
                {p.status !== 'PUBLISHED' && <button className={btnLight} disabled={r.busy} onClick={() => setStatus(p, 'PUBLISHED', 'Published: it is on the Careers page now')}>Publish</button>}
                {p.status === 'PUBLISHED' && <button className={btnRed} disabled={r.busy} onClick={() => setStatus(p, 'CLOSED', 'Closed: it is no longer on the Careers page')}>Close</button>}
                {p.status === 'PUBLISHED' && <button className={btnLight} disabled={r.busy} onClick={() => setStatus(p, 'DRAFT', 'Back to draft: hidden from the Careers page')}>Unpublish</button>}
                {p.live && <a className={`${btnLight} inline-flex items-center gap-1`} href={`/careers/${p.id}`} target="_blank" rel="noreferrer">View<ExternalLink className="h-3.5 w-3.5" /></a>}
              </div></td>
            </tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'applications' && <>
      <div className="mt-4 flex flex-wrap gap-2">
        {STAGES.map(s => <button key={s} onClick={() => setStage(stage === s ? '' : s)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold shadow-sm ${stage === s ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
          {s.charAt(0) + s.slice(1).toLowerCase()} <span className="opacity-70">{pipe[s] ?? 0}</span></button>)}
      </div>
      <Section title="Applications" right={<form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void loadApps().catch(x => r.setErr(x.message)); }}>
        <select value={postingId} onChange={e => setPostingId(e.target.value)} className={input + ' !w-auto'}><option value="">All openings</option>{postings.map(p => <option key={p.id} value={p.id}>{p.title} ({p.code})</option>)}</select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, email, phone, reference" className={input + ' !w-56'} />
        <button className={btnLight}>Search</button></form>}>
        {apps.length === 0 ? <p className="text-slate-500">No applications{stage && ` at the stage ${stage.toLowerCase()}`}.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Candidate</th><th className={th}>Opening</th><th className={th}>Experience</th><th className={th}>Stage</th><th className={th}>Rating</th><th className={th}>Applied</th><th className={th}></th></tr></thead>
            <tbody>{apps.map(a => <tr key={a.id} className={`border-t ${open?.id === a.id ? 'bg-sky-50' : ''}`}>
              <td className={td}><b>{a.fullName}</b><div className="text-xs text-slate-500">{a.reference} · {a.email} · {a.phone}{a.city && ` · ${a.city}`}</div></td>
              <td className={td}>{a.postingTitle}<div className="text-xs text-slate-500">{a.postingCode}</div></td>
              <td className={td}>{a.experienceYears != null ? `${a.experienceYears} yr` : '-'}{a.currentCompany && <div className="text-xs text-slate-500">{a.currentCompany}</div>}{a.noticeDays != null && <div className="text-xs text-slate-500">notice {a.noticeDays} d</div>}</td>
              <td className={td}><Badge v={a.status} /></td>
              <td className={td}><Stars n={a.rating} /></td>
              <td className={td}>{when(a.appliedAt)}</td>
              <td className={td}><div className="flex gap-1"><button className={btnLight} onClick={() => openApp(a.id).catch(e => r.setErr(e.message))}>Open</button>
                {a.hasResume && <button className={btnLight} title="Download the resume" onClick={() => apiDownload(`/api/hr/careers/applications/${a.id}/resume`, a.resumeName || `${a.reference}-resume`).catch(e => r.setErr(e.message))}><Download className="h-4 w-4" /></button>}</div></td>
            </tr>)}</tbody></table></div>}
      </Section>
      {open && <ApplicationPanel a={open} busy={r.busy} onClose={() => { setOpen(null); setParams({}); }}
        onReview={(body) => r.run(() => api(`/api/hr/careers/applications/${open.id}/review`, { method: 'POST', body: JSON.stringify(body) }), 'Saved')}
        onErase={(reason) => r.run(() => api(`/api/hr/careers/applications/${open.id}/erase`, { method: 'POST', body: JSON.stringify({ reason }) }), 'The candidate\'s details and resume were erased')}
        onResume={() => apiDownload(`/api/hr/careers/applications/${open.id}/resume`, open.resumeName || `${open.reference}-resume`).catch(e => r.setErr(e.message))} />}
    </>}
  </>;
}

function Stars({ n }: { n?: number | null }) {
  if (!n) return <span className="text-slate-400">-</span>;
  return <span className="inline-flex text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-4 w-4 ${i < n ? 'fill-amber-400' : 'opacity-30'}`} />)}</span>;
}

function ApplicationPanel({ a, busy, onClose, onReview, onErase, onResume }: {
  a: any; busy: boolean; onClose: () => void; onReview: (b: any) => Promise<any>; onErase: (reason: string) => Promise<any>; onResume: () => void;
}) {
  const erased = !!a.erasedAt;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await onReview({ status: f.get('status'), rating: f.get('rating') || null, note: f.get('note') || null });
    if (ok) (e.target as HTMLFormElement).reset();
  }
  return <Section title={<>{a.fullName} <span className="text-base font-normal text-slate-500">{a.reference}</span></>} right={<button className={btnLight} onClick={onClose}>Close</button>}>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1 text-sm">
        <div>Applied for <b>{a.postingTitle}</b> ({a.postingCode}) on {when(a.appliedAt)}</div>
        <div>Stage <Badge v={a.status} /> <Stars n={a.rating} /></div>
        {!erased && <>
          <div>Email <a className="text-sky-700 underline" href={`mailto:${a.email}`}>{a.email}</a> · Mobile <a className="text-sky-700 underline" href={`tel:${a.phone}`}>{a.phone}</a></div>
          <div>{a.city && <>City {a.city} · </>}Experience {a.experienceYears != null ? `${a.experienceYears} years` : '-'}{a.currentCompany && <> at {a.currentCompany}</>}</div>
          <div>Notice period {a.noticeDays != null ? `${a.noticeDays} days` : '-'} · Expected salary {a.expectedSalary || '-'}</div>
          {a.coverNote && <div className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-3">{a.coverNote}</div>}
          <div className="text-xs text-slate-500">Consent given {when(a.consentAt)}</div>
          {a.hasResume && <button className={`${btn} mt-2 inline-flex items-center gap-2`} onClick={onResume}><Download className="h-4 w-4" />Resume ({a.resumeName})</button>}
        </>}
        {erased && <div className="rounded-xl bg-slate-100 p-3 text-slate-700">The candidate's details and resume were erased on {day(a.erasedAt)}.</div>}
      </div>
      {!erased && <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Move to stage</label><select name="status" defaultValue={a.status} className={input}>{STAGES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select></div>
          <div><label className={label}>Rating</label><select name="rating" defaultValue="" className={input}><option value="">{a.rating ? `Keep ${a.rating}` : 'None'}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}</select></div>
        </div>
        <div><label className={label}>Note (needed when rejecting)</label><textarea name="note" rows={3} className={input} placeholder="Interview on 12 Oct at 11:00, driving test passed ..." /></div>
        <div className="flex flex-wrap gap-2"><button disabled={busy} className={btn}>Save</button>
          <button type="button" disabled={busy} className={btnRed} onClick={() => { const why = window.prompt('Erase this candidate\'s details and resume for good? Write the reason (for example: the candidate asked).'); if (why) void onErase(why); }}>Erase personal data</button></div>
      </form>}
    </div>
    <h3 className="mt-4 font-bold">History</h3>
    <table className="mt-1 w-full text-sm"><tbody>{(a.history || []).map((h: any, i: number) => <tr key={i} className="border-t">
      <td className={td}>{when(h.at)}</td><td className={td}>{h.by}</td>
      <td className={td}>{h.to ? <>{h.from ? <><Badge v={h.from} /> → </> : null}<Badge v={h.to} /></> : null}{h.rating ? <span className="ml-2"><Stars n={h.rating} /></span> : null}</td>
      <td className={td}>{h.note}</td></tr>)}</tbody></table>
  </Section>;
}
