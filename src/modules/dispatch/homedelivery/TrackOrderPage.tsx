/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-013 -- the customer's page for one home delivery order. Opens without a login from the link sent with the
// order; shows the status in plain words, the promised slot, the expected time and how many drops are before theirs,
// and reminds the customer to give the delivery code only at the door. The link stops working some days after the
// slot, or when a new link is made. Backend: GET /api/public/track/order/{token} (HomeTrackingPublicController).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Snowflake, Truck } from 'lucide-react';
import { publicApi, when } from '@/modules/tracking/telematics';
import { customerStatus, slotText } from './homeDelivery';

export function TrackOrderPage() {
  const { token } = useParams();
  const [d, setD] = useState<any>(null), [err, setErr] = useState('');

  useEffect(() => {
    let gone = false;
    const load = () => publicApi(`/api/public/track/order/${encodeURIComponent(token || '')}`)
      .then(x => { if (!gone) { setD(x); setErr(''); } })
      .catch(e => { if (!gone) { setD(null); setErr(e instanceof Error ? e.message : 'This tracking link is not valid or has expired'); } });
    void load();
    const t = window.setInterval(load, 60000);
    return () => { gone = true; window.clearInterval(t); };
  }, [token]);

  const done = d && ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(d.status);
  return <div className="min-h-screen bg-slate-50">
    <header className="bg-sky-800 px-4 py-3 text-white"><div className="mx-auto max-w-xl text-lg font-black">RefTech · Your order</div></header>
    <main className="mx-auto max-w-xl p-4">
      {err && <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-lg font-bold">{err}</p><p className="mt-2 text-slate-600">Ask the shop you ordered from for a new link.</p></div>}
      {!d && !err && <p className="mt-8 text-center text-slate-500">Loading...</p>}
      {d && <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><h1 className="text-xl font-black">Order {d.orderNo}</h1><p className="text-slate-600">from {d.from}</p></div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${d.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : d.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-800'}`}>{customerStatus(d.status)}</span>
        </div>
        <p className="mt-3 text-lg">{d.text}</p>
        <div className="mt-4 grid gap-3">
          <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-slate-500" />Delivery slot: <b>{slotText(d.slotStart, d.slotEnd)}</b></div>
          {d.deliveredAt && <div className="flex items-center gap-2"><Truck className="h-5 w-5 text-slate-500" />Delivered {when(d.deliveredAt)}</div>}
          {!done && d.etaAt && <div className="flex items-center gap-2"><Truck className="h-5 w-5 text-slate-500" />Expected around <b>{when(d.etaAt)}</b>
            {d.dropsBefore != null && <span className="text-slate-600">({d.dropsBefore} delivery(s) before yours)</span>}</div>}
          {!done && d.rider && <div className="text-slate-600">Rider: {d.rider}</div>}
          <div className="flex items-center gap-2"><Snowflake className="h-5 w-5 text-sky-600" />Kept {String(d.tempClass || 'chilled').toLowerCase().replace('_', ' ')} all the way to your door</div>
        </div>
        {!done && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Give your 6-digit delivery code to the rider only when you have the order in your hands.</p>}
      </div>}
    </main>
  </div>;
}
