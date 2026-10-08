/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-006 -- the customer's tracking page. Opens without a login from the link RefTech shares; shows one
// shipment: where the truck is, the route so far, the expected arrival, the drops and (when chosen) the temperature
// and the driver. The link stops working some hours after delivery, when its end date passes or when it is stopped.
// Backend: GET /api/public/track/{token} (TrackingLinkController).
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Phone, Thermometer, Truck } from 'lucide-react';
import { MapMarker, MapPoint } from '@/shared/services/liveMap';
import { RouteMap } from './RouteMap';
import { num, publicApi, sourceText, when } from './telematics';
import { fmtDistance, fmtTemp, fmtTempRange, fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const STAGE: Record<string, string> = { PLANNED: 'Planned', LOADING: 'Loading', IN_TRANSIT: 'On the way', AT_DELIVERY: 'At the delivery point', DELIVERED: 'Delivered', COMPLETED: 'Delivered' };

export function PublicTrackingPage() {
  const { token } = useParams();
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let gone = false;
    const load = () => publicApi(`/api/public/track/${encodeURIComponent(token || '')}`)
      .then(x => { if (!gone) { setD(x); setErr(''); setAt(new Date()); } })
      .catch(e => { if (!gone) { setD(null); setErr(e instanceof Error ? e.message : 'This tracking link is not valid or has expired'); } });
    void load();
    const t = window.setInterval(load, 60000);
    return () => { gone = true; window.clearInterval(t); };
  }, [token]);

  const route: MapPoint[] = useMemo(() => (d?.route || []).map((p: number[]) => [Number(p[0]), Number(p[1])] as MapPoint), [d]);
  const markers: MapMarker[] = useMemo(() => d?.position ? [{ id: 1, lat: Number(d.position.lat), lng: Number(d.position.lng), colour: '#0369a1', label: 'T', title: `Truck at ${when(d.position.at)}`, selected: true }] : [], [d]);
  const temp = d?.temperature;
  const latest = temp?.latest ? Number(temp.latest.c) : null;
  const out = latest != null && ((temp.max != null && latest > Number(temp.max)) || (temp.min != null && latest < Number(temp.min)));

  return <div className="min-h-screen bg-slate-50">
    <header className="bg-sky-800 px-4 py-3 text-white"><div className="mx-auto max-w-5xl text-lg font-black">RefTech · Shipment tracking</div></header>
    <main className="mx-auto max-w-5xl p-4">
      {err && <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-lg font-bold">{err}</p><p className="mt-2 text-slate-600">Ask RefTech for a new link if you still need to follow this shipment.</p></div>}
      {!d && !err && <p className="mt-8 text-center text-slate-500">Loading...</p>}
      {d && <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">{d.tripNumber}</h1>
            <p className="text-slate-600">{d.customer ? `${d.customer} · ` : ''}{d.from} to {d.to}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${d.stage === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{STAGE[d.stage] || d.stage}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-1 text-sm text-slate-500"><Truck className="h-4 w-4" />Expected arrival</div>
            <div className="text-lg font-bold">{d.deliveredAt ? `Delivered ${when(d.deliveredAt)}` : d.arrival?.etaAt ? when(d.arrival.etaAt) : d.promisedAt ? `Planned ${when(d.promisedAt)}` : '-'}</div>
            {d.arrival?.distanceKm != null && !d.deliveredAt && <div className="text-sm text-slate-600">About {fmtDistance(d.arrival.distanceKm)} to go</div>}</div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />Last position</div>
            <div className="text-lg font-bold">{d.position ? when(d.position.at) : 'Not yet'}</div>
            {d.position && <div className="text-sm text-slate-600">From the {sourceText(d.position.source)}</div>}</div>
          {temp && <div className={`rounded-2xl p-4 shadow-sm ${out ? 'bg-red-50' : 'bg-white'}`}><div className="flex items-center gap-1 text-sm text-slate-500"><Thermometer className="h-4 w-4" />Temperature</div>
            <div className={`text-lg font-bold ${out ? 'text-red-700' : 'text-emerald-700'}`}>{latest != null ? `${fmtTemp(latest)}` : 'No reading yet'}</div>
            <div className="text-sm text-slate-600">{temp.min != null || temp.max != null ? `Allowed ${fmtTempRange(temp.min, temp.max)}` : temp.target != null ? `Target ${fmtTemp(temp.target)}` : ''}{temp.latest ? `, read ${when(temp.latest.at)}` : ''}</div></div>}
        </div>
        <div className="mt-4"><RouteMap route={route} markers={markers} fitKey={route.length > 0 ? 'r' : 'p'} /></div>
        {(d.drops || []).length > 0 && <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Drops</h2>
          <ul className="mt-2 divide-y text-sm">{d.drops.map((x: any) => <li key={x.sequence} className="flex justify-between py-2"><span>{x.sequence}. {x.party || '-'}</span>
            <span className={x.status === 'DELIVERED' ? 'font-semibold text-emerald-700' : 'text-slate-600'}>{x.status === 'DELIVERED' ? `Delivered ${when(x.deliveredAt)}` : 'To deliver'}</span></li>)}</ul>
        </section>}
        {d.driver && <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm text-sm">
          <h2 className="text-lg font-bold">Driver</h2>
          <p className="mt-1">{d.driver.name || '-'}{d.driver.mobile && <> · <a className="inline-flex items-center gap-1 font-semibold text-sky-700" href={`tel:${d.driver.mobile}`}><Phone className="h-4 w-4" />{d.driver.mobile}</a></>}</p>
        </section>}
        <p className="mt-4 text-xs text-slate-500">Updated {at ? fmtTime(at) : '-'}; the page refreshes every minute. This link works until {when(d.linkValidUntil)}.</p>
      </>}
    </main>
  </div>;
}
