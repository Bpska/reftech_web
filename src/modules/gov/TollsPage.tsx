/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-002, 003, 004 -- Tolls and FASTag. Four tabs:
//   FASTag     every truck's tag: status (active, inactive, blacklisted), balance and the low-balance limit.
//   Routes     the toll plazas and the plazas expected on each lane, typed in or learned from past trips.
//   Statement  import the bank's FASTag statement (CSV or Excel): each debit is matched to a trip; what does not
//              match (no trip, charged twice, wrong class, not our truck) is checked here.
//   Report     tolls by trip, lane or truck for a period, with the amount to claim back; Excel.
// Backend: /api/gov/fastag, /api/gov/toll/** (GovTollController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, day, pill, providerNote, role, rupees, sourceText, upload, when, words } from './gov';
import { fmtDistance } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const TABS: [string, string][] = [['fastag', 'FASTag'], ['routes', 'Toll routes'], ['statement', 'Bank statement'], ['report', 'Report']];

export function TollsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'fastag';
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [notReady, setNotReady] = useState(false);
  const ctx = { setMsg, setErr, setNotReady };
  if (notReady) return <><h1 className="text-3xl font-bold">Tolls and FASTag</h1><NotReady script={SCRIPT} /></>;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Receipt />Tolls and FASTag</h1>
    <p className="text-slate-600">FASTag of every truck, the toll plazas of each lane, the bank statement and the toll report.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {TABS.map(([k, t]) => <button key={k} onClick={() => { setParams({ tab: k }); setMsg(''); setErr(''); }}
        className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}
    </div>
    <Banner msg={msg} error={err} />
    {tab === 'fastag' && <TagsTab {...ctx} />}
    {tab === 'routes' && <RoutesTab {...ctx} />}
    {tab === 'statement' && <StatementTab {...ctx} />}
    {tab === 'report' && <ReportTab {...ctx} />}
  </>;
}

type Ctx = { setMsg: (s: string) => void; setErr: (s: string) => void; setNotReady: (b: boolean) => void };

function useRun({ setMsg, setErr }: Ctx) {
  const [busy, setBusy] = useState(false);
  async function run<T>(fn: () => Promise<T>, done?: (x: T) => string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done ? done(x) : 'Saved'); return x; }
    catch (e) { setErr(errorText(e, 'Not saved')); return null; } finally { setBusy(false); }
  }
  return { busy, run };
}

// ------------------------------------------------------------------ FASTag

