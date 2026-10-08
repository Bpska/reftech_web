/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { FormEvent,ReactNode,useEffect,useMemo,useState } from 'react';
import { BarChart3,Building2,CheckCircle2,FileText,Mail,ChevronDown,Download,Eye,FileSpreadsheet,Minus,Plus,ReceiptText,RotateCcw,Send,Settings,Trash2,Truck,UserCheck,Users,Warehouse,XCircle } from 'lucide-react';
import { api,apiDownload,apiDownloadPost,currentUser } from '@/shared/services/api';
import { Link } from 'react-router-dom'; // REQ-TRP-003
import { DraftNotice,useBillDraft } from './useBillDraft'; // REQ-BIL-005
import { PagerBar,usePagedList } from '@/shared/components/PagedList'; // REQ-PLT-004: the bill list is paged by the server
import { fmtDateTime, fmtMoney, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

// ---------------------------------------------------------------------------------------------------
// Billing v1.1 — Create Bill (Partner → Vehicle → delivery rows → Generate Excel → Submit to manager)
// collapsed by default, with Submitted Bill Status right below it. Manager/Admin setup sections
// (assignments, contracts, GST profile, reports) are kept further down, each collapsed.
// REQ-BIL-008: a per-ton bill (Billing > Per-ton Bill) is priced when it is made, one row per load with its tons and
// rate per ton; the reviewer only adds GST (no Rate per KM). Its rows show tons, rate and amount.
// REQ-WMS-004: a storage bill (pricing basis STORAGE, sent from Warehouse > Storage Billing) is reviewed like a per-ton
// bill: its charge lines and amount were fixed by the warehouse; the reviewer adds GST.
// REQ-BIL-001: on review the partner's rate contract fills in the Rate per KM (or per trip) and GST %.
// REQ-BIL-002 / REQ-BIL-003: the status list shows what was received, what is still owed, the due date and the IRN.
// REQ-BIL-005: Create Bill is kept as a draft while typing (browser + server) and offered back when reopened.
// ---------------------------------------------------------------------------------------------------

const c='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5'; const lab='mb-1 block text-sm font-semibold text-slate-700';
const cell='h-10 w-full rounded-lg border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600';
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Math.random().toString(36).slice(2,9);
const dmy=(d?:string)=>{if(!d)return '';const [y,m,dd]=d.slice(0,10).split('-');return dd&&m&&y?`${dd}-${m}-${y}`:d;};
const stripCode=(n?:string|null)=>n?n.replace(/^[^-]+ - /,''):'';
const rupee=(n:any)=>fmtMoney(Number(n||0));

// REQ-TRP-003: dmrEntryId is set on a row that was filled from a proof of delivery (a DMR row waiting for a bill).
type BillRow={id:string;date:string;billNo:string;dmrNo:string;productId:string;from:string;to:string;googleKm:string;km:string;dmrEntryId?:number};
type DmrEntry={id:number;tripId:number;tripNumber:string;vehicleId:number;serviceDate:string;dmrNumber:string;podNumber:string;fromLocation?:string|null;toLocation?:string|null;distanceKm?:number|null;deliveredQuantityTons?:number|null;deliveryPartyName?:string|null;receiverName?:string|null;temperatureC?:number|null;remarks?:string|null;rejectedInvoiceNumber?:string|null};
const blankRow=(date=today(),from='',productId=''):BillRow=>({id:uid(),date,billNo:'',dmrNo:'',productId,from,to:'',googleKm:'',km:''});
type Kind='TRANSPORT'|'WAREHOUSE';

// Old multi-line model — still used by the Manager/Admin Monthly Vehicle Bill's optional DMR log.
type Stop={deliveryPartyName:string;deliveryAddress:string;fromLocation:string;toLocation:string;distanceKm:string;deliveredQuantityTons:string};
type Line={serviceDate:string;dmrNumber:string;productId:string;productName:string;fromLocation:string;toLocation:string;distanceKm:string;quantityTons:string;ratePerTon:string;fixedCharge:string;additionalKm:string;additionalKmRate:string;otherCharges:string;taxRate:string;remarks:string;stops:Stop[]};
const emptyLine=():Line=>({serviceDate:today(),dmrNumber:'',productId:'',productName:'',fromLocation:'',toLocation:'',distanceKm:'',quantityTons:'',ratePerTon:'',fixedCharge:'',additionalKm:'',additionalKmRate:'',otherCharges:'',taxRate:'18',remarks:'',stops:[]});

const STATUS:Record<string,{label:string;cls:string;dot:string}>={
 PENDING_REVIEW:{label:'Pending review',cls:'bg-amber-100 text-amber-900',dot:'bg-amber-600'},
 APPROVED:{label:'Approved',cls:'bg-green-100 text-green-900',dot:'bg-green-700'},
 REJECTED:{label:'Rejected',cls:'bg-red-100 text-red-900',dot:'bg-red-700'},
 SENT:{label:'Sent to partner',cls:'bg-blue-100 text-blue-900',dot:'bg-blue-700'},
 PAID:{label:'Paid',cls:'bg-emerald-100 text-emerald-900',dot:'bg-emerald-700'},
};

/** Collapsible card — the header is a real button; content only mounts when open. */
function Collapsible({id,title,subtitle,icon,open,onToggle,accent='bg-slate-800',children}:{id?:string;title:string;subtitle?:string;icon:ReactNode;open:boolean;onToggle:()=>void;accent?:string;children:ReactNode}){
 return <section id={id} className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-16 w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
   <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${accent}`}>{icon}</span>
   <span className="flex-1"><span className="block text-lg font-bold text-slate-900">{title}</span>{subtitle&&<span className="block text-sm text-slate-600">{subtitle}</span>}</span>
   <span className="text-sm font-semibold text-blue-700">{open?'Hide':'Open'}</span>
   <ChevronDown className={`h-5 w-5 text-slate-600 transition-transform ${open?'rotate-180':''}`}/>
  </button>
  {open&&<div className="border-t border-slate-200 p-5">{children}</div>}
 </section>;
}

export function AdminBillingPage(){
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
 const u=currentUser(),allowed=['EMPLOYEE','MANAGER','ADMIN'].includes(u.role),reviewer=['MANAGER','ADMIN'].includes(u.role),admin=u.role==='ADMIN';
 const [msg,setMsg]=useState(''),[toast,setToast]=useState('');
 const [partners,setPartners]=useState<any[]>([]),[vehicles,setVehicles]=useState<any[]>([]),[warehouses,setWarehouses]=useState<any[]>([]),[employees,setEmployees]=useState<any[]>([]),[products,setProducts]=useState<any[]>([]),[managers,setManagers]=useState<any[]>([]);
 const [stats,setStats]=useState<any>({}),[finance,setFinance]=useState<any>({});
 const [companyProfile,setCompanyProfile]=useState<any>({}),[contracts,setContracts]=useState<any[]>([]),[billingAssignments,setBillingAssignments]=useState<any[]>([]);
 const [allVehicles,setAllVehicles]=useState<any[]>([]),[allPartners,setAllPartners]=useState<any[]>([]),[vpPick,setVpPick]=useState<Record<number,string>>({});
 const [openSec,setOpenSec]=useState<Record<string,boolean>>({});
 const toggleSec=(k:string)=>setOpenSec(x=>({...x,[k]:!x[k]}));

 // ------------------------------------------------------------------ data
 const load=async()=>{
  setMsg('');
  try{const x=await api('/api/admin/billing/context');setPartners(x.partners||[]);setVehicles(x.vehicles||[]);setWarehouses(x.warehouses||[]);setProducts(x.products||[]);setEmployees(x.employees||[]);setManagers(x.managers||[]);}catch(e:any){setMsg(`Unable to load billing masters: ${e.message}`);}
  list.reload();
  try{setStats(await api('/api/admin/billing/dashboard')||{});}catch{setStats({});}
  try{const [av,ap]=await Promise.all([api('/api/admin/vehicles'),api('/api/admin/partners')]);setAllVehicles(Array.isArray(av)?av:[]);setAllPartners(Array.isArray(ap)?ap:[]);}catch{setAllVehicles([]);setAllPartners([]);}
  if(reviewer){try{setFinance(await api('/api/admin/billing/finance-summary')||{});}catch{setFinance({});}}
  if(admin){try{setCompanyProfile(await api('/api/admin/billing/company-profile')||{});}catch{setCompanyProfile({});}}
  if(reviewer){try{const ct=await api('/api/admin/billing/vehicle-contracts');setContracts(Array.isArray(ct)?ct:[]);}catch{setContracts([]);}}
  if(reviewer){try{const ba=await api('/api/admin/billing/assignments');setBillingAssignments(Array.isArray(ba)?ba:[]);}catch{setBillingAssignments([]);}}
 };
 useEffect(()=>{if(allowed)void load();},[allowed]);

 // ------------------------------------------------------------------ Create Bill
 const [createOpen,setCreateOpen]=useState(false);
 const [kind,setKind]=useState<Kind>('TRANSPORT');
 const [opts,setOpts]=useState<Record<Kind,any>>({TRANSPORT:null,WAREHOUSE:null});
 const [partnerId,setPartnerId]=useState(''),[vehicleId,setVehicleId]=useState(''),[warehouseId,setWarehouseId]=useState('');
 const [rows,setRows]=useState<BillRow[]>([blankRow()]);
 const [googleLoading,setGoogleLoading]=useState<Record<string,boolean>>({});
 const [tried,setTried]=useState(false),[busy,setBusy]=useState(false);
 const [excelSig,setExcelSig]=useState<string|null>(null),[excelName,setExcelName]=useState('');
 const [editing,setEditing]=useState<{id:number;no:string}|null>(null);
 // REQ-TRP-003: deliveries of the chosen partner and truck that have a proof of delivery and are not on a bill yet.
 const [dmrWaiting,setDmrWaiting]=useState<DmrEntry[]>([]),[dmrNote,setDmrNote]=useState('');
 const editingNo=editing?.no;
 useEffect(()=>{
  if(!createOpen||kind!=='TRANSPORT'||!partnerId||!vehicleId){setDmrWaiting([]);setDmrNote('');return;}
  let gone=false;
  api(`/api/billing/dmr-entries?partnerId=${partnerId}&vehicleId=${vehicleId}`).then((list:DmrEntry[])=>{
   if(gone)return;
   const entries=Array.isArray(list)?list:[];
   setDmrWaiting(entries);setDmrNote('');
   // A rejected bill that is being edited: its rows are tied to their DMR rows again, by the DMR number.
   if(editingNo)setRows(x=>x.map(r=>{if(r.dmrEntryId)return r;const e=entries.find(d=>d.rejectedInvoiceNumber===editingNo&&d.dmrNumber===r.dmrNo.trim());return e?{...r,dmrEntryId:e.id}:r;}));
  }).catch((e:any)=>{if(!gone){setDmrWaiting([]);setDmrNote(e.message||'The delivered trips could not be read');}});
  return()=>{gone=true;};
 },[createOpen,kind,partnerId,vehicleId,editingNo]);

 async function loadOptions(){
  const [t,w]=await Promise.all([
   api('/api/admin/billing/my-billing-options?billingType=TRANSPORT').catch(()=>({partners:[]})),
   api('/api/admin/billing/my-billing-options?billingType=WAREHOUSE').catch(()=>({partners:[]})),
  ]);
  setOpts({TRANSPORT:t||{partners:[]},WAREHOUSE:w||{partners:[]}});
  return {TRANSPORT:t,WAREHOUSE:w};
 }
 useEffect(()=>{if(createOpen&&!opts.TRANSPORT)void loadOptions();},[createOpen]);

 const o=opts[kind]||{partners:[]};
 const partnerList:any[]=o.partners||[];
 const hasWarehouseBilling=(opts.WAREHOUSE?.partners||[]).length>0;
 const partner=partnerList.find(p=>String(p.id)===partnerId);
 const resourceList:any[]=partnerId?(kind==='TRANSPORT'?o.vehiclesByPartner?.[partnerId]:o.warehousesByPartner?.[partnerId])||[]:[];
 const resourceId=kind==='TRANSPORT'?vehicleId:warehouseId;
 const resource=resourceList.find(r=>String(r.id)===resourceId);
 const productList:any[]=partnerId?o.productsByPartner?.[partnerId]||[]:[];
 const onlyProduct=productList.length===1?String(productList[0].id):'';
 const needProduct=productList.length>0;
 const reviewers=[partner?.managerName?`${stripCode(partner.managerName)} (partner manager)`:'',o.myManagerName&&stripCode(partner?.managerName)!==o.myManagerName?`${o.myManagerName} (your manager)`:''].filter(Boolean);
 const reviewerText=!partner?'—':reviewers.length?reviewers.join(' / '):'Admin (no manager attached yet)';

 // Pick the only partner / only vehicle automatically — fewer clicks for the common case.
 useEffect(()=>{if(!editing&&partnerList.length===1&&!partnerId)setPartnerId(String(partnerList[0].id));},[opts,kind]);
 useEffect(()=>{if(!editing&&resourceList.length===1&&!resourceId){kind==='TRANSPORT'?setVehicleId(String(resourceList[0].id)):setWarehouseId(String(resourceList[0].id));}},[partnerId,opts,kind]);
 useEffect(()=>{if(onlyProduct)setRows(x=>x.map(r=>r.productId?r:{...r,productId:onlyProduct}));},[onlyProduct]);

 const rowProblems=(r:BillRow)=>({date:!r.date,dmrNo:!r.dmrNo.trim(),productId:needProduct&&!r.productId,from:!r.from.trim(),to:!r.to.trim(),km:!(Number(r.km)>0)});
 const rowsOk=rows.every(r=>!Object.values(rowProblems(r)).some(Boolean));
 const selectionOk=!!partner&&!!resource;
 const ready=selectionOk&&rowsOk;
 const totalKm=rows.reduce((s,r)=>s+(Number(r.km)||0),0);
 const payload=useMemo(()=>({
  billingType:kind,partnerId,vehicleId:kind==='TRANSPORT'?vehicleId:undefined,warehouseId:kind==='WAREHOUSE'?warehouseId:undefined,
  lines:rows.map(r=>({serviceDate:r.date,billNumber:r.billNo.trim(),dmrNumber:r.dmrNo.trim(),productId:r.productId||undefined,fromLocation:r.from.trim(),toLocation:r.to.trim(),distanceKm:r.km})),
 }),[kind,partnerId,vehicleId,warehouseId,rows]);
 const sig=JSON.stringify(payload);
 // REQ-BIL-005: the form as typed, kept as a draft (a resubmit of a rejected bill is not kept: the bill itself holds it).
 const draft=useBillDraft('create-bill',{kind,partnerId,vehicleId,warehouseId,rows},{enabled:createOpen&&!editing,title:partner?.name,
  isEmpty:v=>!v.partnerId&&v.rows.every(r=>!r.dmrNo.trim()&&!r.from.trim()&&!r.to.trim()&&!r.km&&!r.billNo.trim())});
 function restoreDraft(){const v=draft.restore();if(!v)return;setKind(v.kind);setPartnerId(v.partnerId);setVehicleId(v.vehicleId);setWarehouseId(v.warehouseId);setRows(v.rows.length?v.rows:[blankRow()]);setExcelSig(null);}
 const excelReady=ready&&excelSig===sig;
 const step=!selectionOk?1:!rowsOk?2:!excelReady?3:4;
 const dates=rows.map(r=>r.date).filter(Boolean).sort();
 const period=dates.length?(dates[0]===dates[dates.length-1]?dmy(dates[0]):`${dmy(dates[0])} to ${dmy(dates[dates.length-1])}`):'';
 const productName=(id:string)=>productList.find(p=>String(p.id)===id)?.name||'';
 const resourceLabel=resource?(kind==='TRANSPORT'?resource.vehicleNumber:resource.name):'';

 // REQ-TRP-003: a row that came from a delivery stays tied to it only while its DMR number is the one of the delivery.
 function patchRow(id:string,k:keyof BillRow,v:string){setRows(x=>x.map(r=>r.id===id?{...r,[k]:v,...(k==='dmrNo'&&r.dmrEntryId?{dmrEntryId:undefined}:{})}:r));}
 // REQ-TRP-003: rows that came from deliveries belong to one partner and one truck; another choice takes them out of the bill.
 function dropDeliveryRows(){setRows(x=>{const y=x.filter(r=>!r.dmrEntryId);return y.length?y:[blankRow(today(),'',onlyProduct)];});}
 async function calculateGoogleKm(row:BillRow){
  if(!row.from.trim()||!row.to.trim()){setMsg('Enter the full From and To addresses before calculating Google Map KM.');return;}
  setGoogleLoading(x=>({...x,[row.id]:true}));
  try{const r=await api('/api/maps/distance',{method:'POST',body:JSON.stringify({fromAddress:row.from.trim(),toAddress:row.to.trim()})});patchRow(row.id,'googleKm',Number(r.distanceKm||0).toFixed(1));}
  catch(e:any){setMsg(e.message||'Unable to calculate Google Map distance.');}
  finally{setGoogleLoading(x=>({...x,[row.id]:false}));}
 }
 function addRowBelow(i:number){setRows(x=>{const prev=x[i];const y=x.slice();y.splice(i+1,0,blankRow(prev?.date||today(),prev?.to||'',prev?.productId||onlyProduct));return y;});}
 // REQ-TRP-003: put delivered trips into the bill rows. A lone empty first row is replaced, otherwise the rows are added at the end.
 function addDmrRows(entries:DmrEntry[]){
  setRows(x=>{
   const taken=new Set(x.map(r=>r.dmrEntryId).filter(Boolean));
   const fresh=entries.filter(e=>!taken.has(e.id)).map(e=>({...blankRow(String(e.serviceDate||'').slice(0,10)||today(),e.fromLocation||'',onlyProduct),dmrNo:e.dmrNumber||e.podNumber||'',to:e.toLocation||'',km:e.distanceKm!=null&&Number(e.distanceKm)>0?String(Number(e.distanceKm)):'',dmrEntryId:e.id}));
   if(!fresh.length)return x;
   const untouched=x.length===1&&!x[0].dmrNo.trim()&&!x[0].from.trim()&&!x[0].to.trim()&&!x[0].km&&!x[0].billNo.trim();
   return untouched?fresh:[...x,...fresh];
  });
 }
 function removeRow(id:string){setRows(x=>{const y=x.filter(r=>r.id!==id);return y.length?y:[blankRow(today(),'',onlyProduct)];});}
 function resetCreate(){setPartnerId('');setVehicleId('');setWarehouseId('');setRows([blankRow(today(),'',onlyProduct)]);setTried(false);setExcelSig(null);setExcelName('');setEditing(null);}
 function changeKind(k:Kind){setKind(k);setPartnerId('');setVehicleId('');setWarehouseId('');setTried(false);setExcelSig(null);}

 async function generateExcel(){
  setMsg('');
  if(!ready){setTried(true);return;}
  setBusy(true);
  const fallback=`Bill_${(partner?.name||'').split(/\s+/)[0]}_${resourceLabel}_${dates[0]||today()}.xlsx`.replace(/[^A-Za-z0-9_.-]/g,'');
  try{const name=await apiDownloadPost('/api/admin/billing/invoices/excel-preview',payload,fallback);setExcelSig(sig);setExcelName(name);setTried(false);}
  catch(e:any){setMsg(`Could not generate the Excel: ${e.message}`);}
  finally{setBusy(false);}
 }
 async function submitBill(){
  if(!excelReady)return;
  setBusy(true);setMsg('');
  try{
   const body:any={...payload,invoiceMode:rows.length>1?'MULTI_ROW':'SINGLE',billingDate:today(),description:`${kind==='WAREHOUSE'?'Warehouse':'Transport'} billing — ${rows.length} DMR ${rows.length>1?'entries':'entry'}`,amount:0,otherCharges:0,taxAmount:0,serviceFromDate:dates[0],serviceToDate:dates[dates.length-1]};
   // REQ-POD-006: the delivered trips (DMR rows) put into this bill go with the bill itself. The server marks them as billed
   // in the same save, so the bill and the billed mark cannot differ. On a resubmit the rows it has now are sent: a delivery
   // taken out of the bill waits again. The separate POST /api/billing/dmr-entries/attach is no longer called.
   const entryIds=rows.map(x=>x.dmrEntryId).filter((x):x is number=>typeof x==='number');
   if(kind==='TRANSPORT'&&(entryIds.length||editing))body.dmrEntryIds=entryIds;
   const r=editing?await api(`/api/admin/billing/invoices/${editing.id}/resubmit`,{method:'PUT',body:JSON.stringify(body)}):await api('/api/admin/billing/invoices',{method:'POST',body:JSON.stringify(body)});
   const who=reviewers.length?reviewers.map(x=>x.replace(/ \(.*\)$/,'')).join(' / '):'Admin';
   // REQ-POD-006: the server answers how many delivered trips are now marked as billed (attached) and how many wait again (released).
   const attached=Number(r.attached||0),released=Number(r.released||0);
   const dmrText=(attached?` ${attached} delivered ${attached===1?'trip is':'trips are'} now marked as billed.`:'')+(released?` ${released} delivered ${released===1?'trip was':'trips were'} taken off this bill and ${released===1?'waits':'wait'} for a bill again.`:'');
   setToast((r.status==='PENDING_REVIEW'?`${r.invoiceNumber} ${editing?'resubmitted':'submitted'} to ${who} for review. The Excel goes with their email.`:`${r.invoiceNumber} created — ${STATUS[r.status]?.label||r.status}.`)+dmrText);
   if(!editing)draft.clear();
   resetCreate();setCreateOpen(false);setFilter('ALL');
   await load();
   document.getElementById('bill-status')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e:any){setMsg(e.message);}
  finally{setBusy(false);}
 }
 async function startResubmit(inv:any){
  setMsg('');
  try{
   const all=opts.TRANSPORT?opts:await loadOptions();
   const lines:any[]=await api(`/api/admin/billing/invoices/${inv.id}/lines`);
   const k:Kind=inv.billingType==='WAREHOUSE'?'WAREHOUSE':'TRANSPORT';
   if(!all[k]?.partners?.some((p:any)=>String(p.id)===String(inv.partnerId)))setMsg('This partner is no longer assigned to you — pick the partner again before resubmitting.');
   setKind(k);setPartnerId(String(inv.partnerId||''));setVehicleId(inv.vehicleId?String(inv.vehicleId):'');setWarehouseId(inv.warehouseId?String(inv.warehouseId):'');
   setRows(lines.length?lines.map(l=>({id:uid(),date:String(l.serviceDate||'').slice(0,10),billNo:l.billNumber||'',dmrNo:l.dmrNumber||'',productId:l.productId?String(l.productId):'',from:l.fromLocation||'',to:l.toLocation||'',googleKm:'',km:l.distanceKm!=null?String(l.distanceKm):''})):[blankRow()]);
   setEditing({id:inv.id,no:inv.invoiceNumber});setExcelSig(null);setTried(false);setCreateOpen(true);
   window.scrollTo({top:0,behavior:'smooth'});
  }catch(e:any){setMsg(e.message);}
 }

 // ------------------------------------------------------------------ Submitted Bill Status
 const [filter,setFilter]=useState('ALL');
 // REQ-PLT-004: one page of bills from the server; the tab is a server filter, the numbers on the tabs come with the page.
 const list=usePagedList<any>('/api/admin/billing/invoices/page',filter==='ALL'?{}:filter==='MINE_TO_REVIEW'?{queue:'REVIEW'}:{'f.status':filter});
 const invoices:any[]=list.items;
 const [expanded,setExpanded]=useState<number|null>(null),[detailLines,setDetailLines]=useState<Record<number,any[]>>({});
 const [gstFor,setGstFor]=useState<Record<number,string>>({}),[reasonFor,setReasonFor]=useState<Record<number,string>>({}),[rateFor,setRateFor]=useState<Record<number,string>>({});
 // REQ-BIL-001: what the partner's rate contract says for a bill under review; per km or per trip.
 const [suggestFor,setSuggestFor]=useState<Record<number,any>>({}),[pricingFor,setPricingFor]=useState<Record<number,'PER_KM'|'PER_TRIP'>>({}),[tripRateFor,setTripRateFor]=useState<Record<number,string>>({});
 const [testTo,setTestTo]=useState(''),[testResult,setTestResult]=useState<{sent:boolean;message:string}|null>(null),[testBusy,setTestBusy]=useState(false);
 const dmrBills=invoices;
 const counts:Record<string,number>=list.options.counts||{};
 const myQueue=counts.MINE_TO_REVIEW||0;
 const shown=dmrBills;
 const filters=[['ALL',`All (${counts.ALL||0})`],...(reviewer?[['MINE_TO_REVIEW',`Waiting for my review (${myQueue})`]]:[]),['PENDING_REVIEW',`Pending (${counts.PENDING_REVIEW||0})`],['APPROVED',`Approved (${counts.APPROVED||0})`],['REJECTED',`Rejected (${counts.REJECTED||0})`],['SENT',`Sent (${counts.SENT||0})`],['PAID',`Paid (${counts.PAID||0})`]];
 async function toggleDetail(id:number){
  if(expanded===id){setExpanded(null);return;}
  setExpanded(id);
  if(!detailLines[id]){try{const l=await api(`/api/admin/billing/invoices/${id}/lines`);setDetailLines(x=>({...x,[id]:Array.isArray(l)?l:[]}));}catch(e:any){setMsg(e.message);}}
  const inv=invoices.find(x=>x.id===id);
  if(inv?.canReview&&inv.invoiceMode!=='MONTHLY_VEHICLE'&&inv.pricingBasis!=='PER_TON'&&inv.pricingBasis!=='STORAGE'&&!suggestFor[id]){
   try{
    const sg=await api(`/api/billing/rate-contracts/suggest?invoiceId=${id}`);
    setSuggestFor(x=>({...x,[id]:sg}));
    if(sg?.found){
     if(sg.gstRate!=null)setGstFor(x=>x[id]!==undefined?x:{...x,[id]:String(Number(sg.gstRate))});
     if(sg.perKm)setRateFor(x=>x[id]?x:{...x,[id]:String(Number(sg.perKm.rate))});
     if(sg.perTrip)setTripRateFor(x=>x[id]?x:{...x,[id]:String(Number(sg.perTrip.rate))});
     if(!sg.perKm&&sg.perTrip)setPricingFor(x=>({...x,[id]:'PER_TRIP'}));
    }
   }catch{/* no contract screen access or script 45 missing: the rate is typed as before */}
  }
 }
 async function approve(inv:any){
  const id=inv.id,monthly=inv.invoiceMode==='MONTHLY_VEHICLE'||inv.pricingBasis==='PER_TON'||inv.pricingBasis==='STORAGE';
  const perTrip=pricingFor[id]==='PER_TRIP',sg=suggestFor[id];
  const typed=perTrip?tripRateFor[id]:rateFor[id];
  // REQ-BIL-001: a contract with different rates per lane prices each row by its lane; the average shown is then not sent.
  const fromContract=perTrip?sg?.perTrip:sg?.perKm;
  const sendRate=fromContract?.mixed&&String(Number(fromContract.rate))===String(typed||'')?undefined:typed;
  if(!monthly&&!(Number(typed||0)>0)&&!fromContract){setMsg(perTrip?'Enter the Rate per trip (₹) before approving.':'Enter the Rate per KM (₹) before approving.');return;}
  try{
   const r=await api(`/api/admin/billing/invoices/${id}/approve`,{method:'POST',body:JSON.stringify({gstRate:gstFor[id]||'18',...(monthly?{}:perTrip?{pricing:'PER_TRIP',ratePerTrip:sendRate}:{ratePerKm:sendRate})})});
   setToast(r.taxInvoiceNumber?`Approved — Tax Invoice ${r.taxInvoiceNumber} generated for ${rupee(r.totalAmount)} (${r.gstType})${r.rateSource?`. ${r.rateSource}`:''}. The PDF on the RefTech letter pad is downloading now and is emailed to the employee and managers.`:'Bill approved.');
   setExpanded(null);await load();
   if(r.taxInvoiceNumber)apiDownload(`/api/admin/billing/invoices/${id}/tax-invoice.pdf`,`TaxInvoice_${String(r.taxInvoiceNumber).replace(/[^A-Za-z0-9-]/g,'_')}.pdf`).catch((e:any)=>setMsg(`Approved, but the PDF download failed: ${e.message}`));
  }catch(e:any){setMsg(e.message);}
 }
 async function sendTestEmail(){
  if(!testTo.includes('@')){setMsg('Enter an email address for the test.');return;}
  setTestBusy(true);setTestResult(null);
  try{setTestResult(await api('/api/admin/billing/test-email',{method:'POST',body:JSON.stringify({to:testTo})}));}catch(e:any){setTestResult({sent:false,message:e.message});}
  finally{setTestBusy(false);}
 }
 async function reject(id:number){const notes=(reasonFor[id]||'').trim();if(!notes){setMsg('Write a reason so the person knows what to fix.');return;}try{await api(`/api/admin/billing/invoices/${id}/reject`,{method:'POST',body:JSON.stringify({notes})});setToast('Bill rejected — the creator can edit and resubmit it.');setExpanded(null);await load();}catch(e:any){setMsg(e.message);}}
 async function markSent(id:number){if(!confirm('Email the Tax Invoice to the partner and mark this bill as Sent?'))return;try{await api(`/api/admin/billing/invoices/${id}/mark-sent`,{method:'POST',body:'{}'});setToast('Sent to partner — the Tax Invoice PDF and DMR Excel are emailed to the partner\'s billing email.');await load();}catch(e:any){setMsg(e.message);}}
 const reviewerOf=(i:any)=>[i.partnerManagerName,i.creatorManagerName&&i.creatorManagerName!==i.partnerManagerName?i.creatorManagerName:''].filter(Boolean).join(' / ')||'Admin';
 const when=(ts?:string)=>{if(!ts)return '—';const d=new Date(ts);return isNaN(d.getTime())?ts:fmtDateTime(d);};

 // ------------------------------------------------------------------ Monthly Vehicle Bill (Manager/Admin, unchanged logic)
 const [lines,setLines]=useState<Line[]>([emptyLine()]);
 const [mvVehicle,setMvVehicle]=useState(''),[mvPartner,setMvPartner]=useState(''),[mvMonth,setMvMonth]=useState(new Date().toISOString().slice(0,7)),[mvTotalKm,setMvTotalKm]=useState(''),[mvContract,setMvContract]=useState<any>(null),[mvErr,setMvErr]=useState('');
 useEffect(()=>{
  if(!mvVehicle||!mvPartner){setMvContract(null);setMvErr('');return;}
  setMvErr('');
  api(`/api/admin/billing/vehicle-contracts/active?vehicleId=${mvVehicle}&partnerId=${mvPartner}&asOf=${mvMonth}-28`).then(setMvContract).catch((e:any)=>{setMvContract(null);setMvErr(e.message);});
 },[mvVehicle,mvPartner,mvMonth]);
 const [mvY,mvM]=mvMonth.split('-').map(Number),mvDaysInMonth=new Date(mvY,mvM,0).getDate();
 const mvFixed=Number(mvContract?.fixedMonthlyAmount||0),mvBasisDays=Number(mvContract?.fixedBasisDays||31),mvIncludedKm=Number(mvContract?.includedKmPerMonth||0),mvExtraRate=Number(mvContract?.extraKmRate||0),mvGst=Number(mvContract?.gstRate||18);
 const mvKm=Number(mvTotalKm||0),mvExtraKm=Math.max(mvKm-mvIncludedKm,0),mvFixedProrated=mvFixed*mvDaysInMonth/mvBasisDays,mvExtraAmount=mvExtraKm*mvExtraRate,mvAmount=mvFixedProrated+mvExtraAmount,mvTax=mvAmount*mvGst/100,mvTotal=mvAmount+mvTax;
 const patchLine=(i:number,k:keyof Line,v:any)=>setLines(x=>x.map((r,n)=>n===i?{...r,[k]:v}:r));
 async function submitMonthly(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{const base:any=Object.fromEntries(new FormData(f));base.invoiceMode='MONTHLY_VEHICLE';base.billingType='TRANSPORT';const ln=lines.filter(l=>l.dmrNumber||l.productId||l.distanceKm||l.fromLocation||l.toLocation);base.lines=ln.map(l=>({...l,productName:products.find(p=>String(p.id)===l.productId)?.name||l.productName,stops:[]}));const r=await api('/api/admin/billing/invoices',{method:'POST',body:JSON.stringify(base)});setToast(`Monthly bill ${r.invoiceNumber} created — ${STATUS[r.status]?.label||r.status}.`);setLines([emptyLine()]);setMvTotalKm('');f.reset();await load()}catch(x:any){setMsg(x.message)}}

 // ------------------------------------------------------------------ setup actions (unchanged)
 const [assignPartnerId,setAssignPartnerId]=useState('');
 const assignPartnerScope=partners.find((p:any)=>String(p.id)===assignPartnerId)?.serviceScope;
 const [bulkManagerId,setBulkManagerId]=useState(''),[bulkPartnerId,setBulkPartnerId]=useState(''),[bulkVehicleId,setBulkVehicleId]=useState(''),[bulkWarehouseId,setBulkWarehouseId]=useState('');
 const bulkPartnerScope=partners.find((p:any)=>String(p.id)===bulkPartnerId)?.serviceScope;
 const bulkTeam=employees.filter((e:any)=>String(e.id)===bulkManagerId||String(e.managerEmployeeId)===bulkManagerId);
 const [reportPartner,setReportPartner]=useState(''),[month,setMonth]=useState(new Date().toISOString().slice(0,7));
 async function assignVehiclePartner(vehicleId:number){const pid=vpPick[vehicleId];if(!pid)return;try{await api(`/api/admin/vehicles/${vehicleId}/partner`,{method:'PATCH',body:JSON.stringify({partnerId:pid})});setMsg('Vehicle assigned to partner.');await load()}catch(x:any){setMsg(x.message)}}
 async function unassignVehiclePartner(vehicleId:number){if(!confirm('Unassign this vehicle from its partner?'))return;try{await api(`/api/admin/vehicles/${vehicleId}/partner`,{method:'DELETE'});setMsg('Vehicle unassigned.');await load()}catch(x:any){setMsg(x.message)}}
 async function assignBulk(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!bulkManagerId||!bulkPartnerId){setMsg('Pick a manager and a partner first.');return}try{const r=await api('/api/admin/billing/assignments/bulk',{method:'POST',body:JSON.stringify({managerEmployeeId:bulkManagerId,partnerId:bulkPartnerId,vehicleId:bulkVehicleId||undefined,warehouseId:bulkWarehouseId||undefined})});setMsg(`Assigned ${r.assignedCount} employee(s) (manager + team) to this partner.`);setBulkManagerId('');setBulkPartnerId('');setBulkVehicleId('');setBulkWarehouseId('');await load()}catch(x:any){setMsg(x.message)}}
 async function assign(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/billing/assignments',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(f)))});setMsg('Billing assignment saved.');f.reset();setAssignPartnerId('');await load()}catch(x:any){setMsg(x.message)}}
 async function unassign(id:number){if(!confirm('Remove this employee\'s billing assignment?'))return;try{await api(`/api/admin/billing/assignments/${id}`,{method:'DELETE'});setMsg('Assignment removed.');await load()}catch(x:any){setMsg(x.message)}}
 async function saveCompanyProfile(e:FormEvent<HTMLFormElement>){e.preventDefault();try{await api('/api/admin/billing/company-profile',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});setMsg('Company GST profile saved — this is what prints on every tax invoice.');await load()}catch(x:any){setMsg(x.message)}}
 async function saveContract(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/billing/vehicle-contracts',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(f)))});setMsg('Vehicle billing contract saved.');f.reset();await load()}catch(x:any){setMsg(x.message)}}
 async function disableContract(id:number){if(!confirm('Disable this rate contract? Past invoices are unaffected.'))return;try{await api(`/api/admin/billing/vehicle-contracts/${id}/disable`,{method:'PATCH',body:'{}'});await load()}catch(x:any){setMsg(x.message)}}

 if(!allowed)return <div className="p-10">Billing access requires Employee, Manager or Admin role.</div>;

 const errs:string[]=[];
 if(tried){
  if(!partner)errs.push('pick a partner');else if(!resource)errs.push(kind==='TRANSPORT'?'pick a vehicle':'pick a warehouse');
  if(!rowsOk)errs.push(`fill every highlighted cell${needProduct?' (including Product)':''} — distance must be more than 0`);
 }
 const bad=(on:boolean)=>tried&&on?'border-red-500 bg-red-50':'border-slate-300 bg-white';
 const steps=['Partner & '+(kind==='TRANSPORT'?'vehicle':'warehouse'),'Delivery rows','Generate Excel','Submit to manager'];
 const kpis:[string,any,string][]=[['Pending review',stats.pending,'bg-amber-600'],['Approved',stats.approved,'bg-green-700'],['Rejected',stats.rejected,'bg-red-700'],['Sent to partner',stats.sent,'bg-blue-700'],...(reviewer?[['Waiting for my review',stats.awaitingMyReview,'bg-violet-700'] as [string,any,string]]:[['Overdue >24h',stats.overdue,'bg-red-700'] as [string,any,string]])];

 return <>
 <div className="flex flex-col gap-1"><div className="text-sm text-slate-600">RefTech ERP › Billing</div><h1 className="text-3xl font-bold">Billing</h1><p className="text-slate-600">Create a bill for one delivery or many, check it as Excel, then send it to the partner's manager for review.</p></div>
 <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">{kpis.map(([a,b,dot])=><div key={a} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-600"><span className={`h-2 w-2 rounded-full ${dot}`}/>{a}</div><div className="mt-1 font-mono text-2xl font-bold">{b??0}</div></div>)}</div>
 {toast&&<div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 font-medium text-emerald-900"><span>{toast}</span><button type="button" onClick={()=>setToast('')} aria-label="Dismiss message" className="h-8 w-8 text-lg">×</button></div>}
 {msg&&<div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950"><span>{msg}</span><button type="button" onClick={()=>setMsg('')} aria-label="Dismiss message" className="h-8 w-8 text-lg">×</button></div>}

 {/* ============================== CREATE NEW BILL ============================== */}
 <section id="create-billing" className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <button type="button" onClick={()=>setCreateOpen(x=>!x)} aria-expanded={createOpen} className="flex min-h-16 w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
   <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white"><Plus className="h-5 w-5"/></span>
   <span className="flex-1"><span className="block text-lg font-bold text-slate-900">{editing?`Edit & resubmit ${editing.no}`:'Create New Bill'}</span><span className="block text-sm text-slate-600">{createOpen?'Partner → '+(kind==='TRANSPORT'?'Vehicle':'Warehouse')+' → delivery rows → Generate Excel → Submit':'Single delivery or many — one bill per partner and vehicle'}</span></span>
   <span className="text-sm font-semibold text-blue-700">{createOpen?'Hide':'Open'}</span>
   <ChevronDown className={`h-5 w-5 text-slate-600 transition-transform ${createOpen?'rotate-180':''}`}/>
  </button>
  {createOpen&&<div className="flex flex-col gap-5 border-t border-slate-200 p-5">
   {!editing&&<DraftNotice found={draft.found} foundAt={draft.foundAt} status={draft.status} onRestore={restoreDraft} onDiscard={draft.clear}/>}
   <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">{steps.map((label,i)=>{const n=i+1,done=n<step,cur=n===step;return <li key={label} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${cur?'border-blue-300 bg-blue-50':'border-slate-200 bg-white'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done?'bg-emerald-700 text-white':cur?'bg-blue-700 text-white':'bg-slate-200 text-slate-600'}`}>{done?'✓':n}</span><span className={`text-sm font-semibold ${cur?'text-blue-900':'text-slate-700'}`}>{label}</span></li>;})}</ol>

   {hasWarehouseBilling&&!editing&&<div role="radiogroup" aria-label="Billing for" className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
    {([['TRANSPORT','Vehicle',<Truck key="t" className="h-4 w-4"/>],['WAREHOUSE','Warehouse',<Warehouse key="w" className="h-4 w-4"/>]] as [Kind,string,ReactNode][]).map(([k,l,ic])=><button key={k} type="button" role="radio" aria-checked={kind===k} onClick={()=>changeKind(k)} className={`flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${kind===k?'bg-white text-slate-900 shadow-sm':'text-slate-600'}`}>{ic}{l}</button>)}
   </div>}

   <div className="grid gap-4 md:grid-cols-4 md:items-end">
    <div><label htmlFor="bill-partner" className={lab}>Partner *</label>
     <select id="bill-partner" value={partnerId} onChange={e=>{setPartnerId(e.target.value);setVehicleId('');setWarehouseId('');dropDeliveryRows();}} className={`${c} h-11 ${tried&&!partner?'border-red-500':''}`}>
      <option value="">{!opts.TRANSPORT?'Loading…':partnerList.length?'Select partner…':'No partner assigned to you'}</option>
      {partnerList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select></div>
    <div><label htmlFor="bill-resource" className={lab}>{kind==='TRANSPORT'?'Vehicle number *':'Warehouse *'}</label>
     <select id="bill-resource" value={resourceId} disabled={!partner} onChange={e=>{if(kind==='TRANSPORT'){setVehicleId(e.target.value);dropDeliveryRows();}else setWarehouseId(e.target.value);}} className={`${c} h-11 disabled:bg-slate-100 ${tried&&partner&&!resource?'border-red-500':''}`}>
      <option value="">{!partner?'Pick a partner first':resourceList.length?`Select… (${resourceList.length} with ${partner.name})`:kind==='TRANSPORT'?'No vehicle assigned to this partner':'No warehouse assigned to this partner'}</option>
      {resourceList.map(r=><option key={r.id} value={r.id}>{kind==='TRANSPORT'?r.vehicleNumber:r.name}</option>)}
     </select></div>
    <div><span className={lab}>Goes for review to</span><div className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700"><UserCheck className="h-4 w-4 shrink-0 text-slate-500"/><span className="truncate" title={reviewerText}>{reviewerText}</span></div></div>
    <div><span className={lab}>Bill type (automatic)</span><div className={`flex h-11 items-center rounded-xl px-3 text-sm font-semibold ${rows.length===1?'bg-amber-100 text-amber-900':'bg-indigo-100 text-indigo-900'}`}>{rows.length===1?'Single delivery':`Multiple deliveries (${rows.length})`}</div></div>
   </div>

   {/* REQ-TRP-003: delivered trips of this partner and truck that are not on a bill yet. One click fills the rows below. */}
   {kind==='TRANSPORT'&&partnerId&&vehicleId&&(dmrNote||dmrWaiting.length>0)&&(()=>{
    const inBill=new Set(rows.map(r=>r.dmrEntryId).filter(Boolean));
    const open=dmrWaiting.filter(e=>!inBill.has(e.id));
    return <div id="dmr-waiting" className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-bold text-slate-900">Delivered trips waiting for billing ({dmrWaiting.length})</h3><p className="text-sm text-slate-700">Each line comes from a proof of delivery. Add it and the row below is filled: date, DMR number, from, to and kilometres.</p></div>
      {open.length>1&&<button type="button" onClick={()=>addDmrRows(open)} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Add all {open.length} to the bill</button>}
     </div>
     {dmrNote&&<p className="mt-2 text-sm font-semibold text-amber-800">{dmrNote}</p>}
     {dmrWaiting.length>0&&<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
      <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600"><th className="p-2">Date</th><th className="p-2">Trip</th><th className="p-2">DMR No</th><th className="p-2">Proof</th><th className="p-2">From → To</th><th className="p-2 text-right">KM</th><th className="p-2 text-right">Delivered</th><th className="p-2">Received by</th><th className="p-2"/></tr></thead>
      <tbody>{dmrWaiting.map(e=><tr key={e.id} data-dmr-entry={e.id} className="border-t border-emerald-200 align-top">
       <td className="whitespace-nowrap p-2">{dmy(String(e.serviceDate||'').slice(0,10))}</td>
       <td className="p-2 font-semibold"><Link to={`/trips/${e.tripId}`} className="text-sky-700 hover:underline">{e.tripNumber}</Link></td>
       <td className="p-2 font-mono">{e.dmrNumber}</td><td className="p-2 font-mono">{e.podNumber}</td>
       <td className="p-2">{e.fromLocation||'-'} → {e.toLocation||'-'}{e.remarks?<div className="text-xs font-semibold text-amber-800">{e.remarks}</div>:null}{e.rejectedInvoiceNumber?<div className="text-xs text-slate-600">Was on rejected bill {e.rejectedInvoiceNumber}</div>:null}</td>
       <td className="p-2 text-right font-mono">{e.distanceKm!=null?Number(e.distanceKm).toFixed(1):'-'}</td>
       <td className="p-2 text-right">{e.deliveredQuantityTons!=null?`${fmtWeight(e.deliveredQuantityTons)}`:'-'}</td>
       <td className="p-2">{e.receiverName||'-'}</td>
       <td className="p-2 text-right">{inBill.has(e.id)?<span className="whitespace-nowrap rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-900">In the bill</span>:<button type="button" onClick={()=>addDmrRows([e])} className="whitespace-nowrap rounded-lg border border-emerald-600 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">Add to bill</button>}</td>
      </tr>)}</tbody>
     </table></div>}
    </div>;
   })()}

   <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full min-w-[1700px] border-collapse text-sm">
     <thead><tr className="bg-slate-900 text-left text-xs font-semibold uppercase tracking-wide text-white">
      <th className="w-10 p-2.5">#</th><th className="w-40 p-2.5">Date *</th><th className="w-32 p-2.5">Bill No</th><th className="w-32 p-2.5">DMR No *</th><th className="w-40 p-2.5">Product{needProduct?' *':''}</th><th className="min-w-[320px] p-2.5">From full address *</th><th className="min-w-[320px] p-2.5">To full address *</th><th className="w-40 p-2.5 text-right">Google Map KM</th><th className="w-36 p-2.5 text-right">Manual KM *</th><th className="w-28 p-2.5 text-center">Add / Remove</th>
     </tr></thead>
     <tbody>{rows.map((r,i)=>{const pr=rowProblems(r);return <tr key={r.id} className={`border-t border-slate-200 ${i%2?'bg-slate-50':'bg-white'}`}>
      <td className="p-2 font-mono text-slate-600">{i+1}</td>
      <td className="p-1.5"><input type="date" aria-label={`Date, row ${i+1}`} value={r.date} onChange={e=>patchRow(r.id,'date',e.target.value)} className={`${cell} ${bad(pr.date)}`}/></td>
      <td className="p-1.5"><input aria-label={`Bill number, row ${i+1}`} placeholder="Optional" value={r.billNo} onChange={e=>patchRow(r.id,'billNo',e.target.value)} className={`${cell} border-slate-300 font-mono`}/></td>
      <td className="p-1.5"><input aria-label={`DMR number, row ${i+1}`} placeholder="e.g. 45120" value={r.dmrNo} onChange={e=>patchRow(r.id,'dmrNo',e.target.value)} className={`${cell} ${bad(pr.dmrNo)} font-mono`}/></td>
      <td className="p-1.5"><select aria-label={`Product, row ${i+1}`} value={r.productId} onChange={e=>patchRow(r.id,'productId',e.target.value)} disabled={!productList.length} className={`${cell} ${bad(pr.productId)} disabled:bg-slate-100`}><option value="">{productList.length?'Select…':'—'}</option>{productList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
      <td className="p-1.5"><textarea rows={3} aria-label={`From full address, row ${i+1}`} placeholder="Enter complete pickup address: building, road, area, city, state, PIN" value={r.from} onChange={e=>{patchRow(r.id,'from',e.target.value);patchRow(r.id,'googleKm','');}} className={`${cell} min-h-[76px] resize-y ${bad(pr.from)}`}/></td>
      <td className="p-1.5"><textarea rows={3} aria-label={`To full address, row ${i+1}`} placeholder="Enter complete delivery address: building, road, area, city, state, PIN" value={r.to} onChange={e=>{patchRow(r.id,'to',e.target.value);patchRow(r.id,'googleKm','');}} className={`${cell} min-h-[76px] resize-y ${bad(pr.to)}`}/></td>
      <td className="p-1.5 align-top"><div className="space-y-2"><div className="flex h-10 items-center justify-end rounded-lg border border-sky-200 bg-sky-50 px-2 font-mono font-bold text-sky-900">{r.googleKm?`${r.googleKm} km`:'—'}</div><button type="button" disabled={googleLoading[r.id]||!r.from.trim()||!r.to.trim()} onClick={()=>calculateGoogleKm(r)} className="w-full rounded-lg bg-sky-700 px-2 py-2 text-xs font-semibold text-white disabled:opacity-40">{googleLoading[r.id]?'Calculating…':'Calculate Google KM'}</button></div></td>
      <td className="p-1.5 align-top"><input type="number" min="0" step="0.1" inputMode="decimal" aria-label={`Manual distance in km, row ${i+1}`} placeholder="Enter KM" value={r.km} onChange={e=>patchRow(r.id,'km',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&i===rows.length-1){e.preventDefault();addRowBelow(i);}}} className={`${cell} ${bad(pr.km)} text-right font-mono`}/><div className="mt-1 text-[11px] text-slate-500">Used for billing</div></td>
      <td className="p-1.5"><div className="flex justify-center gap-2">
       <button type="button" onClick={()=>addRowBelow(i)} aria-label={`Add a row below row ${i+1}`} title="Add row below" className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"><Plus className="h-5 w-5"/></button>
       <button type="button" onClick={()=>removeRow(r.id)} disabled={rows.length===1} aria-label={`Remove row ${i+1}`} title="Remove row" className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"><Minus className="h-5 w-5"/></button>
      </div></td>
     </tr>;})}</tbody>
     <tfoot><tr className="border-t-2 border-slate-900 bg-slate-50 font-bold"><td/><td className="p-2.5">Total</td><td colSpan={6} className="p-2.5 font-medium text-slate-600">{rows.length} {rows.length===1?'delivery':'deliveries'}{period?` · ${period}`:''}</td><td className="p-2.5 text-right text-xs text-slate-500">Estimate only</td><td className="p-2.5 text-right font-mono">{totalKm.toFixed(1)}</td><td/></tr></tfoot>
    </table>
   </div>
   <p className="-mt-2 text-sm text-slate-600">Tip: enter complete From/To addresses, click <b>Calculate Google KM</b>, then enter/confirm the <b>Manual KM</b>. Manual KM remains the distance used for billing. <b>+</b> copies the date/product and starts the next row from the previous destination.</p>

   {errs.length>0&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">Before generating the Excel: {errs.join('; ')}.</div>}

   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
    <div className="flex gap-2">
     <button type="button" onClick={resetCreate} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">{editing?'Cancel edit':'Clear form'}</button>
    </div>
    <div className="flex flex-wrap gap-3">
     <button type="button" onClick={generateExcel} disabled={busy} className="flex h-11 items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-50"><FileSpreadsheet className="h-5 w-5"/>{excelReady?'Download Excel again':'Generate Excel'}</button>
     <button type="button" onClick={submitBill} disabled={!excelReady||busy} className="flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><Send className="h-5 w-5"/>{editing?'Resubmit to Manager':'Submit to Manager'}</button>
    </div>
   </div>
   {!excelReady&&<p className="-mt-3 text-right text-sm text-slate-600">{excelSig&&excelSig!==sig?'You changed the rows after generating the Excel — generate it again to submit.':'Submit unlocks after you generate the Excel and check it.'}</p>}

   {excelReady&&<div className="overflow-hidden rounded-xl border border-emerald-200">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-700 px-4 py-2.5 text-white"><span className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4"/>{excelName||'Excel'} — downloaded. This is what the reviewer will get.</span><button type="button" onClick={generateExcel} className="h-9 rounded-lg border border-white px-3 text-sm font-semibold">Download again</button></div>
    <div className="overflow-x-auto bg-white"><table className="w-full min-w-[900px] border-collapse text-sm">
     <tbody>
      <tr><td colSpan={8} className="border border-slate-200 p-2 text-base font-bold">RefTech SCS 5PL — Delivery Bill (DMR log)</td></tr>
      <tr><td className="border border-slate-200 p-1.5 font-semibold">Bill No</td><td colSpan={3} className="border border-slate-200 p-1.5">{editing?editing.no:'Draft — number given on submit'}</td><td className="border border-slate-200 p-1.5 font-semibold">Partner</td><td colSpan={3} className="border border-slate-200 p-1.5">{partner?.name}</td></tr>
      <tr><td className="border border-slate-200 p-1.5 font-semibold">{kind==='TRANSPORT'?'Vehicle':'Warehouse'}</td><td colSpan={3} className="border border-slate-200 p-1.5 font-mono">{resourceLabel}</td><td className="border border-slate-200 p-1.5 font-semibold">Reviewer</td><td colSpan={3} className="border border-slate-200 p-1.5">{reviewerText}</td></tr>
      <tr><td className="border border-slate-200 p-1.5 font-semibold">Period</td><td colSpan={3} className="border border-slate-200 p-1.5">{period}</td><td className="border border-slate-200 p-1.5 font-semibold">Bill type</td><td colSpan={3} className="border border-slate-200 p-1.5">{rows.length===1?'Single delivery':`Multiple deliveries (${rows.length})`}</td></tr>
      <tr className="bg-slate-900 font-semibold text-white">{['S.No','Date','Bill No','DMR No','Product','From Location','To Location','Distance (KM)'].map(h=><td key={h} className={`border border-slate-700 p-1.5 ${h.startsWith('Distance')?'text-right':''}`}>{h}</td>)}</tr>
      {rows.map((r,i)=><tr key={r.id}><td className="border border-slate-200 p-1.5">{i+1}</td><td className="border border-slate-200 p-1.5">{dmy(r.date)}</td><td className="border border-slate-200 p-1.5 font-mono">{r.billNo}</td><td className="border border-slate-200 p-1.5 font-mono">{r.dmrNo}</td><td className="border border-slate-200 p-1.5">{productName(r.productId)}</td><td className="border border-slate-200 p-1.5">{r.from}</td><td className="border border-slate-200 p-1.5">{r.to}</td><td className="border border-slate-200 p-1.5 text-right font-mono">{(Number(r.km)||0).toFixed(1)}</td></tr>)}
      <tr className="bg-emerald-50 font-bold"><td colSpan={7} className="border border-slate-200 p-1.5 text-right">Total distance (KM)</td><td className="border border-slate-200 p-1.5 text-right font-mono">{totalKm.toFixed(1)}</td></tr>
     </tbody>
    </table></div>
   </div>}
  </div>}
 </section>

 {/* ============================== SUBMITTED BILL STATUS ============================== */}
 <section id="bill-status" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-bold">Submitted Bill Status</h2><p className="text-sm text-slate-600">{reviewer?'Your bills, your team\'s bills, and bills sent to you as the partner\'s manager — newest first.':'Bills you\'ve sent for review, newest first.'}</p></div>
   <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5">{filters.map(([k,l])=><button key={k} type="button" role="tab" aria-selected={filter===k} onClick={()=>setFilter(k)} className={`h-9 rounded-full border px-3.5 text-sm font-semibold ${filter===k?'border-slate-900 bg-slate-900 text-white':'border-slate-300 bg-white text-slate-700'}`}>{l}</button>)}</div>
   <div className="mt-3 w-full"><PagerBar list={list} placeholder="Search bill number, tax invoice number, type or month" exportName="bills" sorts={[['invoiceDate','Date'],['invoiceNumber','Bill number'],['totalAmount','Total'],['status','Status']]}/></div>
  </div>
  <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1100px] border-collapse text-sm">
   <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-600"><th className="p-2.5">Bill No</th><th className="p-2.5">Partner</th><th className="p-2.5">Vehicle / Warehouse</th><th className="p-2.5">Deliveries</th><th className="p-2.5 text-right">Total km</th><th className="p-2.5 text-right">Amount</th><th className="p-2.5">Submitted</th>{reviewer&&<th className="p-2.5">Created by</th>}<th className="p-2.5">Reviewer</th><th className="p-2.5">Status</th><th className="p-2.5">Actions</th></tr></thead>
   <tbody>{shown.map(i=>{const st=STATUS[i.status]||{label:i.status,cls:'bg-slate-100 text-slate-800',dot:'bg-slate-600'};const lc=Number(i.lineCount||0);const open=expanded===i.id;return [
    <tr key={i.id} className={`border-b border-slate-100 ${i.canReview?'bg-violet-50/50':''}`}>
     <td className="p-2.5 font-mono font-semibold">{i.invoiceNumber}{i.taxInvoiceNumber&&<div className="font-sans text-xs font-medium text-emerald-800">Tax Inv. {i.taxInvoiceNumber}</div>}{i.invoiceMode==='MONTHLY_VEHICLE'&&<span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-sans text-xs font-medium text-slate-700">Monthly</span>}{i.pricingBasis==='PER_TON'&&<span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 font-sans text-xs font-medium text-indigo-800">Per ton</span>}{i.pricingBasis==='STORAGE'&&<span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 font-sans text-xs font-medium text-sky-800">Warehouse</span>}</td>
     <td className="p-2.5">{i.partnerName}</td>
     <td className="p-2.5 font-mono text-xs">{i.vehicleNumber||i.warehouseName||'—'}</td>
     <td className="p-2.5">{lc===1?'1 (single)':lc||'—'}</td>
     <td className="p-2.5 text-right font-mono">{Number(i.totalKm||0).toFixed(1)}{i.pricingBasis==='PER_TON'&&i.totalTons!=null&&<div className="font-sans text-xs text-slate-600">{fmtWeight(i.totalTons)}</div>}</td>
     <td className="p-2.5 text-right font-mono">{Number(i.totalAmount)>0?<span className="font-semibold">{rupee(i.totalAmount)}</span>:<span className="text-slate-500">—</span>}{Number(i.ratePerKm)>0&&i.pricingBasis!=='PER_TRIP'&&<div className="font-sans text-xs text-slate-600">@ {fmtMoney(i.ratePerKm)}/km</div>}{i.pricingBasis==='PER_TRIP'&&<div className="font-sans text-xs text-slate-600">per trip</div>}
      {i.outstanding!=null&&['APPROVED','SENT','PAID'].includes(i.status)&&<div className="font-sans text-xs">{Number(i.outstanding)>1?<span className={i.dueDate&&String(i.dueDate).slice(0,10)<today()?'font-semibold text-red-700':'text-amber-800'}>Owed {rupee(i.outstanding)}{i.dueDate?` · due ${dmy(String(i.dueDate))}`:''}</span>:<span className="text-emerald-800">Received {rupee(Number(i.receivedAmount||0)+Number(i.tdsAmount||0))}</span>}</div>}
      {i.irn&&i.irnStatus!=='CANCELLED'&&<div className="font-sans text-xs text-indigo-800">e-invoice IRN ✓</div>}</td>
     <td className="p-2.5 text-slate-700">{when(i.submittedAt)}</td>
     {reviewer&&<td className="p-2.5">{i.mine?'You':i.createdBy}</td>}
     <td className="p-2.5">{reviewerOf(i)}</td>
     <td className="p-2.5"><div className="flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${st.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`}/>{st.label}</span>
      <span className="text-xs text-slate-600">{i.status==='REJECTED'?(i.reviewNotes||'See reason'):i.status==='PENDING_REVIEW'?(i.overdue?'Overdue — waiting more than 24 h':i.resubmitCount>0?`Resubmitted (${i.resubmitCount}×)`:'Waiting for reviewer'):i.status==='APPROVED'?`By ${i.reviewedBy||'reviewer'}${Number(i.gstRate)>0?` · GST ${Number(i.gstRate)}%`:''}`:i.status==='SENT'?`Sent ${when(i.sentAt)}`:''}</span>
     </div></td>
     <td className="p-2.5"><div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={()=>toggleDetail(i.id)} className="flex items-center gap-1 text-sm font-semibold text-blue-700"><Eye className="h-4 w-4"/>{open?'Hide':i.canReview?'Review':'View'}</button>
      {i.invoiceMode!=='MONTHLY_VEHICLE'&&<button type="button" onClick={()=>apiDownload(`/api/admin/billing/invoices/${i.id}/dmr.xlsx`,`${i.invoiceNumber}.xlsx`).catch((e:any)=>setMsg(e.message))} className="flex items-center gap-1 text-sm font-semibold text-emerald-800"><Download className="h-4 w-4"/>Excel</button>}
      {i.canResubmit&&<button type="button" onClick={()=>startResubmit(i)} className="flex items-center gap-1 text-sm font-semibold text-amber-800"><RotateCcw className="h-4 w-4"/>Edit &amp; resubmit</button>}
      {i.taxInvoiceNumber&&<button type="button" onClick={()=>apiDownload(`/api/admin/billing/invoices/${i.id}/tax-invoice.pdf`,`TaxInvoice_${String(i.taxInvoiceNumber).replace(/[^A-Za-z0-9-]/g,'_')}.pdf`).catch((e:any)=>setMsg(e.message))} className="flex items-center gap-1 text-sm font-semibold text-red-800"><FileText className="h-4 w-4"/>Tax Invoice</button>}
      {i.canMarkSent&&<button type="button" onClick={()=>markSent(i.id)} className="flex items-center gap-1 text-sm font-semibold text-blue-800"><Send className="h-4 w-4"/>Send to partner</button>}
     </div></td>
    </tr>,
    open&&<tr key={`${i.id}-d`} className="border-b border-slate-200 bg-slate-50"><td colSpan={reviewer?11:10} className="p-4">
     {!detailLines[i.id]?<div className="text-sm text-slate-600">Loading rows…</div>:detailLines[i.id].length===0?<div className="text-sm text-slate-600">No delivery rows on this bill.</div>:i.pricingBasis==='STORAGE'?
     <table className="w-full border-collapse bg-white text-sm"><thead><tr className="bg-slate-200 text-left text-xs uppercase text-slate-700"><th className="p-2">#</th><th className="p-2">Charge</th><th className="p-2 text-right">Quantity</th><th className="p-2">Unit</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead>
      <tbody>{detailLines[i.id].map((l:any,n:number)=><tr key={l.id} className="border-t border-slate-200"><td className="p-2">{n+1}</td><td className="p-2">{l.remarks}</td><td className="p-2 text-right font-mono">{l.quantity!=null?Number(l.quantity):''}</td><td className="p-2">{String(l.unit||'').toLowerCase().replace('_','-')}</td><td className="p-2 text-right font-mono">{l.unitRate!=null?Number(l.unitRate).toLocaleString('en-IN'):''}</td><td className="p-2 text-right font-mono">{rupee(l.taxableAmount)}</td></tr>)}</tbody></table>:
     <table className="w-full border-collapse bg-white text-sm"><thead><tr className="bg-slate-200 text-left text-xs uppercase text-slate-700"><th className="p-2">#</th><th className="p-2">Date</th><th className="p-2">Bill No</th><th className="p-2">DMR No</th><th className="p-2">Product</th><th className="p-2">From</th><th className="p-2">To</th><th className="p-2 text-right">KM</th>{i.pricingBasis==='PER_TON'&&<><th className="p-2 text-right">Tons</th><th className="p-2 text-right">Rate/t</th><th className="p-2 text-right">Amount</th><th className="p-2">Load</th></>}</tr></thead>
      <tbody>{detailLines[i.id].map((l:any,n:number)=><tr key={l.id} className="border-t border-slate-200"><td className="p-2">{n+1}</td><td className="p-2">{dmy(String(l.serviceDate||''))}</td><td className="p-2 font-mono">{l.billNumber}</td><td className="p-2 font-mono">{l.dmrNumber}</td><td className="p-2">{l.productName}</td><td className="p-2">{l.fromLocation}</td><td className="p-2">{l.toLocation}</td><td className="p-2 text-right font-mono">{Number(l.distanceKm||0).toFixed(1)}</td>
       {i.pricingBasis==='PER_TON'&&<><td className="p-2 text-right font-mono">{Number(l.quantityTons||0)}</td><td className="p-2 text-right font-mono">{Number(l.ratePerTon||0).toLocaleString('en-IN')}</td><td className="p-2 text-right font-mono">{rupee(l.taxableAmount)}</td><td className="p-2 text-xs">{l.remarks}</td></>}</tr>)}</tbody></table>}
     {i.taxInvoiceNumber&&<div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><span><b>Tax Invoice</b> {i.taxInvoiceNumber}</span><span>{i.pricingBasis==='STORAGE'?'Warehouse storage and handling':i.pricingBasis==='PER_TON'?`${Number(i.totalTons||0)} t billed per ton`:`${Number(i.totalKm||0).toFixed(1)} km × ${fmtMoney(i.ratePerKm)}`}</span><span>Taxable {rupee(i.amount)}</span><span>{Number(i.igstAmount)>0?`IGST ${rupee(i.igstAmount)}`:`CGST ${rupee(i.cgstAmount)} + SGST ${rupee(i.sgstAmount)}`}</span><span className="font-bold">Total {rupee(i.totalAmount)}</span></div>}
     {i.status==='REJECTED'&&i.reviewNotes&&<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>Reason:</b> {i.reviewNotes}</div>}
     {i.canReview&&(()=>{const storage=i.pricingBasis==='STORAGE',perTon=i.pricingBasis==='PER_TON'||storage;const monthly=i.invoiceMode==='MONTHLY_VEHICLE'||perTon;const sg=suggestFor[i.id],perTrip=pricingFor[i.id]==='PER_TRIP',trips=Number(i.lineCount||0),tripRate=Number(tripRateFor[i.id]||0);
      const km=Number(i.totalKm||0),rate=Number(rateFor[i.id]||0),gst=Number(gstFor[i.id]??'18');
      const tripTaxable=sg?.perTrip?.mixed&&String(Number(sg.perTrip.rate))===String(tripRateFor[i.id]||'')?Number(sg.perTrip.amount):Math.round(trips*tripRate*100)/100;
      const taxable=perTon?Number(i.amount||0):perTrip?tripTaxable:Math.round(km*rate*100)/100,tax=Math.round(taxable*gst)/100,total=Math.round(taxable+tax);return <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4">
      {!monthly&&sg&&<div className={`mb-3 rounded-lg p-2.5 text-sm ${sg.found&&(sg.perKm||sg.perTrip)?'bg-emerald-50 text-emerald-900':'bg-slate-50 text-slate-700'}`}>{sg.message||sg.text}{sg.perKm?.mixed&&!perTrip&&<span> Each delivery row is priced at its own lane rate; the rate shown is the average.</span>}{sg.palletDay&&<span> Pallet-day rate in the contract: {fmtMoney(sg.palletDay.rate)}.</span>}</div>}
      {!monthly&&<div role="radiogroup" aria-label="Price this bill" className="mb-3 flex w-fit gap-1 rounded-xl bg-slate-100 p-1">{([['PER_KM','Per km'],['PER_TRIP','Per trip']] as const).map(([k,l])=><button key={k} type="button" role="radio" aria-checked={(pricingFor[i.id]||'PER_KM')===k} onClick={()=>setPricingFor(x=>({...x,[i.id]:k}))} className={`h-9 rounded-lg px-4 text-sm font-semibold ${(pricingFor[i.id]||'PER_KM')===k?'bg-white text-slate-900 shadow-sm':'text-slate-600'}`}>{l}</button>)}</div>}
      <div className="text-sm font-bold text-violet-900">{storage?'Approve storage bill & generate Tax Invoice':perTon?'Approve per-ton bill & generate Tax Invoice':monthly?'Approve monthly bill':'Approve & generate Tax Invoice'}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_140px_1fr] md:items-end">
       {!monthly&&!perTrip&&<div><label htmlFor={`rate-${i.id}`} className={lab}>Rate per KM (₹) *</label><input id={`rate-${i.id}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 20.75" value={rateFor[i.id]||''} onChange={e=>setRateFor(x=>({...x,[i.id]:e.target.value}))} className={`${c} h-11 font-mono`}/></div>}
       {!monthly&&perTrip&&<div><label htmlFor={`trip-${i.id}`} className={lab}>Rate per trip (₹) *</label><input id={`trip-${i.id}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder="e.g. 6500" value={tripRateFor[i.id]||''} onChange={e=>setTripRateFor(x=>({...x,[i.id]:e.target.value}))} className={`${c} h-11 font-mono`}/></div>}
       <div><label htmlFor={`gst-${i.id}`} className={lab}>GST %</label><input id={`gst-${i.id}`} type="number" step="0.01" value={gstFor[i.id]??'18'} onChange={e=>setGstFor(x=>({...x,[i.id]:e.target.value}))} className={`${c} h-11 font-mono`}/></div>
       {perTon&&<div className="rounded-xl bg-slate-50 p-3 font-mono text-sm leading-6">
        <div>{storage?'Storage, handling and services':`${Number(i.totalTons||0)} t, priced per ton`} = <b>{rupee(taxable)}</b></div>
        <div>+ GST {gst}% = {rupee(tax)} <span className="font-sans text-xs text-slate-600">(IGST, or CGST+SGST when partner is in the same state)</span></div>
        <div className="text-base">Invoice total (rounded): <b className="text-emerald-800">{rupee(total)}</b></div>
       </div>}
       {!monthly&&<div className="rounded-xl bg-slate-50 p-3 font-mono text-sm leading-6">
        <div>{perTrip?<>{trips} {trips===1?'trip':'trips'}{sg?.perTrip?.mixed?' at their lane rates':` × ${fmtMoney(tripRate||0)}`}</>:<>{km.toFixed(1)} km × {fmtMoney(rate||0)}</>} = <b>{rupee(taxable)}</b></div>
        <div>+ GST {gst}% = {rupee(tax)} <span className="font-sans text-xs text-slate-600">(IGST, or CGST+SGST when partner is in the same state)</span></div>
        <div className="text-base">Invoice total (rounded): <b className="text-emerald-800">{rupee(total)}</b></div>
       </div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={()=>approve(i)} disabled={!monthly&&!((perTrip?tripRate:rate)>0)&&!(perTrip?sg?.perTrip:sg?.perKm)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-45"><CheckCircle2 className="h-5 w-5"/>{perTon?'Approve & generate bill':monthly?'Approve':'Approve & generate bill'}</button></div>
      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-[1fr_auto] md:items-end">
       <div><label htmlFor={`why-${i.id}`} className={lab}>Or reject — reason</label><input id={`why-${i.id}`} placeholder="e.g. DMR 45002 is repeated — please fix" value={reasonFor[i.id]||''} onChange={e=>setReasonFor(x=>({...x,[i.id]:e.target.value}))} className={`${c} h-11`}/></div>
       <button type="button" onClick={()=>reject(i.id)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-400 bg-red-50 px-4 text-sm font-semibold text-red-800"><XCircle className="h-5 w-5"/>Reject</button>
      </div>
     </div>;})()}
    </td></tr>,
   ];})}</tbody>
  </table>
  {shown.length===0&&<div className="p-6 text-center text-sm text-slate-600">{(counts.ALL||0)?'No bills with this status.':'No bills yet — open Create New Bill above to raise your first one.'}</div>}
  </div>
 </section>

 {/* ============================== MANAGER / ADMIN TOOLS (collapsed) ============================== */}
 {reviewer&&<Collapsible id="monthly-vehicle-bill" title="Monthly Vehicle Bill" subtitle="Auto-calculated Fixed Cost + Additional KM tax invoice from the vehicle's rate contract" icon={<ReceiptText className="h-5 w-5"/>} open={!!openSec.monthly} onToggle={()=>toggleSec('monthly')} accent="bg-indigo-700">
  <form onSubmit={submitMonthly} className="grid gap-3 md:grid-cols-4">
   <div><label className={lab}>Partner / Client *</label><select name="partnerId" required value={mvPartner} onChange={e=>setMvPartner(e.target.value)} className={c}><option value="">Select</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
   <div><label className={lab}>Vehicle *</label><select name="vehicleId" required value={mvVehicle} onChange={e=>setMvVehicle(e.target.value)} className={c}><option value="">Select</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select></div>
   <div><label className={lab}>Billing Month *</label><input name="billingPeriodMonth" type="month" required value={mvMonth} onChange={e=>setMvMonth(e.target.value)} className={c}/></div>
   <input type="hidden" name="billingDate" value={today()}/>
   <div className="rounded-xl bg-sky-50 p-4 md:col-span-4">
    {!mvVehicle||!mvPartner?<p className="text-sm text-slate-600">Pick the vehicle and partner above to load the rate contract.</p>:mvErr?<p className="text-sm font-semibold text-red-700">{mvErr} — set one up under Vehicle Billing Contracts first.</p>:!mvContract?<p className="text-sm text-slate-600">Loading contract…</p>:<>
     <div className="grid gap-2 text-sm md:grid-cols-4"><div>Fixed/Month: <b>{fmtMoney(mvFixed)}</b></div><div>Basis Days: <b>{mvBasisDays}</b></div><div>Included KM: <b>{mvIncludedKm}</b></div><div>Extra KM Rate: <b>{fmtMoney(mvExtraRate)}</b> · GST <b>{mvGst}%</b></div></div>
     <div className="mt-3"><label className={lab}>Total KM run this month *</label><input name="totalKm" type="number" step="0.01" required value={mvTotalKm} onChange={e=>setMvTotalKm(e.target.value)} className={`${c} md:w-64`}/></div>
     <div className="mt-3 rounded-lg bg-white p-3 text-sm"><div>Fixed Cost: {fmtMoney(mvFixed)}/{mvBasisDays}×{mvDaysInMonth} = <b>{fmtMoney(mvFixedProrated)}</b></div>{mvExtraKm>0&&<div>Additional: {mvExtraKm.toFixed(2)} KM × {fmtMoney(mvExtraRate)} = <b>{fmtMoney(mvExtraAmount)}</b></div>}<div className="mt-1">Taxable Amount: <b>{fmtMoney(mvAmount)}</b> + GST {mvGst}% ({fmtMoney(mvTax)}) = <b className="text-lg">Total {fmtMoney(mvTotal)}</b></div></div>
    </>}
   </div>
   <input name="description" placeholder="Description (auto-filled if left blank)" className={`${c} md:col-span-4`}/><input type="hidden" name="amount" value="0"/><input type="hidden" name="otherCharges" value="0"/><input type="hidden" name="taxAmount" value="0"/>
   <details className="rounded-xl border p-4 md:col-span-4"><summary className="cursor-pointer font-semibold">Attach supporting DMR / daily distance log (optional)</summary><div className="mt-4 space-y-4">{lines.map((l,i)=><div key={i} className="rounded-xl border p-4"><div className="mb-3 flex justify-between"><b>DMR Row {i+1}</b>{lines.length>1&&<button type="button" onClick={()=>setLines(x=>x.filter((_,n)=>n!==i))} className="text-red-700" aria-label={`Remove DMR row ${i+1}`}><Trash2 className="h-4 w-4"/></button>}</div><div className="grid gap-2 md:grid-cols-4"><input type="date" value={l.serviceDate} onChange={e=>patchLine(i,'serviceDate',e.target.value)} className={c}/><input placeholder="DMR / receipt no." value={l.dmrNumber} onChange={e=>patchLine(i,'dmrNumber',e.target.value)} className={c}/><select value={l.productId} onChange={e=>patchLine(i,'productId',e.target.value)} className={c}><option value="">Product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input placeholder="Distance KM" type="number" value={l.distanceKm} onChange={e=>patchLine(i,'distanceKm',e.target.value)} className={c}/><input placeholder="From location" value={l.fromLocation} onChange={e=>patchLine(i,'fromLocation',e.target.value)} className={c}/><input placeholder="To location" value={l.toLocation} onChange={e=>patchLine(i,'toLocation',e.target.value)} className={c}/></div></div>)}<button type="button" onClick={()=>setLines(x=>[...x,emptyLine()])} className="rounded-xl border px-4 py-2 font-semibold"><Plus className="inline h-4 w-4"/> Add another DMR row</button></div></details>
   <button className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white md:col-span-4">Create Monthly Bill</button>
  </form>
 </Collapsible>}

 {reviewer&&<Collapsible id="employee-assignments" title="Employee Billing Assignment" subtitle="Which partner (and vehicle/warehouse) each employee may bill against" icon={<Users className="h-5 w-5"/>} open={!!openSec.assign} onToggle={()=>toggleSec('assign')}>
  <form onSubmit={assign} className="grid gap-3 md:grid-cols-4"><select name="employeeId" required className={c}><option value="">Employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.employeeCode} - {e.firstName} {e.lastName}</option>)}</select><select name="partnerId" required value={assignPartnerId} onChange={e=>setAssignPartnerId(e.target.value)} className={c}><option value="">Partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name} ({p.serviceScope})</option>)}</select>{(!assignPartnerScope||assignPartnerScope!=='WAREHOUSE')&&<select name="vehicleId" className={c}><option value="">No vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select>}{(!assignPartnerScope||assignPartnerScope!=='TRANSPORT')&&<select name="warehouseId" className={c}><option value="">No warehouse</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}<button className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white md:col-span-4">Save Billing Assignment</button></form>
  <div className="mt-5"><div className="text-sm font-semibold text-slate-600">Current assignments ({billingAssignments.length})</div><div className="mt-2 space-y-2">{billingAssignments.length===0&&<div className="text-sm text-slate-500">No employees assigned yet — use the form above.</div>}{billingAssignments.map(x=><div key={x.id} className="flex items-center justify-between rounded-xl border p-3"><div><b>{x.employeeName}</b><span className="ml-2 text-sm text-slate-600">→ {x.partnerName}{x.vehicleNumber?` · ${x.vehicleNumber}`:''}{x.warehouseName?` · ${x.warehouseName}`:''}</span></div><button type="button" onClick={()=>unassign(x.id)} className="rounded-xl border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700">Unassign</button></div>)}</div></div>
  <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Assign a Manager + their whole team</h3><p className="text-sm text-slate-600">Pick a manager and a partner once — every employee reporting to that manager (plus the manager) gets the same assignment.</p>
   <form onSubmit={assignBulk} className="mt-3 grid gap-3 md:grid-cols-4">
    <select value={bulkManagerId} onChange={e=>setBulkManagerId(e.target.value)} className={c}><option value="">Manager</option>{managers.map((m:any)=><option key={m.id} value={m.id}>{m.employeeCode} - {m.firstName} {m.lastName}</option>)}</select>
    <select value={bulkPartnerId} onChange={e=>setBulkPartnerId(e.target.value)} className={c}><option value="">Partner</option>{partners.map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.serviceScope})</option>)}</select>
    {(!bulkPartnerScope||bulkPartnerScope!=='WAREHOUSE')&&<select value={bulkVehicleId} onChange={e=>setBulkVehicleId(e.target.value)} className={c}><option value="">No vehicle</option>{vehicles.map((v:any)=><option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select>}
    {(!bulkPartnerScope||bulkPartnerScope!=='TRANSPORT')&&<select value={bulkWarehouseId} onChange={e=>setBulkWarehouseId(e.target.value)} className={c}><option value="">No warehouse</option>{warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}
    <button className="rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white md:col-span-4">Assign Manager + Team ({bulkTeam.length||0})</button>
   </form>
   {bulkManagerId&&<div className="mt-2 text-sm text-slate-600">Will assign: {bulkTeam.length?bulkTeam.map((e:any)=>`${e.firstName} ${e.lastName}`).join(', '):'manager only (no one currently reports to them)'}</div>}
  </div>
 </Collapsible>}

 <Collapsible id="vehicle-partner-assignment" title="Assign Vehicle to Partner" subtitle="Hand a truck to a partner, or take it back" icon={<Truck className="h-5 w-5"/>} open={!!openSec.vp} onToggle={()=>toggleSec('vp')}>
  <div className="space-y-2">{allVehicles.map((v:any)=><div key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2"><span className="flex-1">{v.vehicleNumber} {v.partnerName?`→ ${v.partnerName}`:<span className="text-slate-500">unassigned</span>}</span><select aria-label={`Partner for ${v.vehicleNumber}`} className={`${c} md:w-64`} value={vpPick[v.id]||''} onChange={e=>setVpPick(x=>({...x,[v.id]:e.target.value}))}><option value="">Select partner…</option>{allPartners.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button type="button" onClick={()=>assignVehiclePartner(v.id)} disabled={!vpPick[v.id]} className="rounded-xl bg-cyan-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Assign</button>{v.partnerName&&<button type="button" onClick={()=>unassignVehiclePartner(v.id)} className="rounded-xl border border-red-300 px-3 py-2.5 text-sm font-semibold text-red-700">Unassign</button>}</div>)}{allVehicles.length===0&&<div className="text-sm text-slate-500">No vehicles in the fleet yet.</div>}</div>
 </Collapsible>

 {admin&&<Collapsible id="company-gst-profile" title="Company GST Profile & Email" subtitle="Letterhead, GSTIN, state code and bank details printed on every Tax Invoice — plus an email test" icon={<Settings className="h-5 w-5"/>} open={!!openSec.gst} onToggle={()=>toggleSec('gst')}>
  <form onSubmit={saveCompanyProfile} className="grid gap-3 md:grid-cols-4"><div className="md:col-span-2"><label className={lab}>Legal Name *</label><input name="legalName" required defaultValue={companyProfile.legalName||''} className={c}/></div><div><label className={lab}>GSTIN</label><input name="gstin" defaultValue={companyProfile.gstin||''} className={c}/></div><div><label className={lab}>Default HSN/SAC</label><input name="defaultHsnSac" defaultValue={companyProfile.defaultHsnSac||'9966'} className={c}/></div><div className="md:col-span-3"><label className={lab}>Registered Address</label><input name="address" defaultValue={companyProfile.address||''} className={c}/></div><div><label className={lab}>State</label><input name="stateName" defaultValue={companyProfile.stateName||''} className={c}/></div><div><label className={lab}>State Code</label><input name="stateCode" maxLength={2} placeholder="e.g. 29" defaultValue={companyProfile.stateCode||''} className={c}/><p className="mt-1 text-xs text-slate-600">First 2 digits of the GSTIN.</p></div><div><label className={lab}>Email</label><input name="email" type="email" defaultValue={companyProfile.email||''} className={c}/></div><div><label className={lab}>Phone</label><input name="phone" defaultValue={companyProfile.phone||''} className={c}/></div><div><label className={lab}>Bank Account Name</label><input name="bankAccountName" defaultValue={companyProfile.bankAccountName||''} className={c}/></div><div><label className={lab}>Bank Name</label><input name="bankName" defaultValue={companyProfile.bankName||''} className={c}/></div><div><label className={lab}>Account Number</label><input name="bankAccountNumber" defaultValue={companyProfile.bankAccountNumber||''} className={c}/></div><div><label className={lab}>IFSC Code</label><input name="bankIfscCode" defaultValue={companyProfile.bankIfscCode||''} className={c}/></div><button className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white md:col-span-4">Save Company Profile</button></form>
  <div className="mt-6 border-t pt-5"><h3 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4"/>Email check</h3><p className="text-sm text-slate-600">Sends one test email using the SMTP settings the backend is running with. Bills for review, approvals and invoices to partners all use this.</p>
   <div className="mt-3 flex flex-wrap gap-2"><label htmlFor="test-to" className="sr-only">Send test email to</label><input id="test-to" type="email" placeholder="you@example.com" value={testTo} onChange={e=>setTestTo(e.target.value)} className={`${c} md:w-80`}/><button type="button" onClick={sendTestEmail} disabled={testBusy} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{testBusy?'Sending…':'Send test email'}</button></div>
   {testResult&&<div role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${testResult.sent?'bg-emerald-50 text-emerald-900':'bg-red-50 text-red-800'}`}>{testResult.message}</div>}
  </div>
 </Collapsible>}

 {reviewer&&<Collapsible id="vehicle-billing-contracts" title="Vehicle Billing Contracts" subtitle="Fixed monthly amount + extra-KM rate per vehicle/partner" icon={<Building2 className="h-5 w-5"/>} open={!!openSec.contracts} onToggle={()=>toggleSec('contracts')}>
  <form onSubmit={saveContract} className="grid gap-3 md:grid-cols-4"><select name="vehicleId" required className={c}><option value="">Vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select><select name="partnerId" required className={c}><option value="">Partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><div><label className={lab}>Effective From</label><input name="effectiveFrom" type="date" required defaultValue={today()} className={c}/></div><div><label className={lab}>Fixed Monthly Amount (₹)</label><input name="fixedMonthlyAmount" type="number" step="0.01" required placeholder="e.g. 80000" className={c}/></div><div><label className={lab}>Basis Days</label><input name="fixedBasisDays" type="number" defaultValue={31} className={c}/></div><div><label className={lab}>Included KM / Month</label><input name="includedKmPerMonth" type="number" step="0.01" defaultValue={0} className={c}/></div><div><label className={lab}>Extra KM Rate (₹)</label><input name="extraKmRate" type="number" step="0.01" placeholder="e.g. 20.75" className={c}/></div><div><label className={lab}>GST %</label><input name="gstRate" type="number" step="0.01" defaultValue={18} className={c}/></div><input name="notes" placeholder="Notes (optional)" className={`${c} md:col-span-3`}/><button className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white md:col-span-4">Save Contract</button></form>
  <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Vehicle</th><th>Partner</th><th>Effective From</th><th>Fixed/Month</th><th>Basis Days</th><th>Included KM</th><th>Extra KM Rate</th><th>GST %</th><th>Status</th><th></th></tr></thead><tbody>{contracts.map((ct:any)=><tr key={ct.id} className="border-t"><td className="p-2 font-semibold">{ct.vehicleNumber}</td><td>{ct.partnerName}</td><td>{ct.effectiveFrom}</td><td>{fmtMoney(ct.fixedMonthlyAmount)}</td><td>{ct.fixedBasisDays}</td><td>{ct.includedKmPerMonth}</td><td>{fmtMoney(ct.extraKmRate)}</td><td>{ct.gstRate}%</td><td>{ct.active?'Active':'Disabled'}</td><td>{ct.active&&<button onClick={()=>disableContract(ct.id)} className="text-red-700" aria-label="Disable contract"><Trash2 className="inline h-4 w-4"/></button>}</td></tr>)}</tbody></table></div>
 </Collapsible>}

 {reviewer&&<Collapsible id="reports" title="Partner Statement & Finance Summary" subtitle="Monthly PDF/Excel statement and reviewed income" icon={<BarChart3 className="h-5 w-5"/>} open={!!openSec.reports} onToggle={()=>toggleSec('reports')}>
  <div className="grid gap-3 md:grid-cols-4"><select aria-label="Partner for statement" value={reportPartner} onChange={e=>setReportPartner(e.target.value)} className={c}><option value="">Select partner</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Statement month" type="month" value={month} onChange={e=>setMonth(e.target.value)} className={c}/><button disabled={!reportPartner} onClick={()=>apiDownload(`/api/billing/reports/partners/${reportPartner}/monthly/${month}/pdf`,`RefTech-${month}.pdf`).catch((e:any)=>setMsg(e.message))} className="rounded-xl bg-red-700 py-2.5 text-white disabled:opacity-40"><Download className="mr-2 inline h-4 w-4"/>PDF</button><button disabled={!reportPartner} onClick={()=>apiDownload(`/api/billing/reports/partners/${reportPartner}/monthly/${month}/excel`,`RefTech-${month}.xlsx`).catch((e:any)=>setMsg(e.message))} className="rounded-xl bg-emerald-700 py-2.5 text-white disabled:opacity-40"><Download className="mr-2 inline h-4 w-4"/>Excel</button></div>
  <div className="mt-6 border-t pt-5"><div className="text-2xl font-bold">Total reviewed income: {fmtMoney(finance.totalIncome||0)}</div><div className="mt-4 grid gap-4 md:grid-cols-3"><div><b>By Partner</b>{(finance.incomeByPartner||[]).map((x:any)=><div key={x.partnerId}>{x.partnerName}: {fmtMoney(x.income)}</div>)}</div><div><b>By Vehicle</b>{(finance.incomeByVehicle||[]).map((x:any)=><div key={x.vehicleId}>{x.vehicleNumber}: {fmtMoney(x.income)}</div>)}</div><div><b>Warehouse by Partner</b>{(finance.warehouseIncomeByPartner||[]).map((x:any)=><div key={`${x.partnerId}-${x.warehouseId}`}>{x.partnerName} / {x.warehouseName}: {fmtMoney(x.income)}</div>)}</div></div></div>
 </Collapsible>}
 </>;
}
