/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import {FormEvent,useEffect,useState} from 'react';
import {ChevronDown,ChevronRight,Users} from 'lucide-react';
import {Link} from 'react-router-dom';
import {api,currentUser} from '@/shared/services/api';
import {PagerBar,usePagedList} from '@/shared/components/PagedList'; // REQ-PLT-004: the partner list is paged by the server
const c='w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white text-slate-900';

// A dedicated Partners screen, separated from Vehicle/Warehouse/GPS management (Admin Masters) --
// Admin and Manager both get this one. Adding a partner lets you type its products directly (e.g.
// "Milk, Ice Cream") with no separate "add product to catalog first" step -- the backend finds or
// creates each named product and attaches it to this partner.
export function AdminPartnersPage(){
 const u=currentUser(),role=String(u.role||u.roleCode||'').replace('ROLE_','').toUpperCase(),allowed=role==='ADMIN'||role==='MANAGER',admin=role==='ADMIN';
 const list=usePagedList<any>('/api/admin/partners/page'); const partners:any[]=list.items; const [partnerProducts,setPartnerProducts]=useState<Record<number,any[]>>({}),[productEdit,setProductEdit]=useState<Record<number,string>>({}),[managers,setManagers]=useState<any[]>([]),[employees,setEmployees]=useState<any[]>([]),[managerPick,setManagerPick]=useState<Record<number,string>>({}),[msg,setMsg]=useState(''),[open,setOpen]=useState<Record<number,boolean>>({}),[addOpen,setAddOpen]=useState(false);
 const toggleOpen=(id:number)=>setOpen(x=>({...x,[id]:!x[id]}));

 // REQ-PLT-004: managers and employees once; the products of the partners on the shown page only.
 const loadContext=()=>api('/api/admin/billing/context').then(ctx=>{setManagers(ctx?.managers||[]);setEmployees(ctx?.employees||[])}).catch(e=>setMsg(e.message));
 const load=()=>{list.reload();return loadContext()};
 useEffect(()=>{
   const mp:Record<number,string>={};partners.forEach((pt:any)=>{if(pt.managerEmployeeId)mp[pt.id]=String(pt.managerEmployeeId)});setManagerPick(mp);
   Promise.all(partners.map((pt:any)=>api(`/api/admin/partners/${pt.id}/products`).then(l=>[pt.id,l]).catch(()=>[pt.id,[]])))
    .then(pairs=>{const m:Record<number,any[]>={};const edit:Record<number,string>={};(pairs||[]).forEach(([id,l]:any)=>{m[id]=l;edit[id]=(l||[]).map((x:any)=>x.name).join(', ')});setPartnerProducts(m);setProductEdit(edit)});
 },[partners]);
 useEffect(()=>{if(allowed)void loadContext();},[allowed]);
 const [mgrNote,setMgrNote]=useState<Record<number,{ok:boolean;text:string}>>({});
 async function saveManager(partnerId:number){try{await api(`/api/admin/partners/${partnerId}/manager`,{method:'PATCH',body:JSON.stringify({managerEmployeeId:managerPick[partnerId]||null})});setMgrNote(x=>({...x,[partnerId]:{ok:true,text:'Manager saved.'}}));setMsg('Manager updated.');load()}catch(x:any){setMgrNote(y=>({...y,[partnerId]:{ok:false,text:x.message}}));setMsg(x.message)}}
 async function addManagerTeam(p:any){
  const managerId=managerPick[p.id];if(!managerId){setMsg('Attach a manager first.');return}
  try{const r=await api('/api/admin/billing/assignments/bulk',{method:'POST',body:JSON.stringify({managerEmployeeId:managerId,partnerId:p.id})});setMsg(`Assigned ${r.assignedCount} employee(s) to this partner.`);load()}catch(x:any){setMsg(x.message)}
 }
 const teamOf=(managerId:string)=>employees.filter((e:any)=>String(e.id)===managerId||String(e.managerEmployeeId)===managerId);

 async function createPartner(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const f=e.currentTarget;
  try{
   const body:any=Object.fromEntries(new FormData(f));
   const productNames=String(body.productNamesText||'').split(',').map(x=>x.trim()).filter(Boolean);
   delete body.productNamesText; body.productNames=productNames;
   await api('/api/admin/partners',{method:'POST',body:JSON.stringify(body)});
   f.reset();setMsg('Partner added.');setAddOpen(false);load();
  }catch(x:any){setMsg(x.message)}
 }
 async function saveProducts(partnerId:number){
  try{
   const productNames=(productEdit[partnerId]||'').split(',').map(x=>x.trim()).filter(Boolean);
   await api(`/api/admin/partners/${partnerId}/products`,{method:'PUT',body:JSON.stringify({productNames})});
   setMsg('Products updated.');load();
  }catch(x:any){setMsg(x.message)}
 }
 const [detailNote,setDetailNote]=useState<Record<number,{ok:boolean;text:string}>>({});
 async function saveDetails(partnerId:number,e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  try{await api(`/api/admin/partners/${partnerId}/details`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});setDetailNote(x=>({...x,[partnerId]:{ok:true,text:'Details saved — they will print on the next Tax Invoice.'}}));load();}
  catch(x:any){setDetailNote(y=>({...y,[partnerId]:{ok:false,text:x.message}}));}
 }
 async function toggleActive(p:any){
  if(!confirm(`${p.active?'Deactivate':'Activate'} ${p.name}?`))return;
  try{await api(`/api/admin/partners/${p.id}/active`,{method:'PATCH',body:JSON.stringify({active:!p.active})});setMsg(`${p.name} ${p.active?'deactivated':'activated'}.`);load()}catch(x:any){setMsg(x.message)}
 }

 if(!allowed)return <div className="p-10">Admin or Manager access required.</div>;
 return <>
 <h1 className="text-3xl font-bold">Partners</h1>
 <p className="text-slate-500">Add a partner and the products it carries, then manage the list below. Vehicles and warehouses now have their own dedicated management pages.</p>
 {msg&&<div className="my-4 rounded-xl bg-blue-50 p-3">{msg}</div>}

 <div className="mt-6 rounded-2xl bg-white shadow-sm">
  <button type="button" onClick={()=>setAddOpen(x=>!x)} className="flex w-full items-center justify-between gap-2 p-5 text-left">
   <span className="flex items-center gap-2 text-xl font-bold"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">+</span>Add Partner / Client</span>
   {addOpen?<ChevronDown className="h-5 w-5 text-slate-400"/>:<ChevronRight className="h-5 w-5 text-slate-400"/>}
  </button>
  {addOpen&&<form onSubmit={createPartner} className="grid gap-3 px-5 pb-5 md:grid-cols-2">
   <input name="partnerCode" required placeholder="Partner code (e.g. AMUL)" className={c}/>
   <input name="name" required placeholder="Partner name" className={c}/>
   <select name="serviceScope" className={c}><option value="TRANSPORT">Transport only</option><option value="WAREHOUSE">Warehouse only</option><option value="BOTH">Both Transport &amp; Warehouse</option></select>
   <input name="billingEmail" type="email" required placeholder="Billing email *" className={c}/>
   <input name="contactEmail" type="email" placeholder="Operations/contact email" className={c}/>
   <input name="contactPhone" placeholder="Contact phone" className={c}/>
   <input name="gstNumber" placeholder="GST number" className={c}/>
   <input name="addressLine1" required placeholder="Address line 1 *" className={c}/>
   <input name="addressLine2" placeholder="Address line 2" className={c}/>
   <input name="city" required placeholder="City *" className={c}/>
   <input name="state" required placeholder="State *" className={c}/>
   <input name="postalCode" required placeholder="PIN / postal code *" className={c}/>
   <input name="billingAddress" placeholder="Billing address / GST address (if different)" className={c}/>
   <div className="md:col-span-2">
    <label className="mb-1 block text-sm font-semibold text-slate-700">Products this partner carries</label>
    <input name="productNamesText" placeholder="e.g. Milk, Ice Cream" className={c}/>
    <p className="mt-1 text-xs text-slate-500">Comma separated. A product that doesn't exist yet is created automatically and attached to this partner -- no separate step needed.</p>
   </div>
   <button className="rounded-xl bg-cyan-700 px-5 py-2.5 text-white md:col-span-2">Add Partner</button>
  </form>}
 </div>

 <div className="mt-6 space-y-3">
  <h2 className="text-xl font-bold">Existing Partners ({list.total})</h2>
  <div className="rounded-2xl bg-white p-4 shadow-sm"><PagerBar list={list} placeholder="Search partner code, name, city, GST number, email or phone" exportName="partners" sorts={[['name','Name'],['partnerCode','Code'],['city','City'],['active','Active']]}/></div>
  {partners.length===0&&!list.busy&&<div className="rounded-2xl bg-white p-5 text-sm text-slate-400 shadow-sm">No partners yet -- add one above.</div>}
  {partners.map(p=><div key={p.id} className={`rounded-2xl bg-white shadow-sm ${!p.active?'opacity-60':''}`}>
   <button type="button" onClick={()=>toggleOpen(p.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-5 text-left">
    <div className="flex items-center gap-2">
     {open[p.id]?<ChevronDown className="h-4 w-4 flex-none text-slate-400"/>:<ChevronRight className="h-4 w-4 flex-none text-slate-400"/>}
     <span className="text-lg font-bold">{p.name}</span>
     <span className="ml-1 text-sm text-slate-500">{p.partnerCode} · {p.serviceScope}</span>
     <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${p.active?'bg-emerald-100 text-emerald-800':'bg-slate-200 text-slate-600'}`}>{p.active?'Active':'Inactive'}</span>
     {p.managerName&&<span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Mgr: {p.managerName}</span>}
    </div>
   </button>
   {open[p.id]&&<div className="px-5 pb-5">
    {/* REQ-PRT-001: the logins of this partner */}
    <div className="flex justify-end gap-2"><Link to={`/platform/partner-users?partner=${p.id}`} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Users aria-hidden className="mr-1 inline h-4 w-4"/>Users</Link><button type="button" onClick={()=>toggleActive(p)} className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${p.active?'border-red-300 text-red-700':'border-emerald-300 text-emerald-700'}`}>{p.active?'Deactivate':'Activate'}</button></div>
    <div className="mt-2 text-sm text-slate-500">{p.billingEmail}{p.gstNumber?` · GST ${p.gstNumber}`:''}</div>
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" open={!p.gstNumber||!p.state||!p.billingEmail}>
     <summary className="cursor-pointer text-sm font-semibold text-slate-700">Invoice / billing details {(!p.gstNumber||!p.state||!p.billingEmail)&&<span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Needed for Tax Invoice</span>}</summary>
     <form key={`${p.id}-${p.gstNumber}-${p.state}-${p.billingEmail}`} onSubmit={e=>saveDetails(p.id,e)} className="mt-3 grid gap-2 md:grid-cols-3">
      <label className="text-xs font-semibold text-slate-600">Legal name (Bill to)<input name="name" required defaultValue={p.name||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">GSTIN<input name="gstNumber" placeholder="21AAAAG5588Q2Z7" defaultValue={p.gstNumber||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Billing email (invoice is sent here)<input name="billingEmail" type="email" defaultValue={p.billingEmail||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600 md:col-span-2">Address line 1<input name="addressLine1" defaultValue={p.addressLine1||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Address line 2<input name="addressLine2" defaultValue={p.addressLine2||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">City<input name="city" defaultValue={p.city||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">State (decides IGST vs CGST+SGST)<input name="state" placeholder="Odisha" defaultValue={p.state||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">PIN code<input name="postalCode" defaultValue={p.postalCode||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Contact email<input name="contactEmail" type="email" defaultValue={p.contactEmail||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <label className="text-xs font-semibold text-slate-600">Contact phone<input name="contactPhone" defaultValue={p.contactPhone||''} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
      <input type="hidden" name="billingAddress" defaultValue={p.billingAddress||''}/>
      <div className="flex items-end"><button className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white">Save details</button></div>
      {detailNote[p.id]&&<div role="status" className={`md:col-span-3 rounded-lg px-3 py-2 text-sm font-medium ${detailNote[p.id].ok?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-800'}`}>{detailNote[p.id].text}</div>}
     </form>
    </details>
    <div className="mt-3 flex flex-wrap items-center gap-2">
     <label className="text-sm font-semibold text-slate-600">Products:</label>
     <input value={productEdit[p.id]||''} onChange={e=>setProductEdit(x=>({...x,[p.id]:e.target.value}))} placeholder="e.g. Milk, Ice Cream" className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"/>
     <button type="button" onClick={()=>saveProducts(p.id)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white">Save products</button>
    </div>
    {(partnerProducts[p.id]||[]).length>0&&<div className="mt-2 flex flex-wrap gap-1.5">{(partnerProducts[p.id]||[]).map((pr:any)=><span key={pr.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">{pr.name}</span>)}</div>}

    <div className="mt-4 border-t pt-3"><div className="text-sm font-semibold text-slate-600">Manager</div>
     <div className="mt-1 flex flex-wrap items-center gap-2">
      <select className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={managerPick[p.id]||''} onChange={e=>setManagerPick(x=>({...x,[p.id]:e.target.value}))} disabled={!admin}><option value="">{managers.length?'No manager':'No managers yet — set an employee\'s role to Manager in HR'}</option>{managers.map((m:any)=><option key={m.id} value={m.id}>{m.employeeCode} - {m.firstName} {m.lastName}</option>)}</select>
      {admin&&<button type="button" onClick={()=>saveManager(p.id)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white">Save manager</button>}
     </div>
     {mgrNote[p.id]&&<div role="status" className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${mgrNote[p.id].ok?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-800'}`}>{mgrNote[p.id].text}</div>}
     {p.managerEmployeeId?<div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><b>{String(p.managerName||'').replace(/^[^-]+ - /,'')}</b> and everyone who reports to them ({teamOf(String(p.managerEmployeeId)).filter((e:any)=>String(e.id)!==String(p.managerEmployeeId)).length} direct) can now see this partner in <b>Billing → Create New Bill</b> — no separate assignment needed.</div>:<div className="mt-2 text-sm text-slate-600">Pick a manager and click <b>Save manager</b>. That manager and their whole team will then see this partner when creating bills.</div>}
    </div>
   </div>}
  </div>)}
 </div>
 </>;
}
