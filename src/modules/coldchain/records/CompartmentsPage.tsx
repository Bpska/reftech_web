/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-012 -- Compartment Temperatures: every running or planned trip of a multi-temperature truck, with the live
// temperature of each compartment against its own range. A compartment out of range raises its own alert (and a
// quality hold on the goods in it), separate from the other compartments. Open a trip for the graph per
// compartment; the proof certificate per compartment is on Cold-Chain Proof.
// A Partner login sees its own trips only. Devices send readings to /api/coldchain/compartments/readings
// (or with the compartment sensor code to the normal temperature address).
// Backend: /api/coldchain/compartments (CompartmentTemperatureController). Needs database_v2/66_cold_chain_records.sql.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, btnLight, errorText } from '@/shared/components/FormKit';
import { SCRIPT66, at, notReady, temp } from './records';
import { Pill, Tiles } from './ui';
import { CompartmentTempsPanel } from './CompartmentTempsPanel';

export function CompartmentsPage() {
  const [data, setData] = useState<any>(null), [err, setErr] = useState(''), [open, setOpen] = useState<number | null>(null);
  const load = () => api('/api/coldchain/compartments/board').then(setData).catch(e => setErr(errorText(e, 'The compartments could not be read.')));
  useEffect(() => { void load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  if (notReady(data)) return <><h1 className="text-3xl font-bold">Compartment Temperatures</h1><NotReady script={data.script || SCRIPT66} /></>;
  const trips: any[] = data?.trips || [];
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Layers />Compartment Temperatures</h1>
        <p className="text-slate-600">Trucks with more than one temperature compartment. Each compartment is checked against its own range; the page refreshes every minute.</p>
      </div>
      <button className={btnLight} onClick={load}>Refresh</button>
    </div>
    <Banner error={err} />
    <Tiles items={[['Trips', trips.length], ['Compartments out of range', data?.outOfRange ?? 0, data?.outOfRange ? 'OUT_OF_RANGE' : undefined], ['No reading for ' + (data?.staleMinutes ?? 30) + ' min', data?.stale ?? 0, data?.stale ? 'STALE' : undefined]]} />
    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!data ? <p className="text-slate-500">Loading...</p> : !trips.length ? <p className="text-slate-500">No running or planned trip uses a truck with compartments. Add the compartments to the truck in Dispatch Setup, with the sensor code of each.</p> :
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Trip</th><th>Truck</th><th>Route</th><th>Compartments</th><th /></tr></thead>
          <tbody>{trips.map(t => <tr key={t.id} className={`border-t align-top ${open === t.id ? 'bg-sky-50' : ''}`}>
            <td className="p-2 font-semibold"><Link to={`/trips/${t.id}`} className="text-sky-700 hover:underline">{t.tripNumber}</Link><div className="text-xs font-normal text-slate-500">{t.status} · {t.partnerName || '-'}</div></td>
            <td>{t.vehicleNumber}</td><td>{t.from || '-'} → {t.to || '-'}</td>
            <td><div className="flex flex-wrap gap-2">{(t.compartments || []).map((c: any) => <div key={c.id} className="rounded-xl border border-slate-200 px-2 py-1">
              <div className="text-xs font-semibold">{c.code}</div>
              <div className="font-bold">{temp(c.currentC)}{c.sensorFlag ? <span title="Sensor calibration overdue" className="ml-1 text-amber-600">▲</span> : null}</div>
              <div className="text-xs text-slate-500">{temp(c.minC)} to {temp(c.maxC)}</div>
              <Pill state={c.state} />{c.readAt ? <div className="text-[11px] text-slate-500">{at(c.readAt)}</div> : null}
            </div>)}</div></td>
            <td className="p-2"><button className={btnLight} onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Close' : 'Open'}</button></td>
          </tr>)}</tbody>
        </table>}
    </section>
    {open !== null && <CompartmentTempsPanel tripId={open} title={`Compartments of ${trips.find(t => t.id === open)?.tripNumber || 'the trip'}`} />}
    <p className="mt-4 text-xs text-slate-500">A certificate per compartment: Trip &gt; Cold-Chain Proof, choose the compartment.</p>
  </>;
}