function TagsTab(ctx: Ctx) {
  const [d, setD] = useState<any>(null), [edit, setEdit] = useState<any>(null);
  const { busy, run } = useRun(ctx);
  const load = () => api('/api/gov/fastag').then(x => { if (x.ready === false) ctx.setNotReady(true); setD(x); }).catch(e => ctx.setErr(errorText(e, 'The tags could not be read')));
  useEffect(() => { void load(); }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    if (await run(() => api(`/api/gov/fastag/${edit.vehicleId}`, { method: 'PUT', body: JSON.stringify(b) }))) { setEdit(null); await load(); }
  }
  const check = async (vid: number) => { if (await run(() => api(`/api/gov/fastag/${vid}/check`, { method: 'POST' }), () => 'Tag checked')) await load(); };
  if (!d) return <p className="mt-4 text-slate-500">Loading...</p>;
  return <>
    {providerNote(d.provider, 'FASTag') && <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">{providerNote(d.provider, 'FASTag')}</p>}
    {edit && <Section title={`FASTag of ${edit.vehicleNumber}`} right={<button className={btnLight} onClick={() => setEdit(null)}>Close</button>}>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
        <div><span className={label}>Tag number</span><input name="tagId" defaultValue={edit.tagId || ''} className={input} /></div>
        <div><span className={label}>Bank</span><input name="issuerBank" defaultValue={edit.issuerBank || ''} className={input} placeholder="ICICI Bank" /></div>
        <div><span className={label}>Vehicle class</span><input name="vehicleClass" defaultValue={edit.vehicleClass || ''} className={input} placeholder="VC7" /></div>
        <div><span className={label}>Tag status</span><select name="tagStatus" defaultValue={edit.tagStatus || 'UNKNOWN'} className={input}>
          {['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'UNKNOWN'].map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
        <div><span className={label}>Balance (₹)</span><input name="balance" type="number" step="0.01" defaultValue={edit.balance ?? ''} className={input} /></div>
        <div><span className={label}>Low-balance limit (₹)</span><input name="lowBalanceLimit" type="number" step="1" min="0" defaultValue={edit.lowBalanceLimit ?? d.defaultLimit} className={input} /></div>
        <div className="md:col-span-3"><button className={btn} disabled={busy}>Save</button></div>
      </form>
    </Section>}
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-left"><th className="p-2">Truck</th><th>Tag</th><th>Bank</th><th>Class</th><th>Status</th><th>Balance</th><th>Limit</th><th>Checked</th><th /></tr></thead>
        <tbody>{d.tags.map((g: any) => <tr key={g.vehicleId} className={`border-t align-top ${g.problem || g.lowBalance ? 'bg-red-50/40' : ''}`}>
          <td className="p-2 font-semibold">{g.vehicleNumber}</td><td className="font-mono text-xs">{g.tagId || <span className="text-slate-400">not recorded</span>}</td>
          <td>{g.issuerBank || '-'}</td><td>{g.vehicleClass || '-'}</td>
          <td><span className={pill(g.tagStatus)}>{words(g.tagStatus)}</span>{g.statusSource ? <div className="text-xs text-slate-500">{sourceText(g.statusSource)}</div> : null}</td>
          <td className={g.lowBalance ? 'font-bold text-red-700' : ''}>{rupees(g.balance)}{g.balanceAt ? <div className="text-xs font-normal text-slate-500">{when(g.balanceAt)}</div> : null}</td>
          <td>{rupees(g.lowBalanceLimit)}</td>
          <td className="whitespace-nowrap text-xs">{g.statusCheckedAt ? when(g.statusCheckedAt) : '-'}</td>
          <td className="whitespace-nowrap p-2"><button className={btnLight} onClick={() => setEdit(g)}>Edit</button> <button className={btnLight} disabled={busy || !d.connected} title={d.connected ? '' : 'FASTag is not connected'} onClick={() => check(g.vehicleId)}>Check</button></td>
        </tr>)}</tbody>
      </table>
    </section>
  </>;
}

// ------------------------------------------------------------------ plazas and routes

function RoutesTab(ctx: Ctx) {
  const [plazas, setPlazas] = useState<any[]>([]), [d, setD] = useState<any>(null), [route, setRoute] = useState<any>(null), [plaza, setPlaza] = useState<any>(null);
  const { busy, run } = useRun(ctx);
  const r = role();
  const load = () => Promise.all([api('/api/gov/toll/routes'), api('/api/gov/toll/plazas')])
    .then(([x, p]) => { if (x.ready === false) ctx.setNotReady(true); setD(x); setPlazas(p.plazas || []); })
    .catch(e => ctx.setErr(errorText(e, 'The routes could not be read')));
  useEffect(() => { void load(); }, []);
  const openRoute = (id: number) => api(`/api/gov/toll/routes/${id}`).then(x => setRoute({ ...x, plazas: x.plazas || [] })).catch(e => ctx.setErr(errorText(e, 'The route could not be read')));

  async function savePlaza(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b: any = Object.fromEntries(f); b.onFastag = f.get('onFastag') === 'on'; b.active = f.get('active') === 'on';
    if (await run(() => api(plaza.id ? `/api/gov/toll/plazas/${plaza.id}` : '/api/gov/toll/plazas', { method: plaza.id ? 'PUT' : 'POST', body: JSON.stringify(b) }))) { setPlaza(null); await load(); }
  }
  async function saveRoute(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(e.currentTarget));
    b.plazas = route.plazas.map((p: any) => ({ plazaId: p.plazaId, expectedAmount: p.expectedAmount, learned: p.learned }));
    const x: any = await run(() => api(route.id ? `/api/gov/toll/routes/${route.id}` : '/api/gov/toll/routes', { method: route.id ? 'PUT' : 'POST', body: JSON.stringify(b) }));
    if (x) { setRoute({ ...x, plazas: x.plazas || [] }); await load(); }
  }
  async function learn() {
    const x: any = await run(() => api(`/api/gov/toll/routes/${route.id}/learn`, { method: 'POST' }), (y: any) => y.message || 'Learned');
    if (x) { await openRoute(route.id); await load(); }
  }
  async function remove() {
    if (!window.confirm('Remove this toll route?')) return;
    if (await run(() => api(`/api/gov/toll/routes/${route.id}`, { method: 'DELETE' }), () => 'Route removed')) { setRoute(null); await load(); }
  }
  const setPlazas2 = (list: any[]) => setRoute({ ...route, plazas: list });
  const move = (i: number, by: number) => { const l = [...route.plazas]; const j = i + by; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setPlazas2(l); };

  if (!d) return <p className="mt-4 text-slate-500">Loading...</p>;
  return <>
    <Section title="Toll routes" right={<button className={btn} onClick={() => setRoute({ sourceCity: '', destinationCity: '', plazas: [] })}>Add a route</button>}>
      {!d.routes?.length ? <p className="text-sm text-slate-500">No toll route yet.</p> :
        <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Lane</th><th>Plazas</th><th>Expected tolls</th><th>Distance</th><th>States</th><th>Changed</th><th /></tr></thead>
          <tbody>{d.routes.map((x: any) => <tr key={x.id} className={`border-t ${route?.id === x.id ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold">{x.sourceCity} to {x.destinationCity}</td><td>{Number(x.plazaCount)}</td><td>{rupees(x.expectedTotal)}</td>
            <td>{x.distanceKm != null ? `${fmtDistance(x.distanceKm)}` : '-'}</td><td>{x.states || '-'}</td><td className="text-xs">{x.updatedByName || ''} {day(x.updatedAt)}</td>
            <td className="p-2"><button className={btnLight} onClick={() => openRoute(x.id)}>Open</button></td></tr>)}</tbody></table>}
      {d.lanes?.length > 0 && <p className="mt-3 text-sm text-slate-600">Lanes with trips but no toll route: {d.lanes.map((l: any, i: number) =>
        <button key={i} className="mr-2 font-semibold text-sky-700 hover:underline" onClick={() => setRoute({ sourceCity: l.sourceCity, destinationCity: l.destinationCity, plazas: [] })}>{l.sourceCity} to {l.destinationCity} ({Number(l.trips)})</button>)}</p>}
    </Section>

    {route && <Section title={route.id ? `${route.sourceCity} to ${route.destinationCity}` : 'New toll route'}
      right={<div className="flex gap-2">{route.id && <button className={btnLight} disabled={busy} onClick={learn}>Learn from past trips</button>}
        {route.id && r.manager && <button className={btnRed} disabled={busy} onClick={remove}>Remove</button>}<button className={btnLight} onClick={() => setRoute(null)}>Close</button></div>}>
      <form key={route.id || 'new'} onSubmit={saveRoute} className="grid gap-3 md:grid-cols-4">
        <div><span className={label}>From *</span><input name="sourceCity" required defaultValue={route.sourceCity} className={input} /></div>
        <div><span className={label}>To *</span><input name="destinationCity" required defaultValue={route.destinationCity} className={input} /></div>
        <div><span className={label}>Distance (km)</span><input name="distanceKm" type="number" step="0.1" defaultValue={route.distanceKm ?? ''} className={input} /></div>
        <div><span className={label}>States on the way</span><input name="states" defaultValue={route.states || ''} className={input} placeholder="Odisha, West Bengal" /></div>
        <div className="md:col-span-4"><span className={label}>Notes</span><input name="notes" defaultValue={route.notes || ''} className={input} /></div>
        <div className="md:col-span-4">
          <h3 className="font-bold">Plazas in order</h3>
          <table className="mt-1 w-full text-sm"><tbody>{route.plazas.map((p: any, i: number) => <tr key={p.plazaId} className="border-t">
            <td className="p-1 w-8">{i + 1}</td><td className="font-semibold">{p.name}{p.learned ? <span className="ml-1 text-xs text-slate-500">(learned)</span> : null}</td><td>{p.state || '-'}</td>
            <td className="w-40"><input type="number" step="0.01" min="0" value={p.expectedAmount ?? ''} onChange={e => { const l = [...route.plazas]; l[i] = { ...p, expectedAmount: e.target.value }; setPlazas2(l); }} className={input} placeholder="Expected ₹" /></td>
            <td className="whitespace-nowrap p-1"><button type="button" className={btnLight} onClick={() => move(i, -1)}>Up</button> <button type="button" className={btnLight} onClick={() => move(i, 1)}>Down</button> <button type="button" className={btnRed} onClick={() => setPlazas2(route.plazas.filter((_: any, j: number) => j !== i))}>Remove</button></td>
          </tr>)}</tbody></table>
          <select className={`${input} mt-2 max-w-md`} value="" onChange={e => { const p = plazas.find(x => String(x.id) === e.target.value); if (p) setPlazas2([...route.plazas, { plazaId: p.id, name: p.name, state: p.state, expectedAmount: '' }]); }}>
            <option value="">Add a plaza...</option>
            {plazas.filter(p => p.active && !route.plazas.some((x: any) => x.plazaId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}{p.state ? `, ${p.state}` : ''}{p.highway ? ` (${p.highway})` : ''}</option>)}
          </select>
        </div>
        <div className="md:col-span-4"><button className={btn} disabled={busy}>Save route</button></div>
      </form>
    </Section>}

    <Section title="Toll plazas" right={<button className={btnLight} onClick={() => setPlaza({ onFastag: true, active: true })}>Add a plaza</button>}>
      {plaza && <form key={plaza.id || 'new'} onSubmit={savePlaza} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <div><span className={label}>Name *</span><input name="name" required defaultValue={plaza.name || ''} className={input} /></div>
        <div><span className={label}>Code</span><input name="code" defaultValue={plaza.code || ''} className={input} /></div>
        <div><span className={label}>District</span><input name="district" defaultValue={plaza.district || ''} className={input} /></div>
        <div><span className={label}>State</span><input name="state" defaultValue={plaza.state || ''} className={input} /></div>
        <div><span className={label}>Highway</span><input name="highway" defaultValue={plaza.highway || ''} className={input} placeholder="NH16" /></div>
        <div><span className={label}>Latitude</span><input name="latitude" type="number" step="any" defaultValue={plaza.latitude ?? ''} className={input} /></div>
        <div><span className={label}>Longitude</span><input name="longitude" type="number" step="any" defaultValue={plaza.longitude ?? ''} className={input} /></div>
        <div className="flex items-end gap-4 text-sm font-semibold"><label className="flex items-center gap-1"><input type="checkbox" name="onFastag" defaultChecked={plaza.onFastag !== false} />On FASTag</label>
          <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={plaza.active !== false} />In use</label></div>
        <div className="flex gap-2 md:col-span-4"><button className={btn} disabled={busy}>Save plaza</button><button type="button" className={btnLight} onClick={() => setPlaza(null)}>Cancel</button></div>
      </form>}
      <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Plaza</th><th>District</th><th>State</th><th>Highway</th><th>Location</th><th /></tr></thead>
        <tbody>{plazas.map(p => <tr key={p.id} className={`border-t ${p.active ? '' : 'text-slate-400'}`}>
          <td className="p-2 font-semibold">{p.name}{p.code ? <span className="ml-1 text-xs text-slate-500">{p.code}</span> : null}</td><td>{p.district || '-'}</td><td>{p.state || '-'}</td><td>{p.highway || '-'}</td>
          <td className="text-xs">{p.latitude != null ? `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}` : 'not set'}</td>
          <td className="p-2"><button className={btnLight} onClick={() => setPlaza(p)}>Edit</button></td></tr>)}</tbody></table>
    </Section>
  </>;
}

// ------------------------------------------------------------------ bank statement

function StatementTab(ctx: Ctx) {
  const [list, setList] = useState<any>(null), [statementId, setStatementId] = useState(''), [status, setStatus] = useState('REVIEW'), [debits, setDebits] = useState<any>(null);
  const [reviewing, setReviewing] = useState<any>(null), [problems, setProblems] = useState<string[]>([]);
  const { busy, run } = useRun(ctx);
  const loadList = () => api('/api/gov/toll/statements').then(x => { if (x.ready === false) ctx.setNotReady(true); setList(x); }).catch(e => ctx.setErr(errorText(e, 'The statements could not be read')));
  const loadDebits = () => api(`/api/gov/toll/debits?status=${status}${statementId ? `&statementId=${statementId}` : ''}`).then(setDebits).catch(e => ctx.setErr(errorText(e, 'The statement could not be read')));
  useEffect(() => { void loadList(); }, []);
  useEffect(() => { void loadDebits(); }, [statementId, status]);

  async function importFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const x: any = await run(() => upload('/api/gov/toll/statements', new FormData(form)), (y: any) => y.message);
    if (x) { setProblems(x.problems || []); form.reset(); await loadList(); setStatementId(String(x.statementId)); }
  }
  async function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const x: any = await run(() => api(`/api/gov/toll/debits/${reviewing.id}/review`, { method: 'POST', body: JSON.stringify(b) }));
    if (x) { setReviewing(null); await loadDebits(); await loadList(); }
  }
  const labels = debits?.labels || list?.labels || {};
  return <>
    <Section title="Import the FASTag statement">
      <form onSubmit={importFile} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><span className={label}>Statement file (CSV or Excel) *</span><input name="file" type="file" required accept=".csv,.xlsx,.xls" className={input} /></div>
        <div><span className={label}>Bank</span><input name="bank" className={input} placeholder="ICICI FASTag" /></div>
        <div className="flex items-end"><button className={btn} disabled={busy}>Import</button></div>
      </form>
      <p className="mt-2 text-xs text-slate-500">The file needs a date and time, an amount and the plaza or description; the tag or the truck number and the transaction number help the match. A row already imported is skipped.</p>
      {problems.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
    </Section>

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div><span className={label}>Statement</span><select value={statementId} onChange={e => setStatementId(e.target.value)} className={input}><option value="">All statements</option>
          {(list?.statements || []).map((s: any) => <option key={s.id} value={s.id}>{s.fileName} ({day(s.importedAt)}, {Number(s.rowsMatched)}/{Number(s.rowsDebit)} matched{Number(s.toReview) ? `, ${s.toReview} to check` : ''})</option>)}</select></div>
        <div><span className={label}>Show</span><select value={status} onChange={e => setStatus(e.target.value)} className={input}><option value="REVIEW">To check</option><option value="">All rows</option>
          {Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}</select></div>
      </div>
      {!debits ? <p className="mt-3 text-slate-500">Loading...</p> : !debits.debits?.length ? <p className="mt-3 text-slate-500">Nothing here.</p> :
        <table className="mt-3 w-full min-w-[1000px] text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">When</th><th>Truck</th><th>Plaza</th><th>Class</th><th>Amount</th><th>Trip</th><th>Match</th><th /></tr></thead>
          <tbody>{debits.debits.map((x: any) => <tr key={x.id} className="border-t align-top">
            <td className="whitespace-nowrap p-2">{when(x.txnAt)}<div className="text-xs text-slate-500">{x.txnRef}</div></td>
            <td>{x.vehicleNumber || '-'}</td><td>{x.plazaName || '-'}</td><td>{x.vehicleClass || '-'}</td><td>{rupees(x.amount)}{x.kind !== 'DEBIT' ? <span className="ml-1 text-xs">({words(x.kind)})</span> : null}</td>
            <td>{x.tripId ? <Link to={`/trips/${x.tripId}`} className="font-bold text-sky-700 hover:underline">{x.tripNumber}</Link> : '-'}</td>
            <td><span className={pill(x.matchStatus)}>{x.matchLabel || words(x.matchStatus)}</span>{x.matchNote ? <div className="text-xs text-slate-500">{x.matchNote}</div> : null}
              {x.reviewedNote ? <div className="text-xs text-slate-500">{x.reviewedByName}: {x.reviewedNote}</div> : null}</td>
            <td className="p-2">{['NO_TRIP', 'DOUBLE', 'WRONG_CLASS', 'NO_TRUCK'].includes(x.matchStatus) && <button className={btnLight} onClick={() => setReviewing(x)}>Check</button>}</td>
          </tr>)}</tbody></table>}
    </section>

    {reviewing && <Section title={`Check ${reviewing.plazaName || 'the row'} of ${when(reviewing.txnAt)}, ${rupees(reviewing.amount)}`} right={<button className={btnLight} onClick={() => setReviewing(null)}>Close</button>}>
      <p className="text-sm text-slate-600">{reviewing.matchLabel}. {reviewing.matchStatus === 'DOUBLE' || reviewing.matchStatus === 'WRONG_CLASS' ? 'Claim the money back from the bank, then accept with the claim number.' : 'Give the trip it belongs to, or mark it not a toll.'}</p>
      <form onSubmit={review} className="mt-2 grid gap-3 md:grid-cols-4">
        <div><span className={label}>Result *</span><select name="status" required className={input}><option value="ACCEPTED">Checked and accepted</option><option value="NOT_A_TOLL">Not a toll</option></select></div>
        <div><span className={label}>Trip id (when known)</span><input name="tripId" type="number" className={input} defaultValue={reviewing.tripId ?? ''} /></div>
        <div className="md:col-span-2"><span className={label}>Note *</span><input name="note" required minLength={5} className={input} placeholder="Refund claimed, ticket 4471" /></div>
        <div className="md:col-span-4"><button className={btn} disabled={busy}>Save</button></div>
      </form>
    </Section>}
  </>;
}

// ------------------------------------------------------------------ report

function ReportTab(ctx: Ctx) {
  const today = new Date().toISOString().slice(0, 10), first = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(first), [to, setTo] = useState(today), [by, setBy] = useState('TRIP'), [d, setD] = useState<any>(null);
  const q = `from=${from}&to=${to}&by=${by}`;
  useEffect(() => { api(`/api/gov/toll/report?${q}`).then(x => { if (x.ready === false) ctx.setNotReady(true); setD(x); }).catch(e => ctx.setErr(errorText(e, 'The report could not be read'))); }, [q]);
  return <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-end gap-3">
      <div><span className={label}>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} /></div>
      <div><span className={label}>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} /></div>
      <div><span className={label}>By</span><select value={by} onChange={e => setBy(e.target.value)} className={input}><option value="TRIP">Trip</option><option value="LANE">Lane</option><option value="TRUCK">Truck</option></select></div>
      <button className={btnLight} onClick={() => apiDownload(`/api/gov/toll/report.xlsx?${q}`, 'Toll_report.xlsx').catch(e => ctx.setErr(errorText(e, 'Not downloaded')))}>Excel</button>
    </div>
    {d && <>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Total tolls</div><div className="text-lg font-bold">{rupees(d.total)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">To claim back (charged twice or wrong class)</div><div className="text-lg font-bold">{rupees(d.refundAmount)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Statement rows to check</div><div className="text-lg font-bold">{Number(d.toReview || 0)}</div></div>
      </div>
      {!d.rows?.length ? <p className="mt-3 text-slate-500">No toll in this period.</p> :
        <table className="mt-3 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">{by === 'TRIP' ? 'Trip' : by === 'LANE' ? 'Lane' : 'Truck'}</th>{by === 'TRIP' ? <><th>Truck</th><th>Lane</th></> : <th>Trips</th>}<th>Crossings</th><th>Amount</th></tr></thead>
          <tbody>{d.rows.map((x: any, i: number) => <tr key={i} className="border-t">
            <td className="p-2 font-semibold">{by === 'TRIP' && x.tripId ? <Link to={`/trips/${x.tripId}`} className="text-sky-700 hover:underline">{x.name}</Link> : x.name}</td>
            {by === 'TRIP' ? <><td>{x.truck || '-'}</td><td>{x.lane || '-'}</td></> : <td>{Number(x.trips)}</td>}
            <td>{Number(x.crossings)}</td><td>{rupees(x.amount)}</td></tr>)}</tbody></table>}
    </>}
  </section>;
}
