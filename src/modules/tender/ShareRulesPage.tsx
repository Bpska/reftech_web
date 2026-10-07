/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-006 -- contract share rules: a lane's loads are split between transporters by percent (for example
// 60 / 40). Each new load goes to the transporter furthest behind its share in the period (month, quarter or
// the whole rule), skipping one that is not approved or has no rate in force. With "give by itself" the loads of
// the lane are given without a click, and the transporter answers like a tender.
//
// Backend: TenderController (/api/allocation/share-rules).
import { useCallback, useEffect, useState } from 'react';
import { Split } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { role } from '@/modules/transporter/transporter';
import { SCRIPT_46, call } from './tender';

const PERIODS: [string, string][] = [['MONTH', 'Each month'], ['QUARTER', 'Each quarter'], ['RULE', 'Whole rule']];
type Line = { transporterId: string; sharePercent: string; priority: string };

export function ShareRulesPage() {
  const me = role();
  const [all, setAll] = useState(false);
  const [list, setList] = useState<any>(null), [transporters, setTransporters] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api(`/api/allocation/share-rules${all ? '?all=true' : ''}`)); } catch (x) { setError(errorText(x, 'Could not load the share rules')); }
  }, [all]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => { if (me.staff) api('/api/transporters').then(r => setTransporters((r.transporters || []).filter((x: any) => x.active))).catch(() => setTransporters([])); }, []);

  async function end(r: any) {
    const reason = window.prompt(`Why does the rule ${r.ruleName} end?`);
    if (reason === null) return;
    setBusy(true); setMsg(''); setError('');
    try { await call('POST', `/api/allocation/share-rules/${r.id}/end`, { reason }); setMsg(`${r.ruleName} ended.`); await load(); }
    catch (x) { setError(errorText(x, 'Could not end the rule')); } finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Share rules</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Split className="h-8 w-8 text-sky-700" />Contract share rules</h1>
    <p className="text-slate-600">Split the loads of a lane between transporters by percent. A Manager makes and ends rules.</p>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script={SCRIPT_46} />}
    {editing && <RuleForm rule={editing} transporters={transporters} busy={busy} onCancel={() => setEditing(null)} onSave={async b => {
      setBusy(true); setMsg(''); setError('');
      try { await call(editing.id ? 'PUT' : 'POST', `/api/allocation/share-rules${editing.id ? `/${editing.id}` : ''}`, b); setMsg('Share rule saved.'); setEditing(null); await load(); }
      catch (x) { setError(errorText(x, 'Could not save the rule')); } finally { setBusy(false); }
    }} />}
    {list?.ready && <Section title="Rules" right={<div className="flex items-center gap-3">
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Show ended</label>
      {me.manager && <button onClick={() => setEditing({ lines: [] })} className={btn}>New rule</button>}</div>}>
      {list.rules.length === 0 && <p className="text-sm text-slate-500">No share rules.</p>}
      <div className="grid gap-3">{list.rules.map((r: any) => <div key={r.id} className={`rounded-xl border p-3 ${r.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><b>{r.ruleName}</b> · {r.originCity} → {r.destinationCity} · {r.validFrom} to {r.validTo} · {PERIODS.find(p => p[0] === r.period)?.[1]}{r.autoApply ? ' · gives loads by itself' : ''}{!r.active ? ' · ended' : ''}
            <div className="text-xs text-slate-500">This period {r.periodFrom} to {r.periodTo}: {r.loadsGiven} load(s) given{r.notes ? ` · ${r.notes}` : ''}</div></div>
          {me.manager && r.active && <div className="flex gap-2"><button onClick={() => setEditing(r)} className={btnLight}>Change</button><button disabled={busy} onClick={() => void end(r)} className={btnRed}>End</button></div>}
        </div>
        <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Transporter</th><th className={`${th} text-right`}>Share</th><th className={`${th} text-right`}>Given</th><th className={`${th} text-right`}>Achieved</th><th className={`${th} text-right`}>Behind by</th><th className={th}>Priority</th></tr></thead>
          <tbody>{r.lines.map((l: any) => <tr key={l.id} className="border-t">
            <td className={td}>{l.transporterName}{!l.approved && <span className="ml-1 text-xs text-red-700">(not approved: skipped)</span>}</td>
            <td className={`${td} text-right`}>{Number(l.sharePercent)}%</td><td className={`${td} text-right`}>{l.loadsGiven}</td>
            <td className={`${td} text-right`}>{l.achievedPercent == null ? '-' : `${Number(l.achievedPercent)}%`}</td>
            <td className={`${td} text-right`}>{Number(l.deficit).toFixed(2)}</td><td className={td}>{l.priority}</td></tr>)}</tbody></table>
      </div>)}</div>
    </Section>}
  </>;
}

function RuleForm({ rule, transporters, busy, onSave, onCancel }: { rule: any; transporters: any[]; busy: boolean; onSave: (b: any) => void; onCancel: () => void }) {
  const [lines, setLines] = useState<Line[]>((rule.lines || []).map((l: any) => ({ transporterId: String(l.transporterId), sharePercent: String(Number(l.sharePercent)), priority: String(l.priority ?? '') })));
  const [f, setF] = useState<any>({ ruleName: rule.ruleName || '', originCity: rule.originCity || '', destinationCity: rule.destinationCity || '', validFrom: rule.validFrom || '', validTo: rule.validTo || '',
    period: rule.period || 'MONTH', autoApply: !!rule.autoApply, notes: rule.notes || '' });
  const sum = lines.reduce((s, l) => s + (Number(l.sharePercent) || 0), 0);
  const set = (k: string, v: unknown) => setF((x: any) => ({ ...x, [k]: v }));
  const setLine = (i: number, k: keyof Line, v: string) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  return <Section title={rule.id ? `Change ${rule.ruleName}` : 'New share rule'}>
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Rule name *</label><input value={f.ruleName} onChange={e => set('ruleName', e.target.value)} className={input} /></div>
      <div><label className={label}>From city *</label><input value={f.originCity} onChange={e => set('originCity', e.target.value)} className={input} /></div>
      <div><label className={label}>To city *</label><input value={f.destinationCity} onChange={e => set('destinationCity', e.target.value)} className={input} /></div>
      <div><label className={label}>Counted</label><select value={f.period} onChange={e => set('period', e.target.value)} className={input}>{PERIODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className={label}>Valid from *</label><input type="date" value={f.validFrom} onChange={e => set('validFrom', e.target.value)} className={input} /></div>
      <div><label className={label}>Valid to *</label><input type="date" value={f.validTo} onChange={e => set('validTo', e.target.value)} className={input} /></div>
      <label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={f.autoApply} onChange={e => set('autoApply', e.target.checked)} />Give the lane's loads by itself</label>
      <div><label className={label}>Notes</label><input value={f.notes} onChange={e => set('notes', e.target.value)} className={input} /></div>
    </div>
    <h4 className="mt-3 font-bold">Transporters <span className={`text-sm ${Math.abs(sum - 100) < 0.05 ? 'text-emerald-700' : 'text-red-700'}`}>(total {sum}%, must be 100%)</span></h4>
    {lines.map((l, i) => <div key={i} className="mt-1 grid gap-2 md:grid-cols-4">
      <select value={l.transporterId} onChange={e => setLine(i, 'transporterId', e.target.value)} className={input}><option value="">Transporter</option>
        {transporters.map(t => <option key={t.id} value={t.id}>{t.name}{t.onboardingStatus !== 'APPROVED' ? ' (not approved)' : ''}</option>)}</select>
      <input type="number" min="0.01" max="100" step="0.01" value={l.sharePercent} onChange={e => setLine(i, 'sharePercent', e.target.value)} placeholder="Share %" className={input} />
      <input type="number" min="1" value={l.priority} onChange={e => setLine(i, 'priority', e.target.value)} placeholder="Priority on a tie (1 first)" className={input} />
      <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className={btnLight}>Remove</button>
    </div>)}
    <button onClick={() => setLines(ls => [...ls, { transporterId: '', sharePercent: '', priority: String(ls.length + 1) }])} className={`${btnLight} mt-2`}>Add transporter</button>
    <div className="mt-3 flex gap-2">
      <button disabled={busy || Math.abs(sum - 100) >= 0.05 || lines.some(l => !l.transporterId)} className={btn} onClick={() => onSave({ ...f,
        lines: lines.map(l => ({ transporterId: Number(l.transporterId), sharePercent: Number(l.sharePercent), priority: l.priority ? Number(l.priority) : undefined })) })}>Save rule</button>
      <button onClick={onCancel} className={btnLight}>Cancel</button></div>
  </Section>;
}
