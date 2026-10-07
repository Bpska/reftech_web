/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-010 -- every truck change on the road: waiting for approval, approved and waiting for the handover, done.
// A change is asked and worked on the trip's page (TransshipmentPanel).
//
// Backend: TransshipmentController (/api/dispatch/transshipments).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, errorText, td, th } from '@/shared/components/FormKit';
import { role } from '@/modules/transporter/transporter';
import { when } from '@/modules/allocation/allocation';
import { REASONS, SCRIPT_46, TRANSSHIP_LABEL, pill } from '@/modules/tender/tender';

export function TransshipmentsPage() {
  const me = role();
  const [status, setStatus] = useState('OPEN');
  const [d, setD] = useState<any>(null), [error, setError] = useState('');
  useEffect(() => { if (me.staff) api(`/api/dispatch/transshipments?status=${status}`).then(setD).catch(x => setError(errorText(x, 'Could not load'))); }, [status]);
  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Truck changes</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ArrowLeftRight className="h-8 w-8 text-sky-700" />Truck changes on the road</h1>
    <p className="text-slate-600">Breakdown replacement and transshipment. Ask for one from the trip's page.</p>
    <Banner error={error} />
    {d && !d.ready && <NotReady script={SCRIPT_46} />}
    {d?.ready && <Section title="Truck changes" right={<select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
      <option value="OPEN">Not done yet</option><option value="DONE">Done</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option><option value="ALL">All</option></select>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Change</th><th className={th}>Trip</th><th className={th}>Reason</th><th className={th}>Trucks</th><th className={th}>Status</th><th className={th}>Asked</th></tr></thead>
        <tbody>{d.transshipments.map((x: any) => <tr key={x.id} className="border-t">
          <td className={td}><b>{x.transshipNo}</b></td>
          <td className={td}><Link to={`/trips/${x.tripId}`} className="font-semibold text-sky-700 hover:underline">{x.tripNumber}</Link></td>
          <td className={td}>{REASONS.find(r => r[0] === x.reason)?.[1]}<div className="text-xs text-slate-500">{x.reasonNote}</div></td>
          <td className={td}>{x.oldVehicleNumber} → <b>{x.newVehicleNumber}</b>{x.tempInRange === false && <div className="text-xs text-red-700">temperature out of range at handover</div>}</td>
          <td className={td}><span className={pill(x.status)}>{TRANSSHIP_LABEL[x.status] || x.status}</span>{x.ewayStatus && <div className="text-xs">e-way: {String(x.ewayStatus).replace(/_/g, ' ').toLowerCase()}</div>}</td>
          <td className={td}>{when(x.requestedAt)}<div className="text-xs text-slate-500">{x.requestedByName}</div></td>
        </tr>)}
          {d.transshipments.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>None.</td></tr>}</tbody></table></div>
    </Section>}
  </>;
}
