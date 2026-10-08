/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge, MapPin, Snowflake, Thermometer, Truck, Wrench } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtTemp, fmtTempRange, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type FleetVehicle = {
  id:number; vehicleNumber:string; vehicleType?:string; status:string; capacityTons?:number;
  partnerName?:string; running:boolean; maintenanceReason?:string; expectedServiceReturnAt?:string;
};
type FleetSummary = { total:number; assigned:number; running:number; available:number; maintenance:number; openAlerts:number; temperatureAlerts:number; speedAlerts:number; vehicles:FleetVehicle[] };

const badge=(status:string,running:boolean)=> running ? 'RUNNING' : status;

export function VehicleFleetPanel(){
 const [open,setOpen]=useState(false); const [data,setData]=useState<FleetSummary|null>(null); const [error,setError]=useState('');
 const [detailId,setDetailId]=useState<number|null>(null); const [detail,setDetail]=useState<any>(null); const [loadingDetail,setLoadingDetail]=useState(false);
 async function load(){try{setError('');setData(await api('/api/admin/vehicles/dashboard'));}catch(e){setError(e instanceof Error?e.message:'Unable to load fleet');}}
 useEffect(()=>{load(); const timer=window.setInterval(()=>{if(open) void load();},30000); return ()=>window.clearInterval(timer);},[open]);
 async function toggleDetail(id:number){if(detailId===id){setDetailId(null);setDetail(null);return;} setDetailId(id);setLoadingDetail(true);try{setDetail(await api(`/api/admin/vehicles/${id}/live-detail`));}catch(e){setDetail({error:e instanceof Error?e.message:'Unable to load detail'});}finally{setLoadingDetail(false);}}
 const running=(data?.vehicles||[]).filter(v=>v.running);
 const others=(data?.vehicles||[]).filter(v=>!v.running);
 return <section className="mt-6 rounded-2xl bg-white shadow-sm">
  <button onClick={()=>setOpen(!open)} className="flex w-full items-center justify-between p-6 text-left">
   <div className="flex items-center gap-4"><div className="rounded-xl bg-frost-50 p-3"><Truck className="h-7 w-7 text-frost-700"/></div><div><div className="text-sm text-deep-500">Vehicle Fleet</div><div className="text-3xl font-bold text-deep-950">{data?.total??0}</div><div className="text-xs text-deep-400">Click for fleet status and live running-trip details</div></div></div>
   {open?<ChevronUp className="h-6 w-6"/>:<ChevronDown className="h-6 w-6"/>}
  </button>
  {open&&<div className="border-t p-6">
   {error&&<div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
    {[
     ['Total',data?.total??0,Truck],['Assigned',data?.assigned??0,Truck],['Running',data?.running??0,Gauge],['Available',data?.available??0,Truck],['Maintenance / Out',data?.maintenance??0,Wrench],['Open Alerts',data?.openAlerts??0,AlertTriangle]
    ].map(([l,v,I]:any)=><div key={l} className="rounded-xl border bg-deep-50 p-4"><I className="h-5 w-5 text-frost-700"/><div className="mt-2 text-xs text-deep-500">{l}</div><div className="text-2xl font-bold">{v}</div></div>)}
   </div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-amber-50 p-4"><Thermometer className="inline h-5 w-5 text-amber-700"/> <b>{data?.temperatureAlerts??0}</b> open temperature alerts</div><div className="rounded-xl bg-orange-50 p-4"><Gauge className="inline h-5 w-5 text-orange-700"/> <b>{data?.speedAlerts??0}</b> open high-speed alerts</div></div>

   <h3 className="mt-7 text-lg font-bold">Running Trucks</h3>
   {running.length===0?<p className="mt-2 text-sm text-deep-500">No vehicles are currently on a running trip.</p>:<div className="mt-3 space-y-3">{running.map(v=><VehicleRow key={v.id} v={v} expanded={detailId===v.id} onDetail={()=>toggleDetail(v.id)} detail={detail} loading={loadingDetail}/>)}</div>}

   <h3 className="mt-7 text-lg font-bold">All Other Vehicles</h3>
   <div className="mt-3 space-y-3">{others.map(v=><VehicleRow key={v.id} v={v} expanded={detailId===v.id} onDetail={()=>toggleDetail(v.id)} detail={detail} loading={loadingDetail}/>)}</div>
  </div>}
 </section>;
}

function VehicleRow({v,expanded,onDetail,detail,loading}:{v:FleetVehicle;expanded:boolean;onDetail:()=>void;detail:any;loading:boolean}){
 const state=badge(v.status,v.running); const location=detail?.currentLocation; const temp=detail?.currentTemperature; const trip=detail?.runningTrip; const alerts=detail?.alerts||[];
 const tempBad=alerts.some((a:any)=>a.alertType==='HIGH_TEMPERATURE'||a.alertType==='LOW_TEMPERATURE');
 return <div className="overflow-hidden rounded-xl border">
  <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>{v.vehicleNumber}</b><span className="ml-3 rounded-full bg-deep-100 px-2 py-1 text-xs">{state}</span><div className="mt-1 text-sm text-deep-500">{v.vehicleType||'Vehicle'} · {fmtWeight(v.capacityTons)} · {v.partnerName||'Not assigned to partner'}</div></div><button onClick={onDetail} className="rounded-lg bg-frost-700 px-4 py-2 text-sm font-semibold text-white">{expanded?'Collapse':'Details'}</button></div>
  {expanded&&<div className="border-t bg-deep-50 p-4">{loading?<p>Loading live detail…</p>:detail?.error?<p className="text-red-700">{detail.error}</p>:<>
   {trip?<><div className="grid gap-3 md:grid-cols-4"><Info label="Trip" value={`${trip.tripNumber||trip.id} (${trip.tripType||'FULL'})`}/><Info label="Route" value={`${trip.sourceCity||'-'} → ${trip.destinationCity||'-'}`}/><Info label="Required temperature" value={trip.requiredTempMinC!=null||trip.requiredTempMaxC!=null?fmtTempRange(trip.requiredTempMinC,trip.requiredTempMaxC):(trip.requiredTemperatureC==null?'-':fmtTemp(trip.requiredTemperatureC))}/><Info label="Speed limit" value={`${trip.maxSpeedKmph??80} km/h`}/></div>
    <div className="mt-3 grid gap-3 md:grid-cols-3"><div className="rounded-lg bg-white p-3"><MapPin className="h-5 w-5 text-frost-700"/><div className="mt-1 text-xs text-deep-500">Current GPS position</div>{location?<><b>{location.latitude}, {location.longitude}</b><div className="text-xs text-deep-500">Speed {location.speedKmph??'-'} km/h · {String(location.capturedAt||'')}</div><a className="mt-1 inline-block text-sm font-semibold text-frost-700" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}>Open map</a></>:<b>No GPS update yet</b>}</div>
    <div className={`rounded-lg p-3 ${tempBad?'bg-red-50':'bg-white'}`}><Thermometer className="h-5 w-5 text-frost-700"/><div className="mt-1 text-xs text-deep-500">Current temperature</div><b>{temp?fmtTemp(temp.temperatureC):'No sensor update yet'}</b>{tempBad&&<div className="mt-1 text-sm font-semibold text-red-700">Temperature outside required range</div>}</div>
    <div className="rounded-lg bg-white p-3"><AlertTriangle className="h-5 w-5 text-amber-700"/><div className="mt-1 text-xs text-deep-500">Open trip alerts</div><b>{alerts.length}</b><div className="text-xs text-deep-500">Temperature / speed</div></div></div>
    {alerts.length>0&&<div className="mt-3 space-y-2">{alerts.map((a:any)=><div key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><b>{a.alertType}</b> — {a.message} {a.measuredValue!=null&&<span>({a.measuredValue} / limit {a.thresholdValue})</span>}</div>)}</div>}
   </>:<div className="rounded-lg bg-white p-3 text-sm text-deep-600">This vehicle is not currently on a running trip.{v.maintenanceReason?` Maintenance: ${v.maintenanceReason}`:''}</div>}
  </>}</div>}
 </div>;
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-white p-3"><div className="text-xs text-deep-500">{label}</div><div className="font-semibold">{value}</div></div>}
