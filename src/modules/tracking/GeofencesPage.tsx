/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-003 -- Places and Waiting: the circles (depots, warehouses, customers, rest areas) that stops are made
// from, the waiting time and detention at each stop, and the route events (arrived, left, off route, long stop).
// Staff see everything; a Manager or Admin adds and changes places.
// Backend: /api/tracking/geofences, /api/tracking/detention(.csv), /api/tracking/route-events (GeofenceController).
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPinned } from 'lucide-react';
import { api, apiDownload, currentUser } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btnLight, errorText, input, td, th } from '@/shared/components/FormKit';
import { TELEMATICS_SCRIPT, isManager, minutesText, pill, when } from './telematics';

const KIND_TEXT: Record<string, string> = { DEPOT: 'Depot', WAREHOUSE: 'Warehouse', CUSTOMER: 'Customer', REST_AREA: 'Rest area', FUEL: 'Fuel station', BORDER: 'Border / check post', OTHER: 'Other' };
const EVENT_TEXT: Record<string, [string, 'green' | 'amber' | 'red' | 'grey' | 'blue']> = {
  ENTER: ['Arrived at stop', 'green'], EXIT: ['Left stop', 'blue'], OFF_ROUTE: ['Off the route', 'red'], BACK_ON_ROUTE: ['Back on the route', 'green'],
  STOPPED: ['Long stop', 'amber'], MOVING: ['Moving again', 'green'],
};
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 5.5 * 3600000 - n * 86400000).toISOString().slice(0, 10);

