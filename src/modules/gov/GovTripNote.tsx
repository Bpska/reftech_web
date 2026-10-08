/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-009, 015 -- the government check under Create Trip: Parivahan papers, permit and tax for the states of the
// trip, blacklisting, open challans, the driver's licence, the FASTag (status, balance against the tolls of the lane),
// black spots and no-entry hours. "Not allowed" stops the trip; "Manager approval" lets a Manager tick
// "Approve the government check" with a reason (form fields govOverride and govReason, kept with the trip).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/services/api';
import { input, label } from '@/shared/components/FormKit';
import { iso, sourceText } from './gov';

const LEVEL: Record<string, [string, string]> = {
  REFUSE: ['Not allowed', 'bg-red-200 text-red-900'], APPROVAL: ['Manager approval', 'bg-amber-200 text-amber-900'], WARN: ['Note', 'bg-sky-200 text-sky-900'],
};

export function GovTripNote({ vehicleId, driverId, source, destination, start, arrive }: {
  vehicleId?: string | number | null; driverId?: string | number | null; source?: string; destination?: string; start?: string; arrive?: string;
}) {
  const [r, setR] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => {
    setR(null); setErr('');
    if (!vehicleId && !driverId) return;
    const q = new URLSearchParams();
    if (vehicleId) q.set('vehicleId', String(vehicleId));
    if (driverId) q.set('driverId', String(driverId));
    if (source) q.set('source', source);
    if (destination) q.set('destination', destination);
    if (start) q.set('start', iso(start));
    if (arrive) q.set('arrive', iso(arrive));
    const t = setTimeout(() => { api(`/api/gov/trip-check?${q}`).then(setR).catch(e => setErr(e.message || 'The government check could not be read')); }, 400);
    return () => clearTimeout(t);
  }, [vehicleId, driverId, source, destination, start, arrive]);
  if (!vehicleId && !driverId) return null;
  if (err) return <p className="mt-1 text-xs text-slate-500">Government check: {err}</p>;
  if (!r) return <p className="mt-1 text-xs text-slate-500">Checking the government records...</p>;
  if (r.ready === false) return null;
  const items: any[] = r.items || [];
  const states = (r.states || []).length ? ` States on the route: ${r.states.join(', ')}.` : '';
  if (!items.length) return <p className="mt-2 text-xs text-emerald-700">Government check: nothing found.{states}</p>;
  return <div className={`mt-2 rounded-xl p-2 text-xs ${r.refused ? 'bg-red-50 text-red-900' : r.needsApproval ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
    <b>Government check: {r.refused ? 'the trip cannot be created.' : r.needsApproval ? 'needs a Manager\'s approval.' : 'allowed, with notes.'}</b>{states}
    <ul className="mt-1 space-y-0.5">{items.map((i, n) => <li key={n}><span className={`mr-1 rounded-full px-1.5 py-0.5 font-bold ${LEVEL[i.level]?.[1] || ''}`}>{LEVEL[i.level]?.[0] || i.level}</span>{i.text}{i.source ? <span className="text-slate-500"> ({sourceText(i.source)})</span> : null}</li>)}</ul>
    {r.refused && <p className="mt-1">Choose another truck or driver, or fix it in <Link to="/gov/vehicles" className="underline">Truck Records</Link>, <Link to="/gov/licences" className="underline">Driving Licences</Link> or <Link to="/gov/tolls" className="underline">FASTag</Link>.</p>}
    {!r.refused && r.needsApproval && (r.canApprove
      ? <div className="mt-2 grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="govOverride" value="true" />Approve the government check</label>
        <div><span className={label}>Reason (at least {r.minReasonLength || 10} letters) *</span><input className={input} name="govReason" placeholder="Permit renewal applied, receipt in the cab" /></div>
      </div>
      : <p className="mt-1">Ask a Manager to create this trip.</p>)}
  </div>;
}
