/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { useEffect,useState } from 'react';
import { api,currentUser } from '@/shared/services/api';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
const money=(n:any)=>fmtMoney(Number(n||0));
const iso=(d:Date)=>d.toISOString().slice(0,10);
export function FinanceReportPage(){
 const u=currentUser();const role=String(u.role||u.roleCode||'').replace('ROLE_','').toUpperCase();
 const now=new Date(),six=new Date(now.getFullYear(),now.getMonth()-5,1);
 const [from,setFrom]=useState(iso(six)),[to,setTo]=useState(iso(now)),[dimension,setDimension]=useState('VEHICLE'),[dimensionId,setDimensionId]=useState('');
 const [options,setOptions]=useState<any[]>([]),[report,setReport]=useState<any>(null),[balance,setBalance]=useState<any>(null),[msg,setMsg]=useState('');
 useEffect(()=>{if(role!=='ADMIN')return;const path=dimension==='VEHICLE'?'/api/admin/vehicles':dimension==='WAREHOUSE'?'/api/admin/warehouses':'/api/admin/partners';api(path).then((x:any)=>setOptions(Array.isArray(x)?x:(x.items||[]))).catch(()=>setOptions([]));setDimensionId('')},[dimension]);
 async function load(){setMsg('');try{const q=`from=${from}&to=${to}&dimension=${dimension}${dimensionId?`&dimensionId=${dimensionId}`:''}`;setReport(await api('/api/admin/finance/income?'+q));setBalance(await api(`/api/admin/finance/balance-sheet?from=${from}&to=${to}`));}catch(e:any){setMsg(e.message)}}
 function preset(v:string){const d=new Date();if(v==='6M')setFrom(iso(new Date(d.getFullYear(),d.getMonth()-5,1)));if(v==='YEAR')setFrom(`${d.getFullYear()}-01-01`);if(v==='MONTH')setFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`);setTo(iso(d));}
 if(role!=='ADMIN')return <div className="rounded-xl border bg-white p-6">Finance Report and Balance Sheet are available only to Admin.</div>;
 const optionName=(x:any)=>dimension==='VEHICLE'?(x.vehicleNumber||x.vehicle_number||x.name):dimension==='WAREHOUSE'?(x.name||x.warehouseName):(x.name||x.partnerName);
 return <div><h1 className="text-2xl font-bold">Finance Report & Balance Sheet</h1><p className="mt-1 text-slate-600">Income analysis by vehicle, partner or warehouse. Chart visualization can be added in the next enhancement.</p>
 <div className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-3 lg:grid-cols-6"><select value={dimension} onChange={e=>setDimension(e.target.value)} className="rounded-xl border px-3 py-2"><option>VEHICLE</option><option>PARTNER</option><option>WAREHOUSE</option></select><select value={dimensionId} onChange={e=>setDimensionId(e.target.value)} className="rounded-xl border px-3 py-2"><option value="">All {dimension.toLowerCase()}s</option>{options.map((x:any)=><option key={x.id} value={x.id}>{optionName(x)}</option>)}</select><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-xl border px-3 py-2"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-xl border px-3 py-2"/><select onChange={e=>preset(e.target.value)} defaultValue="6M" className="rounded-xl border px-3 py-2"><option value="MONTH">This month</option><option value="6M">Last 6 months</option><option value="YEAR">This year</option></select><button onClick={load} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">Run Report</button></div>{msg&&<div className="mt-3 rounded-xl bg-red-50 p-3 text-red-800">{msg}</div>}
 {report&&<><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Total Income</div><div className="mt-1 text-2xl font-bold">{money(report.totalIncome)}</div></div><div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Recorded Expenses</div><div className="mt-1 text-2xl font-bold">{money(balance?.expenses)}</div></div><div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Net Operating Balance</div><div className="mt-1 text-2xl font-bold">{money(balance?.netOperatingBalance)}</div></div></div><div className="mt-5 overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Month</th><th className="p-3 text-left">{dimension}</th><th className="p-3 text-right">Invoices</th><th className="p-3 text-right">Income</th></tr></thead><tbody>{(report.rows||[]).map((r:any,i:number)=><tr key={i} className="border-t"><td className="p-3">{String(r.month).slice(0,10)}</td><td className="p-3 font-medium">{r.name}</td><td className="p-3 text-right">{r.invoice_count??r.invoiceCount}</td><td className="p-3 text-right">{money(r.income)}</td></tr>)}</tbody></table></div><div className="mt-5 rounded-2xl border bg-white p-5"><h2 className="font-bold">Balance Sheet Summary</h2><p className="mt-2 text-sm text-slate-600">{balance?.note}</p></div></>}
 </div>;
}
