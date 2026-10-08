/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-010 -- the Careers pages of the website (no login): /careers lists the open positions HR published,
// /careers/:id shows one with its Apply form (details + resume upload).
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Briefcase, CalendarDays, CheckCircle2, Clock, MapPin, Search, Upload, Users } from 'lucide-react';
import { Navbar } from '@/website/Navbar';
import { Footer } from '@/website/Footer';
import { apply, blocks, experienceText, getOpening, listOpenings, Opening, RESUME_TYPES, resumeProblem, TYPE_LABEL } from '@/website/careers/careers';

function Shell({ children }: { children: ReactNode }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return <div className="min-h-screen bg-white"><Navbar/><main className="pt-24">{children}</main><Footer/></div>;
}

function Banner({ title, sub }: { title: ReactNode; sub: ReactNode }) {
  return <section className="bg-gradient-to-br from-frost-950 via-deep-900 to-frost-900 px-5 py-14 text-white md:px-10 lg:px-16">
    <div className="mx-auto max-w-5xl">
      <span className="heading-eyebrow text-frost-300"><span className="h-px w-8 bg-frost-400"/>Careers</span>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
      <div className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">{sub}</div>
    </div>
  </section>;
}

function Facts({ o }: { o: Opening }) {
  const exp = experienceText(o.experienceMin, o.experienceMax);
  return <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-frost-600"/>{o.location}</span>
    <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-frost-600"/>{TYPE_LABEL[o.employmentType] || o.employmentType}</span>
    {exp && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-frost-600"/>{exp}</span>}
    {o.openings > 1 && <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-frost-600"/>{o.openings} positions</span>}
    {o.closesOn && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-frost-600"/>Apply by {new Date(o.closesOn + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
  </div>;
}

/** /careers */
export function CareersListPage() {
  const [rows, setRows] = useState<Opening[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [loc, setLoc] = useState('');
  useEffect(() => { document.title = 'Careers | RefTech'; listOpenings().then(setRows).catch(e => { setErr(e.message); setRows([]); }); }, []);
  const depts = useMemo(() => [...new Set((rows || []).map(r => r.department).filter(Boolean) as string[])].sort(), [rows]);
  const locs = useMemo(() => [...new Set((rows || []).map(r => r.location).filter(Boolean))].sort(), [rows]);
  const shown = (rows || []).filter(r => (!dept || r.department === dept) && (!loc || r.location === loc)
    && (!q.trim() || `${r.title} ${r.department || ''} ${r.location} ${r.summary || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const sel = 'rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800';

  return <Shell>
    <Banner title={<>Build the <span className="gradient-text">cold chain</span> with us</>}
      sub="We move food, dairy and medicines that must stay cold. Join our drivers, warehouse teams and office staff. See the open positions below and apply in a few minutes with your resume."/>
    <section className="mx-auto max-w-5xl px-5 py-10 md:px-10">
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by job title or place" className={`${sel} w-full pl-9`} aria-label="Search openings"/></label>
        {depts.length > 1 && <select value={dept} onChange={e => setDept(e.target.value)} className={sel} aria-label="Department"><option value="">All departments</option>{depts.map(d => <option key={d}>{d}</option>)}</select>}
        {locs.length > 1 && <select value={loc} onChange={e => setLoc(e.target.value)} className={sel} aria-label="Location"><option value="">All locations</option>{locs.map(d => <option key={d}>{d}</option>)}</select>}
      </div>
      {rows === null && <p className="mt-8 text-slate-500">Loading the open positions…</p>}
      {err && <p className="mt-8 rounded-xl bg-amber-50 p-4 text-amber-900">The open positions could not be loaded right now. Please try again later.</p>}
      {rows !== null && !err && rows.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
        <p className="font-display text-xl font-bold text-deep-900">No openings right now</p>
        <p className="mt-2 text-slate-600">New positions are posted here first. Please check again soon, or write to us from the <a className="font-semibold text-frost-700 underline" href="/#contact">Contact</a> section.</p>
      </div>}
      {rows !== null && rows.length > 0 && <p className="mt-6 text-sm text-slate-500">{shown.length} of {rows.length} open position{rows.length === 1 ? '' : 's'}</p>}
      <ul className="mt-3 space-y-4">
        {shown.map(o => <li key={o.id}>
          <Link to={`/careers/${o.id}`} className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-frost-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-deep-900 group-hover:text-frost-700">{o.title}</h2>
                {o.department && <p className="text-sm font-semibold text-frost-700">{o.department}</p>}
              </div>
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-frost-600 px-4 py-2 text-xs font-bold text-white group-hover:bg-frost-700 sm:flex">View & apply<ArrowRight className="h-3.5 w-3.5"/></span>
            </div>
            {o.summary && <p className="mt-2 text-slate-700">{o.summary}</p>}
            <div className="mt-3"><Facts o={o}/></div>
            {o.salaryText && <p className="mt-2 text-sm font-semibold text-emerald-700">{o.salaryText}</p>}
          </Link>
        </li>)}
      </ul>
    </section>
  </Shell>;
}

/** /careers/:id */
export function CareerJobPage() {
  const { id } = useParams();
  const [o, setO] = useState<Opening | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    getOpening(id || '').then(x => { setO(x); document.title = `${x.title} | Careers | RefTech`; }).catch(e => setErr(e.message || 'This opening is no longer open'));
  }, [id]);

  return <Shell>
    {!o && <section className="mx-auto max-w-5xl px-5 py-16 md:px-10">
      {err ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
        <p className="font-display text-xl font-bold text-deep-900">{err}</p>
        <Link to="/careers" className="mt-4 inline-flex items-center gap-1.5 font-semibold text-frost-700 underline"><ArrowLeft className="h-4 w-4"/>See all open positions</Link>
      </div> : <p className="text-slate-500">Loading…</p>}
    </section>}
    {o && <>
      <Banner title={o.title} sub={<><div className="mb-3"><Link to="/careers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-frost-300 hover:text-white"><ArrowLeft className="h-4 w-4"/>All open positions</Link></div>
        <div className="[&_*]:!text-white/80 [&_svg]:!text-frost-300"><Facts o={o}/></div></>}/>
      <section className="mx-auto grid max-w-5xl gap-10 px-5 py-10 md:px-10 lg:grid-cols-5">
        <article className="lg:col-span-3">
          {o.department && <p className="text-sm font-semibold uppercase tracking-wide text-frost-700">{o.department} · {o.code}</p>}
          {o.salaryText && <p className="mt-2 font-semibold text-emerald-700">{o.salaryText}</p>}
          <h2 className="mt-6 font-display text-xl font-bold text-deep-900">About the job</h2>
          <Text text={o.description}/>
          {o.requirements && <><h2 className="mt-8 font-display text-xl font-bold text-deep-900">What we look for</h2><Text text={o.requirements}/></>}
        </article>
        <aside className="lg:col-span-2"><ApplyForm o={o}/></aside>
      </section>
    </>}
  </Shell>;
}

function Text({ text }: { text?: string | null }) {
  return <div className="mt-3 space-y-3 leading-relaxed text-slate-700">
    {blocks(text).map((b, i) => b.list
      ? <ul key={i} className="list-disc space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
      : <p key={i}>{b.lines.join(' ')}</p>)}
  </div>;
}

function ApplyForm({ o }: { o: Opening }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const maxMb = o.resumeMaxMb || 5;
  const inp = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-frost-500 focus:ring-2 focus:ring-frost-100';
  const lab = 'mb-1 block text-sm font-semibold text-slate-700';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const problem = resumeProblem(file, maxMb);
    if (problem) { setErr(problem); return; }
    fd.set('resume', file as File);
    fd.set('formToken', o.formToken || '');
    fd.set('consent', fd.get('consent') ? 'true' : 'false');
    setBusy(true); setErr('');
    try { setDone(await apply(o.id, fd)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (x) { setErr(x instanceof Error && x.message ? x.message : 'Your application could not be sent. Please try again.'); }
    finally { setBusy(false); }
  }

  if (done) return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
    <CheckCircle2 className="h-8 w-8 text-emerald-600"/>
    <h2 className="mt-3 font-display text-xl font-bold text-emerald-900">Application sent</h2>
    <p className="mt-2 text-emerald-900">{done.message}</p>
    <p className="mt-3 text-sm text-emerald-800">Keep the reference <b>{done.reference}</b>. Our HR team will contact you by phone or email if your profile matches.</p>
    <Link to="/careers" className="mt-5 inline-flex items-center gap-1.5 font-semibold text-emerald-800 underline">See other open positions<ArrowRight className="h-4 w-4"/></Link>
  </div>;

  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm lg:sticky lg:top-24" noValidate={false}>
    <h2 className="font-display text-xl font-bold text-deep-900">Apply for this job</h2>
    <p className="mt-1 text-sm text-slate-600">No account needed. Fields marked * are required.</p>
    <div className="mt-4 space-y-3">
      <div><label className={lab} htmlFor="c-name">Full name *</label><input id="c-name" name="fullName" required maxLength={160} autoComplete="name" className={inp}/></div>
      <div><label className={lab} htmlFor="c-email">Email *</label><input id="c-email" name="email" type="email" required maxLength={160} autoComplete="email" className={inp}/></div>
      <div><label className={lab} htmlFor="c-phone">Mobile number *</label><input id="c-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel" placeholder="98765 43210" className={inp}/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lab} htmlFor="c-city">City</label><input id="c-city" name="city" maxLength={80} autoComplete="address-level2" className={inp}/></div>
        <div><label className={lab} htmlFor="c-exp">Experience (years)</label><input id="c-exp" name="experienceYears" type="number" min={0} max={60} step="0.5" className={inp}/></div>
      </div>
      <div><label className={lab} htmlFor="c-company">Current or last employer</label><input id="c-company" name="currentCompany" maxLength={160} className={inp}/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lab} htmlFor="c-notice">Notice period (days)</label><input id="c-notice" name="noticeDays" type="number" min={0} max={365} className={inp}/></div>
        <div><label className={lab} htmlFor="c-salary">Expected salary</label><input id="c-salary" name="expectedSalary" maxLength={60} className={inp}/></div>
      </div>
      <div><label className={lab} htmlFor="c-note">Why are you a good fit? (optional)</label><textarea id="c-note" name="coverNote" rows={3} maxLength={3000} className={inp}/></div>
      <div>
        <span className={lab}>Resume * <span className="font-normal text-slate-500">(PDF, DOC or DOCX, up to {maxMb} MB)</span></span>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 hover:border-frost-400">
          <Upload className="h-5 w-5 shrink-0 text-frost-600"/>
          <span className="truncate text-sm text-slate-700">{file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : 'Choose your resume file'}</span>
          <input type="file" accept={RESUME_TYPES} className="sr-only" aria-label="Resume" onChange={e => { const f = e.target.files?.[0] || null; setFile(f); setErr(f ? resumeProblem(f, maxMb) : ''); }}/>
        </label>
      </div>
      {/* Spam trap: people never see this field; a robot that fills it in is refused. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
      <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" name="consent" required className="mt-1"/>
        <span>I agree that RefTech may keep my details and resume to consider me for this and similar openings, and may contact me about them. *</span></label>
    </div>
    {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
    <button disabled={busy} className="btn-primary mt-4 w-full justify-center disabled:opacity-60">{busy ? 'Sending…' : 'Send application'}</button>
  </form>;
}

/** The home page band that leads to the Careers page (shows how many positions are open). */
export function CareersTeaser() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { listOpenings().then(r => setN(r.length)).catch(() => setN(null)); }, []);
  return <section id="careers" className="bg-gradient-to-r from-frost-50 via-white to-ice-50 px-5 py-14 md:px-10 lg:px-16">
    <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
      <div>
        <span className="heading-eyebrow text-frost-700"><span className="h-px w-8 bg-frost-500"/>Careers</span>
        <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-deep-900 md:text-3xl">Work with RefTech</h2>
        <p className="mt-2 max-w-xl text-slate-600">{n ? `We are hiring: ${n} open position${n === 1 ? '' : 's'} for drivers, warehouse teams and office staff.` : 'Drivers, warehouse teams and office staff keep our cold chain running. See our open positions and apply online.'}</p>
      </div>
      <Link to="/careers" className="btn-primary shrink-0">{n ? 'See open positions' : 'Visit Careers'}<ArrowRight className="h-4 w-4"/></Link>
    </div>
  </section>;
}
