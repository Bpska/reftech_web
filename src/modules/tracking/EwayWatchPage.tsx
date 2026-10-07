/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-009 -- E-way Bill Watch: the e-way bills of the running trips, soonest to end first, with the time left,
// whether the validity ends before the truck arrives, and whether the bill names the trip's truck. An alert goes to
// the Control Tower 8 hours before the end (HIGH from 2 hours). After extending on the e-way bill portal, record it
// here; the alert closes by itself. Staff only.
// Backend: GET /api/tracking/eway-watch (EwayWatchController); extend and vehicle change use
// POST /api/billing/gst/eway-bills/{id}/extend and /vehicle (GstController).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileClock } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, td, th } from '@/shared/components/FormKit';
import { TELEMATICS_SCRIPT, minutesText, pill, when } from './telematics';

const STATE: Record<string, ['green' | 'amber' | 'red' | 'grey', string]> = {
  OK: ['green', 'Valid'], EXPIRING: ['amber', 'Ending soon'], URGENT: ['red', 'Ending very soon'], EXPIRED: ['red', 'Expired'], NO_VALIDITY: ['grey', 'No validity entered'],
};

export function EwayWatchPage() {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ id: number; what: 'extend' | 'vehicle' } | null>(null);
  const load = useCallback(() => api('/api/tracking/eway-watch').then(setD).catch(e => setErr(errorText(e, 'Could not load the e-way bills'))), []);
  useEffect(() => { void load(); const t = window.setInterval(() => { void load(); }, 120000); return () => window.clearInterval(t); }, [load]);

  async function submit(e: FormEvent<HTMLFormElement>, b: any) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await api(`/api/billing/gst/eway-bills/${b.id}/${open?.what}`, { method: 'POST', body: JSON.stringify(f) });
      setMsg(open?.what === 'extend' ? `E-way bill ${b.ewayBillNo} recorded as extended till ${when(r.validUntil)}. The alert closes at the next check.` : `E-way bill ${b.ewayBillNo} now names ${r.vehicleNumber}.`);
      setOpen(null); await load();
    } catch (x) { setErr(errorText(x, 'Not saved')); } finally { setBusy(false); }
  }

  if (d && d.ready === false) return <NotReady script={TELEMATICS_SCRIPT} />;
  const bills: any[] = d?.bills || [];
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><FileClock className="h-8 w-8 text-sky-700" />E-way Bill Watch</h1>
    <p className="text-slate-600">E-way bills of the running trips. The portal allows extension from 8 hours before to 8 hours after the end. An alert is raised {d?.warnHours ?? 8} hours before the end.</p>
    <Banner msg={msg} error={err} />
    {d && !d.billingReady && <p className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">The e-way bill table is not in reftech_billing yet (database_v2/45_finance_billing_reftech_billing.sql).</p>}
    <Section title="E-way bills of running trips">
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>E-way bill</th><th className={th}>Valid till</th><th className={th}>State</th><th className={th}>Truck</th><th className={th}>Arrival</th><th className={th}></th></tr></thead>
        <tbody>
          {bills.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">{d ? 'No running trip has an active e-way bill.' : 'Loading...'}</td></tr>}
          {bills.map(b => { const [tone, text] = STATE[b.state] || ['grey', b.state]; return [
            <tr key={b.id} className="border-t border-slate-200">
              <td className={td}><Link to={`/trips/${b.tripId}`} className="font-semibold text-sky-700 hover:underline">{b.tripNumber}</Link></td>
              <td className={td}>{b.ewayBillNo || '-'}{Number(b.extensionCount) > 0 && <div className="text-xs text-slate-500">extended {b.extensionCount}x</div>}</td>
              <td className={td}>{when(b.validUntil)}<div className="text-xs text-slate-500">{b.minutesLeft == null ? '' : b.minutesLeft > 0 ? `${minutesText(b.minutesLeft)} left` : `ended ${minutesText(-b.minutesLeft)} ago`}</div></td>
              <td className={td}>{pill(tone, text)}{b.canExtendNow && <div className="mt-1 text-xs font-semibold text-sky-800">Can be extended now</div>}</td>
              <td className={td}>{b.truckMatches ? b.vehicleNumber || b.tripVehicleNumber : <span className="font-semibold text-red-700">Bill: {b.vehicleNumber}, trip: {b.tripVehicleNumber}</span>}</td>
              <td className={td}>{b.etaAt ? when(b.etaAt) : '-'}{b.endsBeforeArrival && <div className="text-xs font-semibold text-red-700">Ends before the truck arrives</div>}{b.suggestedRemainingKm != null && <div className="text-xs text-slate-500">about {b.suggestedRemainingKm} km to go</div>}</td>
              <td className={`${td} text-right`}><div className="flex justify-end gap-1">
                <button className={btnLight} onClick={() => setOpen({ id: b.id, what: 'extend' })}>Record extension</button>
                {!b.truckMatches && <button className={btnLight} onClick={() => setOpen({ id: b.id, what: 'vehicle' })}>Record truck change</button>}
              </div></td>
            </tr>,
            open?.id === b.id && <tr key={`${b.id}-f`} className="bg-sky-50/50"><td colSpan={7} className="p-3">
              {open?.what === 'extend' && <p className="mb-2 text-sm text-slate-700">First extend it on the e-way bill portal (e-Waybill, Extend Validity) with the reason, the place now and the distance still to go. Then record the same here.</p>}
              <form onSubmit={e => submit(e, b)} className="flex flex-wrap items-end gap-3 text-sm">
                {open?.what === 'extend' ? <>
                  <label>Distance still to go (km) *<input name="remainingKm" type="number" min={1} required defaultValue={b.suggestedRemainingKm ?? ''} className={`${input} block w-40`} /></label>
                  <label>Reason *<select name="reason" required className={`${input} block`}><option>Natural calamity</option><option>Law and order</option><option>Transshipment</option><option>Accident</option><option>Breakdown</option><option>Other</option></select></label>
                  <label>Truck now<input name="vehicleNumber" defaultValue={b.tripVehicleNumber || ''} className={`${input} block w-40`} /></label>
                </> : <>
                  <label>New truck *<input name="vehicleNumber" required defaultValue={b.tripVehicleNumber || ''} className={`${input} block w-40`} /></label>
                  <label className="min-w-[16rem]">Why<input name="reason" className={`${input} block`} placeholder="Transshipment after breakdown" /></label>
                </>}
                <button disabled={busy} className={btn}>Save</button>
                <button type="button" className={btnLight} onClick={() => setOpen(null)}>Cancel</button>
              </form>
            </td></tr>,
          ]; })}
        </tbody>
      </table></div>
    </Section>
    {(d?.tripsWithoutBill || []).length > 0 && <Section title="Running trips without an e-way bill in RefTech">
      <p className="mb-2 text-sm text-slate-600">Goods over ₹50,000 moving by road need one. Add it under Billing, GST, E-way bills, or ignore this list when the goods do not need one.</p>
      <ul className="grid gap-1 text-sm md:grid-cols-3">{d.tripsWithoutBill.map((t: any) => <li key={t.tripId}><Link to={`/trips/${t.tripId}`} className="text-sky-700 hover:underline">{t.tripNumber}</Link> · {t.vehicleNumber} · to {t.to}</li>)}</ul>
    </Section>}
  </>;
}
