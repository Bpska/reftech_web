/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import {FormEvent,useEffect,useState} from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';
import {api,currentUser} from '@/shared/services/api';
import {PagerBar,usePagedList} from '@/shared/components/PagedList'; // REQ-PLT-004: the truck list is paged by the server
import { COMMON_UNIT_FIELDS, fmtWeight, toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
const c='w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white text-slate-900';

// Dedicated Vehicles screen -- same treatment as Partners/Warehouses: Add form (incl. GPS config,
// moved here from Admin Masters) + existing list with partner assign/unassign (also moved here) and
// manager-attach. Vehicle<->Partner is 1:1 (vehicle.assignedPartnerId), so "Add manager's team" needs
// no partner-picker -- it just uses the vehicle's own assigned partner.
export function AdminVehiclesPage(){
 const u=currentUser(),role=String(u.role||u.roleCode||'').replace('ROLE_','').toUpperCase(),allowed=role==='ADMIN'||role==='MANAGER',admin=role==='ADMIN';
 const list=usePagedList<any>('/api/admin/vehicles/page'); const vehicles:any[]=list.items; const [partners,setPartners]=useState<any[]>([]),[managers,setManagers]=useState<any[]>([]),[employees,setEmployees]=useState<any[]>([]);
 const [vehiclePick,setVehiclePick]=useState<Record<number,string>>({}),[managerPick,setManagerPick]=useState<Record<number,string>>({}),[msg,setMsg]=useState(''),[open,setOpen]=useState<Record<number,boolean>>({}),[addOpen,setAddOpen]=useState(false);
 const toggleOpen=(id:number)=>setOpen(x=>({...x,[id]:!x[id]}));

 const loadLookups=()=>Promise.all([api('/api/admin/partners'),api('/api/admin/billing/context')])
  .then(([p,ctx])=>{setPartners((p||[]).filter((x:any)=>x.active));setManagers(ctx?.managers||[]);setEmployees(ctx?.employees||[]);}).catch(e=>setMsg(e.message));
 const load=()=>{list.reload();return loadLookups()};
 useEffect(()=>{const mp:Record<number,string>={};vehicles.forEach((veh:any)=>{if(veh.managerEmployeeId)mp[veh.id]=String(veh.managerEmployeeId)});setManagerPick(mp);},[vehicles]);
 useEffect(()=>{if(allowed)void loadLookups();},[allowed]);

 async function createVehicle(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/vehicles',{method:'POST',body:JSON.stringify(toBaseFields(Object.fromEntries(new FormData(f)), COMMON_UNIT_FIELDS))});f.reset();setMsg('Vehicle added.');setAddOpen(false);load()}catch(x:any){setMsg(x.message)}}
 async function assignVehicle(vehicleId:number){const partnerId=vehiclePick[vehicleId];if(!partnerId)return;try{await api(`/api/admin/vehicles/${vehicleId}/partner`,{method:'PATCH',body:JSON.stringify({partnerId})});setMsg('Vehicle assigned.');load()}catch(x:any){setMsg(x.message)}}
 async function unassignVehicle(vehicleId:number){if(!confirm('Unassign this vehicle from its partner?'))return;try{await api(`/api/admin/vehicles/${vehicleId}/partner`,{method:'DELETE'});setMsg('Vehicle unassigned.');load()}catch(x:any){setMsg(x.message)}}
 const [mgrNote,setMgrNote]=useState<Record<number,{ok:boolean;text:string}>>({});
 async function saveManager(vehicleId:number){try{await api(`/api/admin/vehicles/${vehicleId}/manager`,{method:'PATCH',body:JSON.stringify({managerEmployeeId:managerPick[vehicleId]||null})});setMgrNote(x=>({...x,[vehicleId]:{ok:true,text:'Manager saved.'}}));setMsg('Manager updated.');load()}catch(x:any){setMgrNote(y=>({...y,[vehicleId]:{ok:false,text:x.message}}));setMsg(x.message)}}
 async function addManagerTeam(v:any){
  if(!v.assignedPartnerId){setMsg('Assign this vehicle to a partner first.');return}
  const managerId=managerPick[v.id];if(!managerId){setMsg('Attach a manager first.');return}
  try{const r=await api('/api/admin/billing/assignments/bulk',{method:'POST',body:JSON.stringify({managerEmployeeId:managerId,partnerId:v.assignedPartnerId,vehicleId:v.id})});setMsg(`Assigned ${r.assignedCount} employee(s) to this vehicle.`);load()}catch(x:any){setMsg(x.message)}
 }
 const teamOf=(managerId:string)=>employees.filter((e:any)=>String(e.id)===managerId||String(e.managerEmployeeId)===managerId);

 if(!allowed)return <div className="p-10">Admin or Manager access required.</div>;
 return <>
 <h1 className="text-3xl font-bold">Vehicles</h1>
 <p className="text-slate-500">Add a vehicle with GPS config, assign it to a partner, and attach a manager whose team can be bulk-added.</p>
 {msg&&<div className="my-4 rounded-xl bg-blue-50 p-3">{msg}</div>}

 <div className="mt-6 rounded-2xl bg-white shadow-sm">
  <button type="button" onClick={()=>setAddOpen(x=>!x)} className="flex w-full items-center justify-between gap-2 p-5 text-left">
   <span className="flex items-center gap-2 text-xl font-bold"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">+</span>Add Vehicle</span>
   {addOpen?<ChevronDown className="h-5 w-5 text-slate-400"/>:<ChevronRight className="h-5 w-5 text-slate-400"/>}
  </button>
  {addOpen&&<form onSubmit={createVehicle} className="grid gap-3 px-5 pb-5 md:grid-cols-2">
   <input name="vehicleNumber" required placeholder="Vehicle number *" className={c}/>
   <select name="vehicleType" required className={c}><option value="REEFER_TRUCK">Reefer Truck</option><option value="DRY_CONTAINER">Dry Container</option></select>
   <input name="capacityTons" type="number" step="any" placeholder={`Capacity ${unitNow('weight')}`} className={c}/>
   <input name="capacityCubicMeters" type="number" step="0.001" placeholder="Volume m3" className={c}/>
   <input name="minTemperatureC" placeholder={`Min ${unitNow('temp')} (reefer)`} className={c}/>
   <input name="maxTemperatureC" placeholder={`Max ${unitNow('temp')} (reefer)`} className={c}/>
   <div className="md:col-span-2 border-t pt-3"><div className="mb-2 font-semibold">GPS Provider Configuration</div></div>
   <select name="gpsProvider" className={c}><option value="">No GPS provider</option><option>MILLITRACK</option><option>JIOTRACK</option><option>OTHER</option></select>
   <input name="gpsImei" placeholder="GPS IMEI" className={c}/>
   <input name="gpsCompany" placeholder="GPS company" className={c}/>
   <input name="gpsDeviceId" placeholder="Provider device ID" className={c}/>
   <input name="gpsProviderUserId" placeholder="Provider user ID" className={c}/>
   <input name="gpsUsername" autoComplete="off" placeholder="GPS username" className={c}/>
   <input name="gpsPassword" type="password" autoComplete="new-password" placeholder="GPS password (encrypted at rest)" className={c}/>
   <input name="make" placeholder="Make" className={c}/>
   <input name="model" placeholder="Model" className={c}/>
   <button className="rounded-xl bg-emerald-700 px-5 py-2.5 text-white md:col-span-2">Add Vehicle</button>
  </form>}
 </div>

 <div className="mt-6 space-y-3">
  <h2 className="text-xl font-bold">Existing Vehicles ({list.total})</h2>
  <div className="rounded-2xl bg-white p-4 shadow-sm"><PagerBar list={list} placeholder="Search truck number, type, partner or GPS device" exportName="trucks" sorts={[['vehicleNumber','Truck'],['vehicleType','Type'],['capacityTons','Capacity'],['status','Status'],['partnerName','Partner']]}/></div>
  {vehicles.length===0&&!list.busy&&<div className="rounded-2xl bg-white p-5 text-sm text-slate-400 shadow-sm">No vehicles yet -- add one above.</div>}
  {vehicles.map(v=><div key={v.id} className="rounded-2xl bg-white shadow-sm">
   <button type="button" onClick={()=>toggleOpen(v.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-5 text-left">
    <div className="flex items-center gap-2">
     {open[v.id]?<ChevronDown className="h-4 w-4 flex-none text-slate-400"/>:<ChevronRight className="h-4 w-4 flex-none text-slate-400"/>}
     <span className="font-bold">{v.vehicleNumber}</span>
     <span className="ml-1 text-sm font-normal text-slate-500">{v.vehicleType||''} · {fmtWeight(v.capacityTons)}</span>
     {v.partnerName?<span className="ml-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-800">→ {v.partnerName}</span>:<span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Available</span>}
     {v.managerName&&<span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Mgr: {v.managerName}</span>}
    </div>
   </button>
   {open[v.id]&&<div className="px-5 pb-5">
    <div className="mt-1"><div className="text-sm font-semibold text-slate-600">Partner</div>
     <div className="mt-1 flex items-center gap-2"><select className={c} value={vehiclePick[v.id]||''} onChange={e=>setVehiclePick(x=>({...x,[v.id]:e.target.value}))}><option value="">Select partner…</option>{partners.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button type="button" onClick={()=>assignVehicle(v.id)} disabled={!vehiclePick[v.id]} className="rounded-xl bg-cyan-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Assign</button>{v.partnerName&&<button type="button" onClick={()=>unassignVehicle(v.id)} className="rounded-xl border border-red-300 px-3 py-2.5 text-sm font-semibold text-red-700">Unassign</button>}</div>
    </div>

    <div className="mt-4 border-t pt-3"><div className="text-sm font-semibold text-slate-600">Manager</div>
     <div className="mt-1 flex flex-wrap items-center gap-2">
      <select className={c} value={managerPick[v.id]||''} onChange={e=>setManagerPick(x=>({...x,[v.id]:e.target.value}))} disabled={!admin}><option value="">{managers.length?'No manager':'No managers yet — set an employee\'s role to Manager in HR'}</option>{managers.map((m:any)=><option key={m.id} value={m.id}>{m.employeeCode} - {m.firstName} {m.lastName}</option>)}</select>
      {admin&&<button type="button" onClick={()=>saveManager(v.id)} className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold text-white">Save manager</button>}
     </div>
     {mgrNote[v.id]&&<div role="status" className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${mgrNote[v.id].ok?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-800'}`}>{mgrNote[v.id].text}</div>}
     {v.managerEmployeeId?<div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><b>{String(v.managerName||'').replace(/^[^-]+ - /,'')}</b> and everyone who reports to them ({teamOf(String(v.managerEmployeeId)).filter((e:any)=>String(e.id)!==String(v.managerEmployeeId)).length} direct) can now see this vehicle in <b>Billing → Create New Bill</b> — no separate assignment needed.</div>:<div className="mt-2 text-sm text-slate-600">Pick a manager and click <b>Save manager</b>. That manager and their whole team will then see this vehicle when creating bills.</div>}
    </div>
   </div>}
  </div>)}
 </div>
 </>;
}
