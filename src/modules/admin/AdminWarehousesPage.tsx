/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import {FormEvent,useEffect,useState} from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import {api,currentUser} from '@/shared/services/api';
import { COMMON_UNIT_FIELDS, fmtTempRange, toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
const c='w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white text-slate-900';

// Dedicated Warehouses screen -- same treatment as Partners: Add form + existing list with update,
// separated out of Admin Masters. Admin can attach a Manager to a warehouse; once attached, Admin or
// Manager can bulk-assign that manager's whole reporting team onto (a partner using) this warehouse.
// Cold Chambers (previously their own Inventory page section) are managed per-warehouse here, since
// every chamber belongs to exactly one warehouse.
export function AdminWarehousesPage(){
 const u=currentUser(),role=String(u.role||u.roleCode||'').replace('ROLE_','').toUpperCase(),allowed=role==='ADMIN'||role==='MANAGER',admin=role==='ADMIN';
 const [warehouses,setWarehouses]=useState<any[]>([]),[partners,setPartners]=useState<any[]>([]),[whPartners,setWhPartners]=useState<Record<number,any[]>>({}),[managers,setManagers]=useState<any[]>([]),[employees,setEmployees]=useState<any[]>([]),[chambers,setChambers]=useState<any[]>([]);
 const [whPick,setWhPick]=useState<Record<number,string>>({}),[managerPick,setManagerPick]=useState<Record<number,string>>({}),[bulkPartnerPick,setBulkPartnerPick]=useState<Record<number,string>>({}),[msg,setMsg]=useState(''),[open,setOpen]=useState<Record<number,boolean>>({}),[addOpen,setAddOpen]=useState(false);
 const toggleOpen=(id:number)=>setOpen(x=>({...x,[id]:!x[id]}));

 // REQ-WMS-006: the chamber list comes from /api/warehouse/chambers, which a Manager may read (/api/admin/chambers is Admin only,
 // so this page failed for a Manager). Zones, racks, bins and docks are edited on Warehouse Layout.
 const load=()=>Promise.all([api('/api/admin/warehouses'),api('/api/admin/partners'),api('/api/admin/billing/context'),api('/api/warehouse/chambers')])
  .then(([w,p,ctx,ch])=>{setWarehouses(w||[]);setPartners((p||[]).filter((x:any)=>x.active));setManagers(ctx?.managers||[]);setEmployees(ctx?.employees||[]);setChambers(ch||[]);
   const mp:Record<number,string>={};(w||[]).forEach((wh:any)=>{if(wh.managerEmployeeId)mp[wh.id]=String(wh.managerEmployeeId)});setManagerPick(mp);
   return Promise.all((w||[]).map((wh:any)=>api(`/api/admin/warehouses/${wh.id}/partners`).then(list=>[wh.id,list]).catch(()=>[wh.id,[]])));
  }).then(pairs=>{const m:Record<number,any[]>={};(pairs||[]).forEach(([id,list]:any)=>{m[id]=list});setWhPartners(m)}).catch(e=>setMsg(e.message));
 useEffect(()=>{if(allowed)void load();},[allowed]);

 async function createWarehouse(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/warehouses',{method:'POST',body:JSON.stringify(toBaseFields(Object.fromEntries(new FormData(f)), COMMON_UNIT_FIELDS))});f.reset();setMsg('Warehouse added.');setAddOpen(false);load()}catch(x:any){setMsg(x.message)}}
 async function assignWarehousePartner(warehouseId:number){const partnerId=whPick[warehouseId];if(!partnerId)return;try{await api(`/api/admin/warehouses/${warehouseId}/partners/${partnerId}`,{method:'POST'});setMsg('Partner assigned to warehouse.');load()}catch(x:any){setMsg(x.message)}}
 async function unassignWarehousePartner(warehouseId:number,partnerId:number){if(!confirm('Remove this partner from the warehouse?'))return;try{await api(`/api/admin/warehouses/${warehouseId}/partners/${partnerId}`,{method:'DELETE'});setMsg('Partner removed from warehouse.');load()}catch(x:any){setMsg(x.message)}}
 const [mgrNote,setMgrNote]=useState<Record<number,{ok:boolean;text:string}>>({});
 async function saveManager(warehouseId:number){try{await api(`/api/admin/warehouses/${warehouseId}/manager`,{method:'PATCH',body:JSON.stringify({managerEmployeeId:managerPick[warehouseId]||null})});setMgrNote(x=>({...x,[warehouseId]:{ok:true,text:'Manager saved.'}}));setMsg('Manager updated.');load()}catch(x:any){setMgrNote(y=>({...y,[warehouseId]:{ok:false,text:x.message}}));setMsg(x.message)}}
 async function addManagerTeam(wh:any){
  const partnerId=bulkPartnerPick[wh.id]||(whPartners[wh.id]||[])[0]?.id;
  if(!partnerId){setMsg('Assign this warehouse to a partner first.');return}
  const managerId=managerPick[wh.id];if(!managerId){setMsg('Attach a manager first.');return}
  try{const r=await api('/api/admin/billing/assignments/bulk',{method:'POST',body:JSON.stringify({managerEmployeeId:managerId,partnerId,warehouseId:wh.id})});setMsg(`Assigned ${r.assignedCount} employee(s) to this warehouse.`);load()}catch(x:any){setMsg(x.message)}
 }
 async function addChamber(warehouseId:number,e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/chambers',{method:'POST',body:JSON.stringify({...toBaseFields(Object.fromEntries(new FormData(f)), COMMON_UNIT_FIELDS),warehouseId})});f.reset();setMsg('Chamber added.');load()}catch(x:any){setMsg(x.message)}}
 const teamOf=(managerId:string)=>employees.filter((e:any)=>String(e.id)===managerId||String(e.managerEmployeeId)===managerId);
 const chambersOf=(warehouseId:number)=>chambers.filter((ch:any)=>ch.warehouseId===warehouseId);

 if(!allowed)return <div className="p-10">Admin or Manager access required.</div>;
 return <>
 <h1 className="text-3xl font-bold">Warehouses</h1>
 <p className="text-slate-500">Add a warehouse, assign it to partners, manage its cold chambers, and attach a manager whose team can be bulk-added.</p>
 {msg&&<div className="my-4 rounded-xl bg-blue-50 p-3">{msg}</div>}

 <div className="mt-6 rounded-2xl bg-white shadow-sm">
  <button type="button" onClick={()=>setAddOpen(x=>!x)} className="flex w-full items-center justify-between gap-2 p-5 text-left">
   <span className="flex items-center gap-2 text-xl font-bold"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">+</span>Add Warehouse</span>
   {addOpen?<ChevronDown className="h-5 w-5 text-slate-400"/>:<ChevronRight className="h-5 w-5 text-slate-400"/>}
  </button>
  {addOpen&&<form onSubmit={createWarehouse} className="grid gap-3 px-5 pb-5 md:grid-cols-2">
   <input name="warehouseCode" required placeholder="BBSR-WH-01" className={c}/>
   <input name="name" required placeholder="Warehouse name" className={c}/>
   <input name="address" placeholder="Address" className={c}/>
   <input name="city" placeholder="City" className={c}/>
   <input name="state" placeholder="State" className={c}/>
   <input name="capacityTons" placeholder={`Capacity ${unitNow('weight')}`} className={c}/>
   <button className="rounded-xl bg-indigo-700 px-5 py-2.5 text-white md:col-span-2">Add Warehouse</button>
  </form>}
 </div>

 <div className="mt-6 space-y-3">
  <h2 className="text-xl font-bold">Existing Warehouses ({warehouses.length})</h2>
  {warehouses.length===0&&<div className="rounded-2xl bg-white p-5 text-sm text-slate-400 shadow-sm">No warehouses yet -- add one above.</div>}
  {warehouses.map(w=><div key={w.id} className="rounded-2xl bg-white shadow-sm">
   <button type="button" onClick={()=>toggleOpen(w.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-5 text-left">
    <div className="flex items-center gap-2">
     {open[w.id]?<ChevronDown className="h-4 w-4 flex-none text-slate-400"/>:<ChevronRight className="h-4 w-4 flex-none text-slate-400"/>}
     <span className="font-bold">{w.name}</span>
     <span className="ml-1 text-sm text-slate-500">{w.warehouseCode} · {w.city||''} {w.state||''}</span>
     {w.managerName&&<span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Mgr: {w.managerName}</span>}
    </div>
   </button>
   {open[w.id]&&<div className="px-5 pb-5">
    <div className="mt-3"><div className="text-sm font-semibold text-slate-600">Partners assigned</div>
     <div className="mt-1 flex flex-wrap gap-2">{(whPartners[w.id]||[]).length===0&&<span className="text-sm text-slate-400">No partners assigned</span>}{(whPartners[w.id]||[]).map((p:any)=><span key={p.id} className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm">{p.name}<button type="button" onClick={()=>unassignWarehousePartner(w.id,p.id)} title="Unassign" className="font-bold text-red-700">×</button></span>)}</div>
     <div className="mt-2 flex items-center gap-2"><select className={c} value={whPick[w.id]||''} onChange={e=>setWhPick(x=>({...x,[w.id]:e.target.value}))}><option value="">Select partner…</option>{partners.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button type="button" onClick={()=>assignWarehousePartner(w.id)} disabled={!whPick[w.id]} className="rounded-xl bg-indigo-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Assign</button></div>
    </div>

    <div className="mt-4 border-t pt-3"><div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-600">Cold Chambers ({chambersOf(w.id).length})</div><Link to={`/warehouse/layout?warehouse=${w.id}`} className="text-sm font-semibold text-sky-700">Zones, racks, bins &amp; docks</Link></div>
     <div className="mt-2 space-y-1.5">{chambersOf(w.id).length===0&&<div className="text-sm text-slate-400">No chambers yet</div>}{chambersOf(w.id).map((ch:any)=><div key={ch.id} className="flex items-center justify-between rounded-lg border p-2 text-sm"><span><b>{ch.name}</b> <span className="text-slate-500">{ch.chamberCode} · {fmtTempRange(ch.minTemperatureC,ch.maxTemperatureC)}</span></span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{ch.status}</span></div>)}</div>
     {admin&&<form onSubmit={e=>addChamber(w.id,e)} className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-2"><input name="chamberCode" required placeholder="Chamber code" className="rounded-lg border p-2"/><input name="name" required placeholder="Chamber name" className="rounded-lg border p-2"/><input name="capacityTons" type="number" step="any" placeholder={`Capacity ${unitNow('weight')}`} className="rounded-lg border p-2"/><input name="minTemperatureC" type="number" step="any" placeholder={`Min ${unitNow('temp')}`} className="rounded-lg border p-2"/><input name="maxTemperatureC" type="number" step="any" placeholder={`Max ${unitNow('temp')}`} className="rounded-lg border p-2"/><button className="rounded-lg bg-sky-700 p-2 font-semibold text-white md:col-span-2">Add Chamber</button></form>}
    </div>

    <div className="mt-4 border-t pt-3"><div className="text-sm font-semibold text-slate-600">Manager</div>
     <div className="mt-1 flex flex-wrap items-center gap-2">
      <select className={c} value={managerPick[w.id]||''} onChange={e=>setManagerPick(x=>({...x,[w.id]:e.target.value}))} disabled={!admin}><option value="">{managers.length?'No manager':'No managers yet — set an employee\'s role to Manager in HR'}</option>{managers.map((m:any)=><option key={m.id} value={m.id}>{m.employeeCode} - {m.firstName} {m.lastName}</option>)}</select>
      {admin&&<button type="button" onClick={()=>saveManager(w.id)} className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold text-white">Save manager</button>}
     </div>
     {mgrNote[w.id]&&<div role="status" className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${mgrNote[w.id].ok?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-800'}`}>{mgrNote[w.id].text}</div>}
     {w.managerEmployeeId?<div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><b>{String(w.managerName||'').replace(/^[^-]+ - /,'')}</b> and everyone who reports to them ({teamOf(String(w.managerEmployeeId)).filter((e:any)=>String(e.id)!==String(w.managerEmployeeId)).length} direct) can now see this warehouse in <b>Billing → Create New Bill</b> — no separate assignment needed.</div>:<div className="mt-2 text-sm text-slate-600">Pick a manager and click <b>Save manager</b>. That manager and their whole team will then see this warehouse when creating bills.</div>}
    </div>
   </div>}
  </div>)}
 </div>
 </>;
}
