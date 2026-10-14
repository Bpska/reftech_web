/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-002 -- forgotten password. Step 1: the user name; a 6-digit code goes to the email address HR has for the
// person (the answer never says whether the user name exists). Step 2: the code and the new password.
// No email on file: an Admin resets the password in Access Control.
import { FormEvent, useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;
async function post(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text(); let b: any = {}; try { b = t ? JSON.parse(t) : {}; } catch { b = { message: t }; }
  if (!r.ok) throw new Error(b.message || `Request failed (${r.status})`);
  return b;
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1), [username, setUsername] = useState(''), [rule, setRule] = useState('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await post('/api/auth/forgot-password', { username });
      setMsg(r.message); setStep(2);
      fetch(`${API}/api/auth/password-policy?username=${encodeURIComponent(username)}`).then(x => x.json()).then(p => setRule(p.text || '')).catch(() => {});
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('');
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try { const r = await post('/api/auth/reset-password', { username, ...f }); setMsg(r.message); setStep(3); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const field = 'mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-white placeholder:text-white/40';
  return <main className="auth-app flex min-h-screen items-center justify-center bg-frost-950 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white/5 p-8 text-white shadow-xl">
      <a href="/login" className="flex items-center gap-1 text-sm text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to sign in</a>
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold"><KeyRound />Forgot password</h1>
      {step === 1 && <form onSubmit={ask} className="mt-5 space-y-4">
        <p className="text-sm text-white/70">Enter your user name. A 6-digit code is sent to the email address HR has for you.</p>
        <label className="block text-sm font-semibold">User name<input value={username} onChange={e => setUsername(e.target.value)} required className={field} autoComplete="username" /></label>
        <button disabled={busy} className="w-full rounded-xl bg-frost-500 py-3 font-semibold text-white hover:bg-frost-400 disabled:opacity-60">{busy ? 'Sending...' : 'Send code'}</button>
      </form>}
      {step === 2 && <form onSubmit={reset} className="mt-5 space-y-4">
        <p className="rounded-lg bg-white/10 p-3 text-sm text-white/80">{msg}</p>
        {rule && <p className="text-xs text-white/60">{rule}</p>}
        <label className="block text-sm font-semibold">Code<input name="code" required inputMode="numeric" maxLength={6} className={field} /></label>
        <label className="block text-sm font-semibold">New password<input name="newPassword" type="password" required className={field} autoComplete="new-password" /></label>
        <label className="block text-sm font-semibold">Confirm new password<input name="confirmPassword" type="password" required className={field} autoComplete="new-password" /></label>
        <button disabled={busy} className="w-full rounded-xl bg-frost-500 py-3 font-semibold text-white hover:bg-frost-400 disabled:opacity-60">{busy ? 'Saving...' : 'Set new password'}</button>
        <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-white/70 underline">Send a new code</button>
      </form>}
      {step === 3 && <div className="mt-5 space-y-4"><p className="rounded-lg bg-emerald-500/20 p-3 text-sm">{msg}</p>
        <a href="/login" className="block w-full rounded-xl bg-frost-500 py-3 text-center font-semibold text-white">Sign in</a></div>}
      {err && <p className="mt-4 rounded-lg bg-red-500/20 p-3 text-sm text-red-100">{err}</p>}
    </div>
  </main>;
}
