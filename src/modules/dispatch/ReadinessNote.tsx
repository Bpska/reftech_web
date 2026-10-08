/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-011 -- the readiness of the chosen truck under Create Trip, the board's assign dialog and the trip edit
// panel: service due, open breakdown, workshop, insurance, permit, fitness, pollution, transporter.
// "Not allowed" stops the booking; "Manager approval" lets a Manager tick "Use this truck anyway" with a reason
// (form fields readinessOverride and readinessReason, kept in the dispatch change log).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { input, label } from '@/shared/components/FormKit';
import { LEVEL_STYLE, LEVEL_TEXT, Readiness, readinessOf } from './dispatch';

export function ReadinessNote({ vehicleId, start, end, truckName, override, onOverride, reason, onReason }: {
  vehicleId?: string | number | null; start?: string; end?: string; truckName?: string;
  /** controlled, for screens without a form; leave out to use the named form fields */
  override?: boolean; onOverride?: (v: boolean) => void; reason?: string; onReason?: (v: string) => void;
}) {
  const [r, setR] = useState<Readiness | null>(null), [err, setErr] = useState('');
  useEffect(() => {
    setR(null); setErr('');
    if (!vehicleId) return;
    const t = setTimeout(() => { readinessOf(vehicleId, start || undefined, end || undefined).then(setR).catch(e => setErr(e.message || 'The readiness could not be read')); }, 300);
    return () => clearTimeout(t);
  }, [vehicleId, start, end]);
  if (!vehicleId) return null;
  if (err) return <p className="mt-1 text-xs text-slate-500">Readiness: {err}</p>;
  if (!r) return <p className="mt-1 text-xs text-slate-500">Checking the truck...</p>;
  const who = truckName || 'The truck';
  if (!r.items.length) return <p className="mt-1 text-xs text-emerald-700">{who} is ready: service, breakdown and papers are in order.</p>;
  const controlled = onOverride !== undefined;
  return <div className={`mt-2 rounded-xl p-2 text-xs ${r.refused ? 'bg-red-50 text-red-900' : r.needsApproval ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
    <b>{who}: {r.refused ? 'cannot be used.' : r.needsApproval ? 'needs a Manager\'s approval.' : 'ready, with notes.'}</b>
    <ul className="mt-1 space-y-0.5">{r.items.map((i, n) => <li key={n}><span className={`mr-1 rounded-full px-1.5 py-0.5 font-bold ${LEVEL_STYLE[i.level] || ''}`}>{LEVEL_TEXT[i.level] || i.level}</span>{i.text}</li>)}</ul>
    {r.refused && <p className="mt-1">Choose another truck, or fix it in <Link to="/maintenance" className="underline">Maintenance</Link> or the <Link to="/compliance" className="underline">Compliance Register</Link>.</p>}
    {!r.refused && r.needsApproval && (r.manager
      ? <div className="mt-2 grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 font-semibold">
          {controlled
            ? <input type="checkbox" checked={!!override} onChange={e => onOverride!(e.target.checked)} />
            : <input type="checkbox" name="readinessOverride" value="true" />}
          Use this truck anyway
        </label>
        <div><span className={label}>Reason *</span>
          {controlled
            ? <input className={input} value={reason || ''} onChange={e => onReason?.(e.target.value)} placeholder="Service booked for next week, short trip" />
            : <input className={input} name="readinessReason" placeholder="Service booked for next week, short trip" />}
        </div>
      </div>
      : <p className="mt-1">Ask a Manager to book this truck, or choose another.</p>)}
  </div>;
}
