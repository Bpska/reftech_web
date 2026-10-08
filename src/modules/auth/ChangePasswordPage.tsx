/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-002 -- every login changes its own password (was Admin only, DEF-021). The rules of the password policy
// are shown; the server checks them and the last passwords. Opened by itself after sign-in when HR or an Admin set
// the password, or when it is too old.
import { FormEvent, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';

export function ChangePasswordPage() {
  const reason = new URLSearchParams(window.location.search).get('reason');
  const u = currentUser();
  const [rule, setRule] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/auth/password-policy?username=${encodeURIComponent(u.username || '')}`).then(r => r.json()).then(p => setRule(p.text || '')).catch(() => {});
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg('');
    const f = new FormData(e.currentTarget);
    if (f.get('newPassword') !== f.get('confirmPassword')) { setMsg('The new password and the confirmation do not match'); setBusy(false); return; }
    try {
      const r: any = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(f)) });
      alert(r.message || 'Password changed. Please sign in again.');
      localStorage.clear(); window.location.href = '/login';
    } catch (x: any) { setMsg(x.message); } finally { setBusy(false); }
  }
  const field = 'mt-1 w-full rounded-xl border px-3 py-2.5';
  return <div className="max-w-2xl">
    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><KeyRound />Change Password</h1>
    {reason === 'first' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900">Your password was set by HR or an Admin. Choose your own password to continue.</div>}
    {reason === 'expired' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900">Your password is too old. Choose a new one to continue.</div>}
    <p className="mt-2 text-slate-600">Signed in as <b>{u.username}</b>. {rule}</p>
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold">Current password<input name="currentPassword" type="password" required autoComplete="current-password" className={field} /></label>
      <label className="block text-sm font-semibold">New password<input name="newPassword" type="password" minLength={6} required autoComplete="new-password" className={field} /></label>
      <label className="block text-sm font-semibold">Confirm new password<input name="confirmPassword" type="password" minLength={6} required autoComplete="new-password" className={field} /></label>
      {msg && <div className="rounded-lg bg-red-50 p-3 text-red-800">{msg}</div>}
      <div className="flex gap-3">
        <button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white">{busy ? 'Changing...' : 'Change Password'}</button>
        <button type="button" onClick={() => { api('/api/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => { localStorage.clear(); window.location.href = '/login'; }); }}
          className="rounded-xl border px-5 py-2.5 font-semibold">Sign out</button>
      </div>
    </form>
  </div>;
}
