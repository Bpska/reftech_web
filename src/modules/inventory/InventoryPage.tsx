/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import {FormEvent,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api,currentUser} from '@/shared/services/api';
import {Building2,Plus,Snowflake,Truck} from 'lucide-react';
import { COMMON_UNIT_FIELDS, fmtTempRange, fmtWeight, toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
export function InventoryPage(){
 const u=currentUser(), role=String(u.role||u.roleCode||'').replace('ROLE_','').toUpperCase(); const admin=role==='ADMIN', manager=role==='MANAGER';
 const [data,setData]=useState<any>({partners:[],warehouses:[],chambers:[],vehicles:[]}),[msg,setMsg]=useState('');
 const load=()=>api('/api/operations/inventory/summary').then(setData).catch((e:any)=>setMsg(e.message)); useEffect(()=>{void load()},[]);
 async function addChamber(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/chambers',{method:'POST',body:JSON.stringify(toBaseFields(Object.fromEntries(new FormData(f)), COMMON_UNIT_FIELDS))});f.reset();setMsg('Chamber added');load()}catch(x:any){setMsg(x.message)}}
 const assignedVehicles=(data.vehicles||[]).filter((x:any)=>x.assignedPartnerId), availableVehicles=(data.vehicles||[]).filter((x:any)=>!x.assignedPartnerId);
 const card='rounded-2xl bg-white p-5 shadow-sm';
 return <>
 <h1 className="text-3xl font-bold">Inventory</h1><p className="text-slate-500">Warehouses, cold chambers and available vehicles. Partners are managed on their own page.</p>{msg&&<div className="my-4 rounded-xl bg-blue-50 p-3">{msg}</div>}
 <div className="mt-6 grid gap-5 lg:grid-cols-2">
 <section id="warehouses" className={card}><h2 className="flex items-center gap-2 text-xl font-bold"><Building2/>Warehouses ({data.warehouses?.length||0})</h2><div className="mt-3 space-y-2">{data.warehouses?.map((x:any)=><div key={x.id} className="rounded-xl border p-3"><b>{x.name}</b><span className="ml-2 text-sm text-slate-500">{x.city||''} {x.state||''}</span></div>)}</div>{(admin||manager)&&<Link to="/admin/warehouses" className="mt-4 inline-flex font-semibold text-sky-700">Add / Manage Warehouses →</Link>}</section>
 <section id="chambers" className={card}><h2 className="flex items-center gap-2 text-xl font-bold"><Snowflake/>Cold Chambers ({data.chambers?.length||0})</h2><div className="mt-3 space-y-2">{data.chambers?.map((x:any)=><div key={x.id} className="flex items-center rounded-xl border p-3"><div className="flex-1"><b>{x.name}</b><div className="text-sm text-slate-500">{x.warehouseName} · {fmtTempRange(x.minTemperatureC,x.maxTemperatureC)}</div></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">{x.status}</span></div>)}</div>{admin&&<form onSubmit={addChamber} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-2"><select name="warehouseId" required className="rounded-lg border p-2"><option value="">Warehouse</option>{data.warehouses?.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select><input name="chamberCode" required placeholder="Chamber code" className="rounded-lg border p-2"/><input name="name" required placeholder="Chamber name" className="rounded-lg border p-2"/><input name="capacityTons" type="number" step="any" placeholder={`Capacity ${unitNow('weight')}`} className="rounded-lg border p-2"/><input name="minTemperatureC" type="number" step="any" placeholder={`Min ${unitNow('temp')}`} className="rounded-lg border p-2"/><input name="maxTemperatureC" type="number" step="any" placeholder={`Max ${unitNow('temp')}`} className="rounded-lg border p-2"/><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 p-2 font-semibold text-white"><Plus className="h-4 w-4"/>Add Chamber</button></form>}</section>
 <section id="vehicles" className={card}><h2 className="flex items-center gap-2 text-xl font-bold"><Truck/>Vehicles ({data.vehicles?.length||0})</h2>
  <div className="mt-3"><div className="text-sm font-semibold text-slate-600">Assigned ({assignedVehicles.length})</div><div className="mt-2 space-y-2">{assignedVehicles.length===0&&<div className="text-sm text-slate-400">No vehicles assigned to a partner yet</div>}{assignedVehicles.map((x:any)=><div key={x.id} className="rounded-xl border p-3"><b>{x.vehicleNumber}</b><span className="ml-2 text-sm text-slate-500">{x.vehicleType||''} · {fmtWeight(x.capacityTons)}</span><span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-800">→ {x.partnerName}</span></div>)}</div></div>
  <div className="mt-4"><div className="text-sm font-semibold text-slate-600">Available ({availableVehicles.length})</div><div className="mt-2 space-y-2">{availableVehicles.length===0&&<div className="text-sm text-slate-400">No unassigned vehicles</div>}{availableVehicles.map((x:any)=><div key={x.id} className="rounded-xl border p-3"><b>{x.vehicleNumber}</b><span className="ml-2 text-sm text-slate-500">{x.vehicleType||''} · {fmtWeight(x.capacityTons)}</span><span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Available</span></div>)}</div></div>
  {(admin||manager)&&<Link to="/admin/vehicles" className="mt-4 inline-flex font-semibold text-sky-700">Add / Manage Vehicles →</Link>}</section></div>
 </>
}
