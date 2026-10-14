/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Mail, MapPin, Send, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/website/Reveal';
import { body, formInfo, problems, send, type RequestForm } from '@/website/publicsite/publicsite';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-deep-900 outline-none transition focus:border-frost-500 focus:ring-4 focus:ring-frost-100';

export function Contact() {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);

  useEffect(() => {
    formInfo('CONTACT').then(x => setToken(x.formToken)).catch(x => setErrors([x instanceof Error ? x.message : 'The contact form is unavailable right now.']));
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const request: RequestForm = { kind: 'CONTACT', formToken: token, consent: data.get('consent') === 'on' };
    data.forEach((value, key) => { if (key !== 'consent') request[key] = String(value); });
    const invalid = problems(request, new Date().toISOString().slice(0, 10));
    if (invalid.length) { setErrors(invalid); return; }
    setBusy(true); setErrors([]);
    try {
      const result = await send(body(request));
      setDone(result);
      form.reset();
    } catch (x) {
      const message = x instanceof Error ? x.message : 'Your message could not be sent. Please try again.';
      setErrors([message]);
      if (/expired|reload/i.test(message)) formInfo('CONTACT').then(i => setToken(i.formToken)).catch(() => {});
    } finally { setBusy(false); }
  }

  return <section id="contact" className="relative section-pad overflow-hidden bg-mesh">
    <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden="true" />
    <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
      <Reveal><div>
        <span className="heading-eyebrow text-frost-300"><span className="h-px w-8 bg-frost-400" />Contact RefTech</span>
        <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">Plan your next cold-chain movement.</h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70">Tell us what needs to move, where it is going, and the temperature it requires. Our operations team will review the request and respond through the contact details you provide.</p>
        <div className="mt-10 space-y-4">
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><MapPin className="mt-1 h-5 w-5 text-frost-300"/><div><b className="text-white">Service coverage</b><p className="text-sm text-white/60">Use Our Locations for verified branches, warehouses and available services.</p></div></div>
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><Mail className="mt-1 h-5 w-5 text-frost-300"/><div><b className="text-white">Email</b><p className="text-sm text-white/60">admin@reftech.in</p></div></div>
          <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mt-1 h-5 w-5 text-frost-300"/><div><b className="text-white">Your information</b><p className="text-sm text-white/60">Used only to respond to this request and handled according to company policy.</p></div></div>
        </div>
      </div></Reveal>
      <Reveal delay={100}><div className="glass-card rounded-3xl p-6 md:p-9">
        {done ? <div role="status" className="flex min-h-[430px] flex-col items-center justify-center text-center"><CheckCircle2 className="h-12 w-12 text-emerald-600"/><h3 className="mt-5 font-display text-2xl font-bold text-deep-900">Message received</h3><p className="mt-2 text-deep-600">{done.message}</p><p className="mt-3 rounded-lg bg-frost-50 px-3 py-2 font-mono text-sm text-frost-800">Reference: {done.reference}</p><button type="button" onClick={()=>setDone(null)} className="btn-outline mt-6">Send another message</button></div> : <form onSubmit={submit} noValidate>
          <h3 className="font-display text-2xl font-bold text-deep-900">Write to our team</h3><p className="mt-2 text-sm text-deep-500">Fields marked * are required.</p>
          {errors.length>0&&<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><b>Check the following:</b><ul className="mt-2 list-disc pl-5">{errors.map(x=><li key={x}>{x}</li>)}</ul></div>}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-deep-700">Full name *<input name="fullName" required autoComplete="name" maxLength={160} className={`${field} mt-2`}/></label>
            <label className="text-sm font-semibold text-deep-700">Mobile number *<input name="phone" type="tel" required autoComplete="tel" maxLength={20} className={`${field} mt-2`}/></label>
            <label className="text-sm font-semibold text-deep-700">Email<input name="email" type="email" autoComplete="email" maxLength={160} className={`${field} mt-2`}/></label>
            <label className="text-sm font-semibold text-deep-700">Company<input name="company" autoComplete="organization" maxLength={160} className={`${field} mt-2`}/></label>
            <label className="text-sm font-semibold text-deep-700 sm:col-span-2">How can we help? *<textarea name="message" required rows={5} maxLength={2000} className={`${field} mt-2 resize-y`}/></label>
          </div>
          <label className="mt-5 flex items-start gap-3 text-sm text-deep-600"><input name="consent" type="checkbox" className="mt-0.5 h-5 w-5 rounded border-slate-300"/><span>I agree that RefTech may contact me about this request. *</span></label>
          <button disabled={busy||!token} className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60">{busy?<><LoaderCircle className="h-4 w-4 animate-spin"/>Sending…</>:<>Send message<Send className="h-4 w-4"/></>}</button>
        </form>}
      </div></Reveal>
    </div>
  </section>;
}
