/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-013 -- Compliance Calendar: the monthly duties (TDS on the 7th, GSTR-1 on the 11th, PF and ESI on the
// 15th, GSTR-3B on the 20th, and any added by an Admin) together with the end dates of truck papers, licences,
// FSSAI licences and the Compliance Register. Each owner sees what is overdue, due and coming; a duty is marked
// done with a note. Reminders go to the RTO board.
// Backend: /api/gov/calendar (GovComplianceController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, STATE_TEXT, day, pill, when, words } from './gov';

const OWNERS = ['FINANCE', 'HR', 'OPERATIONS', 'WAREHOUSE', 'ADMIN'];

export function ComplianceCalendarPage() {
  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + '01'), [to, setTo] = useState(later), [owner, setOwner] = useState('');
  const [d, setD] = useState<any>(null), [doing, setDoing] = useState<any>(null), [rules, setRules] = useState<any[] | null>(null), [rule, setRule] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api(`/api/gov/calendar?from=${from}&to=${to}${owner ? `&owner=${owner}` : ''}`).then(setD).catch(e => setErr(errorText(e, 'The calendar could not be read')));
  useEffect(() => { void load(); }, [from, to, owner]);
  const loadRules = () => api('/api/gov/calendar/rules').then(setRules).catch(e => setErr(errorText(e, 'The dates could not be read')));

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done); await load(); return x ?? true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return null; } finally { setBusy(false); }
  }
  async function done(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get('note') || '');
    if (await run(() => api('/api/gov/calendar/done', { method: 'POST', body: JSON.stringify({ key: doing.key, dueDate: doing.dueDate, title: doing.title, owner: doing.owner, note }) }), 'Marked done')) setDoing(null);
  }
  async function saveRule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b: any = Object.fromEntries(f); b.active = f.get('active') === 'on';
    const code = String(rule.code || b.code || '').toUpperCase();
    const x = await run(() => api(`/api/gov/calendar/rules/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(b) }), 'Date saved');
    if (Array.isArray(x)) { setRules(x); setRule(null); }
  }
  async function resetRule(code: string) {
    const x = await run(() => api(`/api/gov/calendar/rules/${encodeURIComponent(code)}`, { method: 'DELETE' }), 'Back to the standard date');
    if (Array.isArray(x)) setRules(x);
  }

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">Compliance Calendar</h1><NotReady script={SCRIPT} /></>;
  const c = d?.counts || {};
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarCheck />Compliance Calendar</h1>
        <p className="text-slate-600">Statutory payments and returns, and the end dates of papers and licences, in one list.</p></div>
      <button className={btnLight} onClick={() => rules ? setRules(null) : loadRules()}>{rules ? 'Hide the monthly dates' : 'Monthly dates'}</button>
    </div>
    <Banner msg={msg} error={err} />
    <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
      {['OVERDUE', 'DUE', 'UPCOMING', 'DONE'].map(s => <div key={s} className="rounded-xl bg-white p-3 shadow-sm"><span className={pill(s)}>{STATE_TEXT[s]}</span><div className="mt-1 text-2xl font-bold">{Number(c[s] || 0)}</div></div>)}
    </div>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div><span className={label}>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} /></div>
      <div><span className={label}>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} /></div>
      <div><span className={label}>Owner</span><select value={owner} onChange={e => setOwner(e.target.value)} className={input}><option value="">Everyone</option>{OWNERS.map(o => <option key={o} value={o}>{words(o)}</option>)}</select></div>
    </div>

    {rules && <Section title="Monthly dates" right={d?.canEditRules && <button className={btnLight} onClick={() => setRule({ active: true })}>Add a duty</button>}>
      {rule && <form key={rule.code || 'new'} onSubmit={saveRule} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-6">
        <div><span className={label}>Code *</span><input name="code" required defaultValue={rule.code || ''} readOnly={!!rule.code} className={input} placeholder="PT" /></div>
        <div className="md:col-span-2"><span className={label}>Title *</span><input name="title" required defaultValue={rule.title || ''} className={input} placeholder="Professional tax" /></div>
        <div><span className={label}>Owner *</span><select name="owner" defaultValue={rule.owner || 'FINANCE'} className={input}>{OWNERS.map(o => <option key={o} value={o}>{words(o)}</option>)}</select></div>
        <div><span className={label}>Day of month *</span><input name="dayOfMonth" type="number" min="1" max="31" required defaultValue={rule.dayOfMonth ?? ''} className={input} /></div>
        <div><span className={label}>Months (blank = every)</span><input name="months" defaultValue={rule.months || ''} className={input} placeholder="4,7,10,1" /></div>
        <div className="md:col-span-4"><span className={label}>Detail</span><input name="detail" defaultValue={rule.detail || ''} className={input} /></div>
        <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={rule.active !== false} />In use</label>
        <div className="flex items-end gap-2"><button className={btn} disabled={busy}>Save</button><button type="button" className={btnLight} onClick={() => setRule(null)}>Cancel</button></div>
      </form>}
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Duty</th><th>Owner</th><th>Day</th><th>Months</th><th>In use</th><th /></tr></thead>
        <tbody>{rules.map(x => <tr key={x.code} className="border-t">
          <td className="p-2 font-semibold">{x.title}<div className="text-xs font-normal text-slate-500">{x.detail}</div></td><td>{words(x.owner)}</td>
          <td>{x.dayOfMonth}{x.standard && x.changed && Number(x.dayOfMonth) !== Number(x.standardDay) ? <span className="text-xs text-slate-500"> (standard {x.standardDay})</span> : null}</td>
          <td>{x.months || 'Every month'}</td><td>{x.active ? 'Yes' : 'No'}</td>
          <td className="whitespace-nowrap p-2">{d?.canEditRules && <><button className={btnLight} onClick={() => setRule(x)}>Edit</button>{x.changed && <> <button className={btnRed} disabled={busy} onClick={() => resetRule(x.code)}>{x.standard ? 'Standard date' : 'Remove'}</button></>}</>}</td>
        </tr>)}</tbody></table>
      {!d?.canEditRules && <p className="mt-2 text-xs text-slate-500">An Admin can change these dates.</p>}
    </Section>}

    {doing && <Section title={`Done: ${doing.title}`} right={<button className={btnLight} onClick={() => setDoing(null)}>Close</button>}>
      <form onSubmit={done} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-3"><span className={label}>Note (challan, ARN or receipt)</span><input name="note" className={input} placeholder="Paid, challan 02345 of 06-10-2026" /></div>
        <div className="flex items-end"><button className={btn} disabled={busy}>Mark done</button></div>
      </form>
    </Section>}

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!d ? <p className="text-slate-500">Loading...</p> : !d.items?.length ? <p className="text-slate-500">Nothing in this period.</p> :
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Due</th><th>What</th><th>Owner</th><th>From</th><th>State</th><th /></tr></thead>
          <tbody>{d.items.map((i: any) => <tr key={`${i.key}${i.dueDate}`} className="border-t align-top">
            <td className="whitespace-nowrap p-2 font-semibold">{day(i.dueDate)}{i.daysLeft != null && i.state !== 'DONE' ? <div className="text-xs font-normal text-slate-500">{i.daysLeft < 0 ? `${-i.daysLeft} days late` : i.daysLeft === 0 ? 'today' : `in ${i.daysLeft} days`}</div> : null}</td>
            <td>{i.link ? <Link to={i.link} className="font-semibold text-sky-700 hover:underline">{i.title}</Link> : <b>{i.title}</b>}<div className="text-xs text-slate-600">{i.detail}</div></td>
            <td>{words(i.owner)}</td><td className="text-xs">{i.source}</td>
            <td><span className={pill(i.state)}>{STATE_TEXT[i.state] || words(i.state)}</span>{i.doneAt ? <div className="text-xs text-slate-500">{i.doneByName}, {when(i.doneAt)}{i.doneNote ? `: ${i.doneNote}` : ''}</div> : null}</td>
            <td className="whitespace-nowrap p-2">{i.kind === 'STATUTORY' && i.state !== 'DONE' && <button className={btnLight} onClick={() => setDoing(i)}>Mark done</button>}
              {i.state === 'DONE' && d.canUndo && <button className={btnLight} disabled={busy} onClick={() => run(() => api(`/api/gov/calendar/done?key=${encodeURIComponent(i.key)}`, { method: 'DELETE' }), 'Done mark removed')}>Undo</button>}</td>
          </tr>)}</tbody>
        </table>}
    </section>
  </>;
}
