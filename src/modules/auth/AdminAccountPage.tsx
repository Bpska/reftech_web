/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { FormEvent,useState } from 'react';
import { api,currentUser } from '@/shared/services/api';
export function AdminAccountPage(){
 const u=currentUser();const role=String(u.role||u.roleCode||'').replace('ROLE_','').toUpperCase();const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
 if(role!=='ADMIN')return <div className="rounded-xl border bg-white p-6">Admin access required.</div>;
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMsg('');const f=new FormData(e.currentTarget);try{const r:any=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:f.get('currentPassword'),newPassword:f.get('newPassword'),confirmPassword:f.get('confirmPassword')})});alert(r.message);localStorage.clear();window.location.href='/login';}catch(x:any){setMsg(x.message)}finally{setBusy(false)}}
 return <div className="max-w-2xl"><h1 className="text-2xl font-bold text-slate-900">Admin Account</h1><p className="mt-1 text-slate-600">Change the password for your current Admin login.</p><form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-white p-6 shadow-sm"><label className="block text-sm font-semibold">Current password<input name="currentPassword" type="password" required className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label><label className="block text-sm font-semibold">New password<input name="newPassword" type="password" minLength={8} required className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label><label className="block text-sm font-semibold">Confirm new password<input name="confirmPassword" type="password" minLength={8} required className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label>{msg&&<div className="rounded-lg bg-red-50 p-3 text-red-800">{msg}</div>}<button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white">{busy?'Changing...':'Change Password'}</button></form></div>;
}