export function GeofencesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'places';
  const manager = isManager(currentUser());
  const [places, setPlaces] = useState<any>(null), [partners, setPartners] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null), [adding, setAdding] = useState(false);
  const [det, setDet] = useState<any>(null), [from, setFrom] = useState(daysAgo(30)), [to, setTo] = useState(today()), [only, setOnly] = useState(false);
  const [events, setEvents] = useState<any[]>([]), [type, setType] = useState(''), [days, setDays] = useState(7);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const loadPlaces = useCallback(() => api('/api/tracking/geofences').then(setPlaces).catch(e => setErr(errorText(e, 'Could not load the places'))), []);
  const loadDet = useCallback(() => api(`/api/tracking/detention?from=${from}&to=${to}&only=${only}`).then(setDet).catch(e => setErr(errorText(e, 'Could not load waiting times'))), [from, to, only]);
  const loadEvents = useCallback(() => api(`/api/tracking/route-events?days=${days}${type ? `&type=${type}` : ''}`).then(x => setEvents(Array.isArray(x) ? x : [])).catch(e => setErr(errorText(e, 'Could not load the events'))), [days, type]);
  useEffect(() => { void loadPlaces(); api('/api/operations/partners').then(x => setPartners(Array.isArray(x) ? x : [])).catch(() => setPartners([])); }, [loadPlaces]);
  useEffect(() => { if (tab === 'waiting') void loadDet(); }, [tab, loadDet]);
  useEffect(() => { if (tab === 'events') void loadEvents(); }, [tab, loadEvents]);

  async function save(values: Record<string, unknown>) {
    setBusy(true); setMsg(''); setErr('');
    try {
      const body = { ...values, partnerId: values.partnerId || null, freeMinutes: values.freeMinutes === '' ? null : values.freeMinutes };
      await api(editing ? `/api/tracking/geofences/${editing.id}` : '/api/tracking/geofences', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setMsg(`Place ${values.name} saved.`); setEditing(null); setAdding(false); await loadPlaces();
    } catch (e) { setErr(errorText(e, 'Not saved')); } finally { setBusy(false); }
  }

  if (places && places.ready === false) return <NotReady script={TELEMATICS_SCRIPT} />;
  const tabBtn = (k: string, text: string) => <button key={k} type="button" onClick={() => { setParams({ tab: k }); setMsg(''); setErr(''); }}
    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === k ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{text}</button>;
  const fields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'kind', label: 'Kind', type: 'select' as const, required: true, options: Object.entries(KIND_TEXT) as [string, string][] },
    { name: 'partnerId', label: 'Customer (for a customer place)', type: 'select' as const, options: partners.map(p => [p.id, p.name] as [number, string]) },
    { name: 'coordinates', label: 'Position (latitude, longitude)', required: true, placeholder: '20.2961, 85.8245', hint: 'Right-click the place in Google Maps and copy the numbers.' },
    { name: 'radiusM', label: 'Circle radius (metres)', type: 'number' as const, hint: '50 to 5000. 500 suits most yards.' },
    { name: 'freeMinutes', label: 'Free waiting time (minutes)', type: 'number' as const, hint: `Empty = ${places?.defaultFreeMinutes ?? 120} minutes. Waiting beyond it is detention.` },
    { name: 'address', label: 'Address', wide: true },
    { name: 'active', label: 'In use', type: 'checkbox' as const },
  ];
  const initial = editing ? { ...editing, coordinates: `${editing.latitude}, ${editing.longitude}` } : { kind: 'CUSTOMER', radiusM: 500, active: true };

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><MapPinned className="h-8 w-8 text-sky-700" />Places and Waiting</h1>
    <p className="text-slate-600">A circle around each depot, warehouse and customer. A truck entering a stop's circle is marked arrived; leaving it ends the visit. Waiting beyond the free time is detention.</p>
    <div className="mt-4 flex flex-wrap gap-2">{tabBtn('places', 'Places')}{tabBtn('waiting', 'Waiting and detention')}{tabBtn('events', 'Route events')}</div>
    <Banner msg={msg} error={err} />

    {tab === 'places' && <Section title="Places" right={manager && !adding && !editing ? <button className={btnLight} onClick={() => setAdding(true)}>Add a place</button> : undefined}>
      {(adding || editing) && <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
        <h3 className="mb-2 font-bold">{editing ? `Change ${editing.name}` : 'New place'}</h3>
        <QuickForm key={editing?.id ?? 'new'} fields={fields} initial={initial} busy={busy} submitText="Save" onSubmit={save} onCancel={() => { setAdding(false); setEditing(null); }} />
      </div>}
      {!places ? <p className="text-slate-500">Loading...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Name</th><th className={th}>Kind</th><th className={th}>Customer</th><th className={th}>Position</th><th className={th}>Radius</th><th className={th}>Free time</th><th className={th}>State</th><th className={th}></th></tr></thead>
        <tbody>
          {(places.places || []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No place yet. {manager ? 'Add the depots and the customers you deliver to.' : 'A Manager adds them.'}</td></tr>}
          {(places.places || []).map((g: any) => <tr key={g.id} className="border-t border-slate-200">
            <td className={td}><b>{g.name}</b>{g.address && <div className="text-xs text-slate-500">{g.address}</div>}</td>
            <td className={td}>{KIND_TEXT[g.kind] || g.kind}</td>
            <td className={td}>{g.partnerName || '-'}</td>
            <td className={td}><a className="text-sky-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${g.latitude},${g.longitude}`}>{Number(g.latitude).toFixed(5)}, {Number(g.longitude).toFixed(5)}</a></td>
            <td className={td}>{g.radiusM} m</td>
            <td className={td}>{g.freeMinutes != null ? minutesText(g.freeMinutes) : `standard (${minutesText(places.defaultFreeMinutes)})`}</td>
            <td className={td}>{g.active ? pill('green', 'In use') : pill('grey', 'Not used')}</td>
            <td className={td}>{manager && <button className="text-sm font-semibold text-sky-700 hover:underline" onClick={() => { setEditing(g); setAdding(false); }}>Change</button>}</td>
          </tr>)}
        </tbody>
      </table></div>}
    </Section>}

    {tab === 'waiting' && <Section title="Waiting and detention at stops" right={<button className={btnLight} onClick={() => apiDownload(`/api/tracking/detention.csv?from=${from}&to=${to}&only=${only}`, `detention-${from}-to-${to}.csv`).catch(e => setErr(errorText(e, 'Not downloaded')))}>CSV</button>}>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-sm">
        <label>From<input type="date" className={`${input} block`} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To<input type="date" className={`${input} block`} value={to} onChange={e => setTo(e.target.value)} /></label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} />Only visits with detention</label>
      </div>
      {!det ? <p className="text-slate-500">Loading...</p> : <>
        <p className="mb-2 text-sm"><b>{(det.visits || []).length}</b> visits, waiting <b>{minutesText(det.totalWaitingMinutes)}</b>, detention <b className="text-red-700">{minutesText(det.totalDetentionMinutes)}</b>.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Customer</th><th className={th}>Stop</th><th className={th}>Arrived</th><th className={th}>Left</th><th className={th}>Waiting</th><th className={th}>Free</th><th className={th}>Detention</th></tr></thead>
          <tbody>
            {(det.visits || []).length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-400">No visit in these days.</td></tr>}
            {(det.visits || []).map((v: any) => <tr key={v.id} className="border-t border-slate-200">
              <td className={td}><Link to={`/trips/${v.tripId}`} className="text-sky-700 hover:underline">{v.tripNumber}</Link></td>
              <td className={td}>{v.vehicleNumber || '-'}</td>
              <td className={td}>{v.partnerName || '-'}</td>
              <td className={td}>{v.stopName}<div className="text-xs text-slate-500">{v.stopType}</div></td>
              <td className={td}>{when(v.arrivedAt)}</td>
              <td className={td}>{v.ongoing ? pill('amber', 'Still there') : when(v.departedAt)}</td>
              <td className={td}>{minutesText(v.dwellMinutes)}</td>
              <td className={td}>{minutesText(v.freeMinutes)}</td>
              <td className={td}>{Number(v.detentionMinutes) > 0 ? <b className="text-red-700">{minutesText(v.detentionMinutes)}</b> : '-'}</td>
            </tr>)}
          </tbody>
        </table></div>
      </>}
    </Section>}

    {tab === 'events' && <Section title="Route events">
      <div className="mb-3 flex flex-wrap items-end gap-3 text-sm">
        <label>Kind<select className={`${input} block`} value={type} onChange={e => setType(e.target.value)}>
          <option value="">All</option>{Object.entries(EVENT_TEXT).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label>Last<select className={`${input} block`} value={days} onChange={e => setDays(Number(e.target.value))}>
          {[1, 7, 30, 90].map(n => <option key={n} value={n}>{n} day{n === 1 ? '' : 's'}</option>)}</select></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>When</th><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Event</th><th className={th}>Details</th><th className={th}>Where</th></tr></thead>
        <tbody>
          {events.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No event.</td></tr>}
          {events.map(e => { const [t, tone] = EVENT_TEXT[e.eventType] || [e.eventType, 'grey']; return <tr key={e.id} className="border-t border-slate-200">
            <td className={td}>{when(e.at)}</td>
            <td className={td}><Link to={`/trips/${e.tripId}`} className="text-sky-700 hover:underline">{e.tripNumber}</Link></td>
            <td className={td}>{e.vehicleNumber || '-'}</td>
            <td className={td}>{pill(tone, t)}</td>
            <td className={td}>{e.detail || '-'}</td>
            <td className={td}>{e.latitude != null ? <a className="text-sky-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}>map</a> : '-'}</td>
          </tr>; })}
        </tbody>
      </table></div>
    </Section>}
  </>;
}
