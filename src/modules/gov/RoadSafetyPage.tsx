/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-015 -- Road Safety: accident black spots near a route and the no-entry hours of cities for trucks, with
// the weather warnings of the route. "Check a route" shows what a driver should be told; Create Trip shows the
// same as notes. Places are typed in, or loaded from the provider; places shared by every company are read-only.
// Backend: /api/gov/road (GovController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { TrafficCone } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { SCRIPT, iso, providerNote, role, words } from './gov';
import { fmtDistance } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const hm = (v?: string | null) => (v ? String(v).slice(0, 5) : '');

export function RoadSafetyPage() {
  const r = role();
  const [kind, setKind] = useState(''), [d, setD] = useState<any>(null), [edit, setEdit] = useState<any>(null), [check, setCheck] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [editKind, setEditKind] = useState('BLACK_SPOT');
  const load = () => api(`/api/gov/road/spots${kind ? `?kind=${kind}` : ''}`).then(setD).catch(e => setErr(errorText(e, 'The places could not be read')));
  useEffect(() => { void load(); }, [kind]);

  async function run(fn: () => Promise<any>, done: (x: any) => string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done(x)); await load(); return x; }
    catch (e) { setErr(errorText(e, 'Not saved')); return null; } finally { setBusy(false); }
  }
  async function routeCheck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(e.currentTarget));
    const q = new URLSearchParams({ source: b.source, destination: b.destination });
    if (b.start) q.set('start', iso(b.start));
    if (b.arrive) q.set('arrive', iso(b.arrive));
    setErr('');
    api(`/api/gov/road?${q}`).then(setCheck).catch(x => setErr(errorText(x, 'The route could not be checked')));
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b: any = Object.fromEntries(f); b.active = f.get('active') === 'on';
    if (await run(() => api(edit.id ? `/api/gov/road/spots/${edit.id}` : '/api/gov/road/spots', { method: edit.id ? 'PUT' : 'POST', body: JSON.stringify(b) }), () => 'Place saved')) setEdit(null);
  }
  const remove = (id: number) => window.confirm('Remove this place?') && run(() => api(`/api/gov/road/spots/${id}`, { method: 'DELETE' }), () => 'Place removed');

  if (d && d.ready === false) return <><h1 className="text-3xl font-bold">Road Safety</h1><NotReady script={SCRIPT} /></>;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><TrafficCone />Road Safety</h1>
    <p className="text-slate-600">Accident black spots and truck no-entry hours of cities, for briefing the driver before a trip.</p>
    <Banner msg={msg} error={err} />

    <Section title="Check a route">
      <form onSubmit={routeCheck} className="grid gap-3 md:grid-cols-5">
        <div><span className={label}>From *</span><input name="source" required className={input} placeholder="Bhubaneswar" /></div>
        <div><span className={label}>To *</span><input name="destination" required className={input} placeholder="Kolkata" /></div>
        <div><span className={label}>Start</span><input name="start" type="datetime-local" className={input} /></div>
        <div><span className={label}>Arrival</span><input name="arrive" type="datetime-local" className={input} /></div>
        <div className="flex items-end"><button className={btn}>Check</button></div>
      </form>
      {check && <div className="mt-3 text-sm">
        {check.message && <p className="rounded-xl bg-amber-50 p-2 text-amber-900">{check.message}</p>}
        {check.routeKnown && <p className="text-slate-600">Route: {check.route.join(' → ')}</p>}
        {check.warnings?.length ? <ul className="mt-2 list-disc pl-5 font-semibold text-amber-900">{check.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul> : <p className="mt-2 text-emerald-700">Nothing to warn about.</p>}
        {check.blackSpots?.length > 0 && <table className="mt-2 w-full"><tbody>{check.blackSpots.map((s: any) => <tr key={s.id} className="border-t"><td className="p-1 font-semibold">{s.name}</td><td>{s.highway || ''}</td><td>{s.city || ''}{s.state ? `, ${s.state}` : ''}</td><td>{s.distanceKm} km from the road</td><td className="text-xs text-slate-500">{s.note || ''}</td></tr>)}</tbody></table>}
        {check.noEntry?.length > 0 && <ul className="mt-2">{check.noEntry.map((s: any, i: number) => <li key={i} className={s.inside ? 'font-semibold text-red-700' : ''}>{s.city}: no entry {hm(s.entryFrom)} to {hm(s.entryTo)}{s.appliesTo ? ` (${s.appliesTo})` : ''}; {s.at} {s.time}{s.inside ? ', inside these hours' : ''}</li>)}</ul>}
      </div>}
    </Section>

    <Section title="Places" right={<div className="flex gap-2">
      {d && d.provider !== 'MANUAL' && r.admin && <button className={btnLight} disabled={busy} onClick={() => run(() => api('/api/gov/road/spots/refresh', { method: 'POST' }), x => x.message || 'Loaded')}>Load from the provider</button>}
      {r.manager && <button className={btn} onClick={() => { setEdit({ kind: 'BLACK_SPOT', active: true }); setEditKind('BLACK_SPOT'); }}>Add a place</button>}</div>}>
      {d && providerNote(d.provider, 'Road safety data') && <p className="mb-2 text-xs text-slate-500">{providerNote(d.provider, 'Road safety data')}</p>}
      <div className="mb-3 flex flex-wrap gap-2">{[['', 'All'], ['BLACK_SPOT', 'Black spots'], ['NO_ENTRY', 'No-entry hours']].map(([k, t]) =>
        <button key={k} onClick={() => setKind(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${kind === k ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{t}</button>)}</div>
      {edit && <form key={edit.id || 'new'} onSubmit={save} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <div><span className={label}>Kind *</span><select name="kind" value={editKind} onChange={e => setEditKind(e.target.value)} className={input}><option value="BLACK_SPOT">Accident black spot</option><option value="NO_ENTRY">No-entry hours</option></select></div>
        <div><span className={label}>Name *</span><input name="name" required defaultValue={edit.name || ''} className={input} /></div>
        <div><span className={label}>City{editKind === 'NO_ENTRY' ? ' *' : ''}</span><input name="city" required={editKind === 'NO_ENTRY'} defaultValue={edit.city || ''} className={input} /></div>
        <div><span className={label}>State</span><input name="state" defaultValue={edit.state || ''} className={input} /></div>
        {editKind === 'BLACK_SPOT' ? <>
          <div><span className={label}>Highway</span><input name="highway" defaultValue={edit.highway || ''} className={input} placeholder="NH16" /></div>
          <div><span className={label}>Latitude *</span><input name="latitude" type="number" step="any" required defaultValue={edit.latitude ?? ''} className={input} /></div>
          <div><span className={label}>Longitude *</span><input name="longitude" type="number" step="any" required defaultValue={edit.longitude ?? ''} className={input} /></div>
          <div><span className={label}>Radius (km)</span><input name="radiusKm" type="number" step="0.1" defaultValue={edit.radiusKm ?? ''} className={input} /></div>
        </> : <>
          <div><span className={label}>No entry from *</span><input name="entryFrom" type="time" required defaultValue={hm(edit.entryFrom)} className={input} /></div>
          <div><span className={label}>To *</span><input name="entryTo" type="time" required defaultValue={hm(edit.entryTo)} className={input} /></div>
          <div className="md:col-span-2"><span className={label}>Applies to</span><input name="appliesTo" defaultValue={edit.appliesTo || ''} className={input} placeholder="Goods vehicles over 7.5 t" /></div>
        </>}
        <div className="md:col-span-3"><span className={label}>Note</span><input name="note" defaultValue={edit.note || ''} className={input} /></div>
        <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={edit.active !== false} />In use</label>
        <div className="flex gap-2 md:col-span-4"><button className={btn} disabled={busy}>Save</button><button type="button" className={btnLight} onClick={() => setEdit(null)}>Cancel</button></div>
      </form>}
      {!d ? <p className="text-slate-500">Loading...</p> : !d.spots?.length ? <p className="text-sm text-slate-500">No place yet.</p> :
        <table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Place</th><th>Kind</th><th>Where</th><th>Hours or radius</th><th>Source</th><th /></tr></thead>
          <tbody>{d.spots.map((s: any) => <tr key={s.id} className={`border-t align-top ${s.active ? '' : 'text-slate-400'}`}>
            <td className="p-2 font-semibold">{s.name}{s.note ? <div className="text-xs font-normal text-slate-500">{s.note}</div> : null}</td>
            <td>{s.kind === 'NO_ENTRY' ? 'No-entry hours' : 'Black spot'}</td>
            <td>{[s.highway, s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
            <td>{s.kind === 'NO_ENTRY' ? `${hm(s.entryFrom)} to ${hm(s.entryTo)}${s.appliesTo ? `, ${s.appliesTo}` : ''}` : s.radiusKm != null ? `${fmtDistance(s.radiusKm)}` : '-'}</td>
            <td className="text-xs">{s.shared ? 'Shared (read-only)' : words(s.source)}</td>
            <td className="whitespace-nowrap p-2">{!s.shared && r.manager && <><button className={btnLight} onClick={() => { setEdit(s); setEditKind(s.kind); }}>Edit</button> <button className={btnRed} disabled={busy} onClick={() => remove(s.id)}>Remove</button></>}</td>
          </tr>)}</tbody></table>}
    </Section>
  </>;
}
