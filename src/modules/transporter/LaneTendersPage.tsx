/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-013 -- the annual lane tender. RefTech asks invited transporters for rates per lane, truck type and
// temperature class, in up to three rounds (a later round goes to a shortlist). Each bidder sees only its own rank
// (on the transporter portal); staff see the whole ranking here. A lane can be split (for example 70/30); the
// awarded rates become rate contracts (REQ-TAL-002) and share rules (REQ-TAL-006) without retyping.
//
// Backend: LaneTenderController (/api/transporters/lane-tenders/**). Changing needs the permission TAL_LANE_TENDER.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { RATE_BASES, VEHICLE_TYPES, day, role, rupees } from './transporter';
import { when } from '@/modules/allocation/allocation';
import { LANE_TENDER_STATE, SCRIPT_92, badge, localInput, needsReason, rankLabel, sharesFrom, splitProblem } from './talMarket';

type Lane = Record<string, string>;
const LANE_COLS: [string, string, string?][] = [
  ['originCity', 'From'], ['destinationCity', 'To'], ['vehicleType', 'Truck', 'truck'], ['capacityTons', 'Tons', 'number'], ['temperatureProfileId', 'Temperature', 'profile'],
  ['rateBasis', 'Basis', 'basis'], ['loadsPerMonth', 'Loads / month', 'number'], ['distanceKm', 'Km', 'number'], ['ceilingRate', 'Highest rate ₹', 'number'], ['notes', 'Notes'],
];
const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export function LaneTendersPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('id') || 0);
  const [state, setState] = useState('');
  const [list, setList] = useState<any>(null);
  const [d, setD] = useState<any>(null);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try { setList(await api(`/api/transporters/lane-tenders${state ? `?state=${state}` : ''}`)); } catch (x) { setError(errorText(x, 'Could not load the lane tenders')); }
  }, [state]);
  const loadOne = useCallback(async () => {
    if (!id) { setD(null); return; }
    try { setD(await api(`/api/transporters/lane-tenders/${id}`)); } catch (x) { setError(errorText(x, 'Could not load the lane tender')); }
  }, [id]);
  useEffect(() => { if (me.staff) void loadList(); }, [loadList]);
  useEffect(() => { if (me.staff) { void loadOne(); setEditing(null); } }, [loadOne]);
  useEffect(() => {
    if (!me.staff) return;
    api('/api/transporters').then(r => setTransporters((r.transporters || []).filter((t: any) => t.onboardingStatus === 'APPROVED'))).catch(() => setTransporters([]));
    api('/api/temperature-profiles').then(p => setProfiles(Array.isArray(p) ? p : [])).catch(() => setProfiles([]));
  }, []);

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await action();
      setMsg(r?.message || done);
      await loadList();
      if (r?.id && r?.tenderNo && r.id !== id) setParams({ id: String(r.id) }); else await loadOne();
      return r ?? true;
    } catch (x) { setError(errorText(x, 'Could not save')); return null; } finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Lane Tenders</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  const manage = !!(list?.canManage || d?.canManage);
  const base = d ? `/api/transporters/lane-tenders/${d.id}` : '';

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Gavel className="h-8 w-8 text-sky-700" />Lane Tenders</h1>
    <p className="text-slate-600">The yearly request for rates per lane, truck and temperature class. Invited transporters bid on the portal, in up to three rounds, and see only their rank.</p>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script={SCRIPT_92} />}
    {list?.ready && <>
      {editing && <Editor key={editing + (d?.id || '')} initial={editing === 'edit' ? d : null} transporters={transporters} profiles={profiles} busy={busy} onCancel={() => setEditing(null)}
        onSave={body => run(() => editing === 'edit' ? api(base, { method: 'PUT', body: JSON.stringify(body) }) : post('/api/transporters/lane-tenders', body), 'Saved as a draft.').then(r => { if (r) setEditing(null); })} />}
      {d && !editing && <Detail d={d} manage={manage} busy={busy} transporters={transporters} run={run} onEdit={() => setEditing('edit')} onClose={() => setParams({})} base={base} />}
      <Section title="All lane tenders" right={<div className="flex flex-wrap items-center gap-2">
        <select value={state} onChange={e => setState(e.target.value)} className={`${input} w-48`}><option value="">All</option>
          {Object.entries(LANE_TENDER_STATE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {manage && <button onClick={() => { setParams({}); setEditing('new'); }} className={btn}>New lane tender</button>}</div>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Tender</th><th className={th}>Contract period</th><th className={th}>Lanes</th><th className={th}>Invited / bidders</th><th className={th}>Round</th><th className={th}>Status</th></tr></thead>
          <tbody>{list.tenders.map((t: any) => <tr key={t.id} onClick={() => setParams({ id: String(t.id) })} className={`cursor-pointer border-t hover:bg-sky-50 ${t.id === id ? 'bg-sky-50' : ''}`}>
            <td className={td}><b>{t.tenderNo}</b><div className="text-xs text-slate-500">{t.title}</div></td><td className={td}>{day(t.contractFrom)} to {day(t.contractTo)}</td>
            <td className={td}>{t.laneCount}</td><td className={td}>{t.invitedCount} / {t.bidderCount}</td>
            <td className={td}>{t.currentRound || '-'} of {t.maxRounds}{t.state === 'OPEN' && t.roundClosesAt ? <div className="text-xs text-slate-500">till {when(t.roundClosesAt)}</div> : null}</td>
            <td className={td}><span className={badge(t.state)}>{LANE_TENDER_STATE[t.state] || t.state}</span></td></tr>)}
            {list.tenders.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No lane tenders yet.</td></tr>}</tbody></table></div>
        {!manage && <p className="mt-2 text-xs text-slate-500">Making, awarding and converting lane tenders needs the permission "Lane tenders" (TAL_LANE_TENDER).</p>}
      </Section>
    </>}
  </>;
}

function Editor({ initial, transporters, profiles, busy, onCancel, onSave }: {
  initial: any; transporters: any[]; profiles: any[]; busy: boolean; onCancel: () => void; onSave: (body: any) => void;
}) {
  const year = new Date().getFullYear() + 1;
  const [head, setHead] = useState<Record<string, string>>({
    title: initial?.title || `Annual reefer lanes ${year}`, contractFrom: initial?.contractFrom || `${year}-01-01`, contractTo: initial?.contractTo || `${year}-12-31`,
    maxRounds: String(initial?.maxRounds ?? 3), paymentTermsDays: String(initial?.paymentTermsDays ?? 30), notes: initial?.notes || '',
  });
  const [lanes, setLanes] = useState<Lane[]>(() => (initial?.lanes || []).map((l: any) => Object.fromEntries(LANE_COLS.map(([k]) => [k, l[k] == null ? '' : String(l[k])]))));
  const [invited, setInvited] = useState<number[]>(() => (initial?.invites || []).map((i: any) => Number(i.transporterId)));
  const setLane = (i: number, k: string, v: string) => setLanes(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const toggle = (tid: number) => setInvited(x => (x.includes(tid) ? x.filter(y => y !== tid) : [...x, tid]));
  const submit = () => onSave({ ...head, lanes: lanes.map(l => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== ''))), transporterIds: invited });
  return <Section title={initial ? `Edit ${initial.tenderNo}` : 'New lane tender'}>
    <div className="grid gap-3 md:grid-cols-3">
      {([['title', 'Title', 'text'], ['contractFrom', 'Contract from', 'date'], ['contractTo', 'Contract to', 'date'], ['maxRounds', 'Rounds (1 to 3)', 'number'],
        ['paymentTermsDays', 'Pay in (days)', 'number'], ['notes', 'Notes for the bidders', 'text']] as const).map(([k, l, ty]) =>
        <div key={k}><label className={label}>{l}</label><input type={ty} value={head[k]} onChange={e => setHead({ ...head, [k]: e.target.value })} className={input} /></div>)}
    </div>
    <h3 className="mt-4 font-bold">Lanes</h3>
    <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead><tr className="bg-slate-50 text-slate-600">{LANE_COLS.map(([k, l]) => <th key={k} className={th}>{l}</th>)}<th className={th}></th></tr></thead>
      <tbody>{lanes.map((l, i) => <tr key={i} className="border-t">{LANE_COLS.map(([k, , ty]) => <td key={k} className="p-1">
        {ty === 'truck' ? <select value={l[k] || 'REEFER_TRUCK'} onChange={e => setLane(i, k, e.target.value)} className={input}>{VEHICLE_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          : ty === 'basis' ? <select value={l[k] || 'PER_TRIP'} onChange={e => setLane(i, k, e.target.value)} className={input}>{RATE_BASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            : ty === 'profile' ? <select value={l[k] || ''} onChange={e => setLane(i, k, e.target.value)} className={input}><option value="">Any</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              : <input type={ty === 'number' ? 'number' : 'text'} step="any" value={l[k] || ''} onChange={e => setLane(i, k, e.target.value)} className={input} />}</td>)}
        <td className="p-1"><button type="button" onClick={() => setLanes(ls => ls.filter((_, j) => j !== i))} className={btnRed}>Remove</button></td></tr>)}</tbody></table></div>
    <button type="button" onClick={() => setLanes(ls => [...ls, { vehicleType: 'REEFER_TRUCK', rateBasis: 'PER_TRIP' }])} className={`${btnLight} mt-2`}>Add lane</button>
    <h3 className="mt-4 font-bold">Invite transporters <span className="text-sm font-normal text-slate-500">(approved only; only they see and bid)</span></h3>
    <div className="mt-1 flex flex-wrap gap-2">{transporters.map(t => <label key={t.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${invited.includes(Number(t.id)) ? 'border-sky-600 bg-sky-50 font-semibold' : 'border-slate-300'}`}>
      <input type="checkbox" className="mr-1" checked={invited.includes(Number(t.id))} onChange={() => toggle(Number(t.id))} />{t.name}</label>)}
      {transporters.length === 0 && <span className="text-sm text-slate-500">No approved transporter yet.</span>}</div>
    <div className="mt-4 flex gap-2"><button disabled={busy} onClick={submit} className={btn}>Save draft</button><button onClick={onCancel} className={btnLight}>Cancel</button></div>
  </Section>;
}

function Detail({ d, manage, busy, transporters, run, onEdit, onClose, base }: {
  d: any; manage: boolean; busy: boolean; transporters: any[]; run: (a: () => Promise<any>, done: string) => Promise<any>; onEdit: () => void; onClose: () => void; base: string;
}) {
  const [days, setDays] = useState('7');
  const [closesAt, setClosesAt] = useState(localInput(new Date(Date.now() + 7 * 86400000)));
  const [shortlist, setShortlist] = useState<number[]>(() => d.invites.filter((i: any) => i.status === 'INVITED' && i.bids > 0).map((i: any) => Number(i.transporterId)));
  const [period, setPeriod] = useState('MONTH');
  const [autoApply, setAutoApply] = useState(true);
  const [paper, setPaper] = useState<Record<string, string>>({});
  const later = d.currentRound >= 1;
  const canOpen = manage && (d.state === 'DRAFT' || (d.state === 'EVALUATION' && d.currentRound < d.maxRounds));
  const canAward = manage && ['EVALUATION', 'AWARDED'].includes(d.state);
  return <Section id="tender" title={<>{d.tenderNo} <span className={badge(d.state)}>{LANE_TENDER_STATE[d.state] || d.state}</span></>} right={<div className="flex flex-wrap gap-2">
    {manage && d.state === 'DRAFT' && <button onClick={onEdit} className={btnLight}>Edit</button>}
    {manage && d.state === 'OPEN' && <button disabled={busy} onClick={() => void run(() => post(`${base}/close-round`), 'Round closed.')} className={btnLight}>Close round now</button>}
    {manage && !['CONVERTED', 'CANCELLED'].includes(d.state) && <button disabled={busy} onClick={() => { const r = window.prompt('Reason for cancelling the lane tender:'); if (r !== null) void run(() => post(`${base}/cancel`, { reason: r }), 'Cancelled.'); }} className={btnRed}>Cancel tender</button>}
    <button onClick={onClose} className={btnLight}>Close</button></div>}>
    <div className="grid gap-2 text-sm md:grid-cols-3">
      <div><b>{d.title}</b><div>Contracts {day(d.contractFrom)} to {day(d.contractTo)} · pay in {d.paymentTermsDays ?? '-'} days</div>{d.notes && <div className="text-slate-600">{d.notes}</div>}</div>
      <div>Round {d.currentRound || '-'} of {d.maxRounds}{d.roundClosesAt && <div>{d.state === 'OPEN' ? 'Closes' : 'Closed'} {when(d.roundClosesAt)}</div>}<div>Split pattern: {(d.split || []).join(' / ')} %</div></div>
      <div>Made by {d.createdByName}{d.awardedByName && <div>Awarded by {d.awardedByName} on {day(d.awardedAt)}</div>}{d.convertedByName && <div>Contracts made by {d.convertedByName} on {day(d.convertedAt)}</div>}
        {d.cancelReason && <div className="text-red-700">Cancelled: {d.cancelReason}</div>}</div>
    </div>
    {d.conversionNote && <div className="mt-2 whitespace-pre-line rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{d.conversionNote}</div>}

    <h3 className="mt-4 font-bold">Invited transporters</h3>
    <div className="mt-1 flex flex-wrap gap-2 text-sm">{d.invites.map((i: any) => <span key={i.transporterId} className={`rounded-full border px-3 py-1 ${i.inCurrentRound ? 'border-sky-600' : 'border-slate-300 text-slate-500'}`}>
      {canOpen && later && <input type="checkbox" className="mr-1" checked={shortlist.includes(Number(i.transporterId))} onChange={() => setShortlist(s => s.includes(Number(i.transporterId)) ? s.filter(x => x !== Number(i.transporterId)) : [...s, Number(i.transporterId)])} />}
      {i.transporterName} · {i.bids} bid(s){i.status === 'DECLINED' ? ` · declined${i.declinedReason ? `: ${i.declinedReason}` : ''}` : ''}{!i.approved ? ' · not approved' : ''}</span>)}</div>

    {canOpen && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-sky-50 p-3 text-sm">
      <div><label className={label}>Round {d.currentRound + 1} closes</label><input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} className={input} /></div>
      <div><label className={label}>or open for (days)</label><input type="number" value={days} onChange={e => { setDays(e.target.value); if (e.target.value) setClosesAt(localInput(new Date(Date.now() + Number(e.target.value) * 86400000))); }} className={`${input} w-24`} /></div>
      <button disabled={busy} className={btn} onClick={() => void run(() => post(`${base}/rounds`, { closesAt, ...(later ? { transporterIds: shortlist } : {}) }), 'Round opened.')}>
        {d.currentRound === 0 ? 'Open round 1 and alert the transporters' : `Open round ${d.currentRound + 1} for the ticked transporters`}</button>
      {later && <span className="text-xs text-slate-600">In a later round a bidder may keep or lower its rate.</span>}
    </div>}

    <h3 className="mt-4 font-bold">Lanes, ranking and award</h3>
    {d.lanes.map((l: any) => <LaneAward key={l.id} l={l} canAward={canAward} busy={busy} onAward={(lane) => void run(() => post(`${base}/award`, { lanes: [lane] }), 'Saved.')} />)}

    {manage && d.state === 'AWARDED' && <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-emerald-50 p-3 text-sm">
      <div><label className={label}>Share rule period</label><select value={period} onChange={e => setPeriod(e.target.value)} className={input}><option value="MONTH">Month</option><option value="QUARTER">Quarter</option><option value="RULE">Whole contract</option></select></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={autoApply} onChange={e => setAutoApply(e.target.checked)} />Send loads by the share automatically</label>
      <button disabled={busy} className={btn} onClick={() => void run(() => post(`${base}/contracts`, { period, autoApply }), 'Contracts made.')}>Make rate contracts and share rules</button>
      <span className="text-xs text-slate-600">One draft contract per transporter is made and sent for approval; one share rule per route.</span>
    </div>}

    {manage && ['OPEN', 'EVALUATION'].includes(d.state) && <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
      <b>Enter a rate sent on paper or by email</b> (counts as the transporter's bid in round {d.currentRound})
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <select value={paper.transporterId || ''} onChange={e => setPaper({ ...paper, transporterId: e.target.value })} className={`${input} w-56`}><option value="">Transporter</option>
          {d.invites.map((i: any) => <option key={i.transporterId} value={i.transporterId}>{i.transporterName}</option>)}</select>
        <select value={paper.laneId || ''} onChange={e => setPaper({ ...paper, laneId: e.target.value })} className={`${input} w-64`}><option value="">Lane</option>
          {d.lanes.map((l: any) => <option key={l.id} value={l.id}>{l.lineNo}. {l.originCity} → {l.destinationCity}</option>)}</select>
        <input type="number" step="any" placeholder="Rate ₹" value={paper.rate || ''} onChange={e => setPaper({ ...paper, rate: e.target.value })} className={`${input} w-32`} />
        <input type="number" placeholder="Transit h" value={paper.transitHours || ''} onChange={e => setPaper({ ...paper, transitHours: e.target.value })} className={`${input} w-28`} />
        <input placeholder="Note" value={paper.note || ''} onChange={e => setPaper({ ...paper, note: e.target.value })} className={`${input} w-56`} />
        <button disabled={busy} className={btnLight} onClick={() => void run(() => post(`${base}/bids`, paper), 'Rate saved.').then(r => { if (r) setPaper({}); })}>Save rate</button>
      </div></div>}
    {transporters.length === 0 && null}

    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Every bid ({d.bids.length})</summary>
      <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>When</th><th className={th}>Lane</th><th className={th}>Transporter</th><th className={th}>Round</th><th className={`${th} text-right`}>Rate</th><th className={th}>By</th></tr></thead>
        <tbody>{d.bids.map((b: any) => <tr key={b.id} className="border-t"><td className={td}>{when(b.placedAt)}</td><td className={td}>{b.lineNo}</td><td className={td}>{b.transporterName}</td><td className={td}>{b.round}</td>
          <td className={`${td} text-right`}>{rupees(b.rate)}</td><td className={td}>{b.via === 'STAFF' ? b.placedByName : 'Portal'}{b.note ? ` · ${b.note}` : ''}</td></tr>)}</tbody></table></details>
  </Section>;
}

function LaneAward({ l, canAward, busy, onAward }: { l: any; canAward: boolean; busy: boolean; onAward: (lane: any) => void }) {
  const initial = () => Object.fromEntries((l.awards?.length ? l.awards : l.suggestedSplit || []).map((s: any) => [s.transporterId, String(Number(s.sharePercent))]));
  const [shares, setShares] = useState<Record<number, string>>(initial);
  const [reason, setReason] = useState('');
  const list = sharesFrom(shares);
  const bidders = (l.ranking || []).map((r: any) => Number(r.transporterId));
  const problem = list.length ? splitProblem(list, bidders) : null;
  const askReason = list.length > 0 && needsReason(list, (l.ranking || []).map((r: any) => ({ transporterId: Number(r.transporterId), rank: r.rank })));
  return <div className="mt-2 rounded-xl border border-slate-200 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{l.lineNo}. {l.originCity} → {l.destinationCity}</b> · {VEHICLE_TYPES.find(v => v[0] === l.vehicleType)?.[1] || l.vehicleType}
      {l.capacityTons ? ` · ${Number(l.capacityTons)} t` : ''} · {l.temperatureProfileName || 'any temperature'} · {RATE_BASES.find(b => b[0] === l.rateBasis)?.[1].toLowerCase()}
      {l.loadsPerMonth ? ` · ${l.loadsPerMonth} loads a month` : ''}{l.ceilingRate ? ` · highest ${rupees(l.ceilingRate)}` : ''}</div>
      <span className={badge(l.awardStatus === 'AWARDED' ? 'AWARDED' : l.awardStatus === 'NO_AWARD' ? 'CANCELLED' : 'OPEN')}>{l.awardStatus === 'AWARDED' ? 'Awarded' : l.awardStatus === 'NO_AWARD' ? 'Not awarded' : 'Open'}</span></div>
    <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Rank</th><th className={th}>Transporter</th><th className={`${th} text-right`}>Rate</th><th className={th}>Transit</th><th className={th}>Detention</th><th className={th}>Round</th>
      {canAward && <th className={th}>Share %</th>}</tr></thead>
      <tbody>{(l.ranking || []).map((r: any) => <tr key={r.transporterId} className="border-t"><td className={`${td} font-bold`}>{rankLabel(r.rank)}</td><td className={td}>{r.transporterName}</td>
        <td className={`${td} text-right font-semibold`}>{rupees(r.rate)}</td><td className={td}>{r.transitHours ? `${r.transitHours} h` : '-'}</td>
        <td className={td}>{r.detentionPerDay ? `${rupees(r.detentionPerDay)}/day after ${r.detentionFreeHours ?? 24} h` : '-'}</td><td className={td}>{r.round}</td>
        {canAward && <td className={td}><input type="number" step="any" value={shares[r.transporterId] || ''} onChange={e => setShares({ ...shares, [r.transporterId]: e.target.value })} className={`${input} w-24`} /></td>}</tr>)}
        {(l.ranking || []).length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No bids yet.</td></tr>}</tbody></table>
    {l.awards?.length > 0 && <div className="mt-2 text-sm">Award: {l.awards.map((a: any) => `${a.transporterName} ${Number(a.sharePercent)} % at ${rupees(a.rate)}${a.contractNo ? ` (contract ${a.contractNo})` : ''}`).join(' · ')}
      {l.awardNote && <span className="text-slate-500"> · {l.awardNote}</span>}</div>}
    {canAward && <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
      {askReason && <input placeholder="Reason (a cheaper bidder is passed over or gets less)" value={reason} onChange={e => setReason(e.target.value)} className={`${input} w-96`} />}
      <button disabled={busy || !!problem || list.length === 0} className={btn} onClick={() => onAward({ laneId: l.id, shares: list, reason: reason || undefined })}>Award this lane</button>
      <button disabled={busy} className={btnLight} onClick={() => { const r = window.prompt('Why is this lane not awarded?'); if (r !== null) onAward({ laneId: l.id, noAward: true, reason: r }); }}>Not awarded</button>
      <button className={btnLight} onClick={() => setShares(Object.fromEntries((l.suggestedSplit || []).map((s: any) => [s.transporterId, String(Number(s.sharePercent))])))}>Use the suggested split</button>
      {problem && <span className="text-red-700">{problem}</span>}
    </div>}
  </div>;
}
