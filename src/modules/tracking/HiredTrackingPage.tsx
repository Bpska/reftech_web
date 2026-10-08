/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-002 -- Hired Trucks: track a hired (market or attached) truck that has no tracker, from the driver's phone
// (a link he opens and agrees on), from his SIM through the mobile operator, and from FASTag toll crossings (already
// automatic). Nothing is stored before the driver's consent is on record: given on the link, by SMS reply to the
// operator, or on paper / a recorded call that staff record here with a reference. Staff only.
// Backend: /api/tracking/hired, /api/tracking/trips/{id}/hired-tracking/... (HiredTrackingController).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { TELEMATICS_SCRIPT, copy, minutesText, origin, pill, sourceText, when } from './telematics';

const CONSENT: Record<string, ['green' | 'amber' | 'red' | 'grey', string]> = {
  PENDING: ['amber', 'Waiting for consent'], GIVEN: ['green', 'Consent given'], REFUSED: ['red', 'Refused'], WITHDRAWN: ['red', 'Withdrawn'],
};
const METHOD: Record<string, string> = { LINK: 'on the link', SMS_REPLY: 'by SMS reply', WRITTEN: 'in writing', VERBAL: 'on a recorded call' };
const SIM: Record<string, string> = { OFF: 'off', PENDING: 'waiting for SMS reply', ACTIVE: 'active', FAILED: 'failed', STOPPED: 'stopped' };

function LinkBox({ link, onClose }: { link: any; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  return <div className="my-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
    <p className="font-bold text-emerald-900">Send this link to the driver. He opens it, reads, agrees, and keeps it open while driving.</p>
    <p className="mt-2 break-all font-mono text-xs">{link.url}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <a className={btn} href={link.whatsappUrl} target="_blank" rel="noreferrer">Send on WhatsApp</a>
      <a className={btnLight} href={link.smsUrl}>Send as SMS</a>
      <button className={btnLight} onClick={async () => setCopied(await copy(link.smsText) ? 'Copied' : 'Copy did not work; select the text')}>Copy message</button>
      <button className={btnLight} onClick={onClose}>Done</button>
    </div>
    {copied && <p className="mt-1 text-xs">{copied}</p>}
    {link.sim?.message && <p className="mt-2 text-emerald-900">{link.sim.message}</p>}
  </div>;
}

export function HiredTrackingPage() {
  const [params] = useSearchParams();
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<any>(null), [link, setLink] = useState<any>(null), [open, setOpen] = useState<{ id: number; what: string } | null>(null);

  const load = useCallback(() => api('/api/tracking/hired').then(setD).catch(e => setErr(errorText(e, 'Could not load hired trucks'))), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = params.get('trip');
    if (t && d?.hiredTripsWithoutTracking) {
      const trip = d.hiredTripsWithoutTracking.find((x: any) => String(x.id) === t);
      if (trip) setStarting(trip);
    }
  }, [params, d]);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await fn(); setMsg(r?.message || r?.result || done); await load(); return r; }
    catch (e) { setErr(errorText(e, 'Not done')); return null; } finally { setBusy(false); }
  }
  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { driverName: f.get('driverName'), driverMobile: f.get('driverMobile'), useLink: f.get('useLink') === 'on', useSim: f.get('useSim') === 'on',
      simProvider: f.get('simProvider') || undefined, pollMinutes: f.get('pollMinutes') || undefined, origin: origin() };
    const r = await run(() => api(`/api/tracking/trips/${starting.id}/hired-tracking`, { method: 'POST', body: JSON.stringify(body) }), 'Tracking started');
    if (r) { setStarting(null); setLink(r); setMsg(''); }
  }
  async function act(e: FormEvent<HTMLFormElement>, row: any) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const path = `/api/tracking/trips/${row.tripId}/hired-tracking`;
    let r: any = null;
    if (open?.what === 'consent') r = await run(() => api(`${path}/consent`, { method: 'POST', body: JSON.stringify(f) }), 'Consent recorded');
    if (open?.what === 'position') {
      const parts = String(f.coordinates || '').split(/[,\s]+/).filter(Boolean);
      if (parts.length !== 2) { setErr('Enter the position as latitude, longitude'); return; }
      r = await run(() => api(`${path}/position`, { method: 'POST', body: JSON.stringify({ latitude: parts[0], longitude: parts[1], capturedAt: f.capturedAt ? new Date(f.capturedAt).toISOString() : undefined }) }), 'Position stored');
    }
    if (open?.what === 'stop') r = await run(() => api(`${path}/stop`, { method: 'POST', body: JSON.stringify(f) }), 'Tracking stopped');
    if (r) setOpen(null);
  }

  if (d && d.ready === false) return <NotReady script={TELEMATICS_SCRIPT} />;
  const rows: any[] = d?.rows || [];
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Smartphone className="h-8 w-8 text-sky-700" />Hired Trucks</h1>
    <p className="text-slate-600">Follow a hired truck without a tracker: the driver's phone link, his SIM through the mobile operator, and FASTag toll crossings. Nothing is stored before the driver's consent is on record.</p>
    <Banner msg={msg} error={err} />
    {link && <LinkBox link={link} onClose={() => setLink(null)} />}
    {d && !d.simConfigured && <p className="my-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The SIM location service is set to HTTP but has no address (TRACKING_SIM_BASE_URL). Use the phone link, or type positions after calling the driver.</p>}

    {starting && <Section title={`Start tracking ${starting.tripNumber} (${starting.vehicleNumber})`}>
      <form onSubmit={start} className="grid gap-3 md:grid-cols-3">
        <div><label className={label}>Driver name *</label><input name="driverName" required className={input} /></div>
        <div><label className={label}>Driver mobile *</label><input name="driverMobile" required inputMode="tel" placeholder="98xxxxxxxx" className={input} /></div>
        <div className="flex items-end gap-4 text-sm font-semibold"><label className="flex items-center gap-2"><input type="checkbox" name="useLink" defaultChecked />Phone link</label><label className="flex items-center gap-2"><input type="checkbox" name="useSim" />SIM</label></div>
        <div><label className={label}>SIM service</label><select name="simProvider" defaultValue={d?.simProvider || 'MANUAL'} className={input}>
          <option value="MANUAL">None (type positions after calling)</option><option value="HTTP">Operator service</option><option value="SAMPLE">Test service</option></select></div>
        <div><label className={label}>Find the SIM every (minutes)</label><input name="pollMinutes" type="number" min={5} max={240} defaultValue={15} className={input} /></div>
        <div className="flex items-end gap-2"><button disabled={busy} className={btn}>Start and make the link</button><button type="button" className={btnLight} onClick={() => setStarting(null)}>Cancel</button></div>
      </form>
    </Section>}

    <Section title="Being tracked">
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Driver</th><th className={th}>Consent</th><th className={th}>Phone link</th><th className={th}>SIM</th><th className={th}>Last position</th><th className={th}></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">{d ? 'No hired truck is being tracked.' : 'Loading...'}</td></tr>}
          {rows.map(r => { const [tone, text] = CONSENT[r.consentStatus] || ['grey', r.consentStatus]; return [
            <tr key={r.id} className={`border-t border-slate-200 ${r.active ? '' : 'opacity-60'}`}>
              <td className={td}><Link to={`/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">{r.tripNumber}</Link><div className="text-xs text-slate-500">{r.vehicleNumber} · {r.from} to {r.to}</div></td>
              <td className={td}>{r.driverName}<div className="text-xs text-slate-500">{r.driverMobile}</div></td>
              <td className={td}>{pill(tone, text)}{r.consentAt && <div className="text-xs text-slate-500">{METHOD[r.consentMethod] || r.consentMethod} {when(r.consentAt)}{r.consentDocumentRef ? `, ref ${r.consentDocumentRef}` : ''}{r.consentIp ? `, from ${r.consentIp}` : ''}</div>}</td>
              <td className={td}>{r.useLink ? <>{r.lastLinkAt ? `last ${when(r.lastLinkAt)}` : 'not used yet'}{r.linkExpiresAt && <div className="text-xs text-slate-500">link till {when(r.linkExpiresAt)}</div>}</> : 'off'}</td>
              <td className={td}>{r.useSim ? <>{SIM[r.simStatus] || r.simStatus}<div className="text-xs text-slate-500">{r.simProvider}{r.lastSimAt ? `, found ${when(r.lastSimAt)}` : ''}</div>{r.lastError && <div className="text-xs text-red-700">{r.lastError}</div>}</> : 'off'}</td>
              <td className={td}>{r.lastPositionAt ? <>{when(r.lastPositionAt)}<div className="text-xs text-slate-500">{sourceText(r.lastSource)}</div></> : '-'}</td>
              <td className={`${td} text-right`}>{r.active ? <div className="flex flex-wrap justify-end gap-1">
                <button className={btnLight} disabled={busy} onClick={async () => { const x = await run(() => api(`/api/tracking/trips/${r.tripId}/hired-tracking/new-link`, { method: 'POST', body: JSON.stringify({ origin: origin() }) }), 'New link made'); if (x) { setLink(x); setMsg(''); } }}>New link</button>
                {r.consentStatus !== 'GIVEN' && <button className={btnLight} onClick={() => setOpen({ id: r.id, what: 'consent' })}>Record consent</button>}
                {!r.useSim ? <button className={btnLight} disabled={busy} onClick={() => run(() => api(`/api/tracking/trips/${r.tripId}/hired-tracking/sim/start`, { method: 'POST' }), 'SIM requested')}>Track SIM</button>
                  : <><button className={btnLight} disabled={busy} onClick={() => run(() => api(`/api/tracking/trips/${r.tripId}/hired-tracking/sim/locate`, { method: 'POST' }), 'Asked')}>Find SIM now</button>
                    <button className={btnLight} disabled={busy} onClick={() => run(() => api(`/api/tracking/trips/${r.tripId}/hired-tracking/sim/stop`, { method: 'POST' }), 'SIM tracking stopped')}>Stop SIM</button></>}
                {r.consentStatus === 'GIVEN' && <button className={btnLight} onClick={() => setOpen({ id: r.id, what: 'position' })}>Type position</button>}
                <button className={btnRed} onClick={() => setOpen({ id: r.id, what: 'stop' })}>Stop</button>
              </div> : <span className="text-xs text-slate-500">Stopped {when(r.stoppedAt)}{r.stopReason ? `: ${r.stopReason}` : ''}</span>}</td>
            </tr>,
            open?.id === r.id && <tr key={`${r.id}-form`} className="bg-sky-50/50"><td colSpan={7} className="p-3">
              <form onSubmit={e => act(e, r)} className="flex flex-wrap items-end gap-3 text-sm">
                {open?.what === 'consent' && <>
                  <label>How<select name="method" className={`${input} block`}><option value="WRITTEN">Signed form</option><option value="VERBAL">Recorded phone call</option></select></label>
                  <label className="min-w-[18rem]">Reference (form number or call recording) *<input name="documentRef" required className={`${input} block`} /></label>
                </>}
                {open?.what === 'position' && <>
                  <label className="min-w-[16rem]">Position (latitude, longitude) *<input name="coordinates" required placeholder="20.2961, 85.8245" className={`${input} block`} /></label>
                  <label>Time (empty = now)<input name="capturedAt" type="datetime-local" className={`${input} block`} /></label>
                </>}
                {open?.what === 'stop' && <label className="min-w-[18rem]">Why<input name="reason" placeholder="Truck reached, driver changed..." className={`${input} block`} /></label>}
                <button disabled={busy} className={btn}>{open?.what === 'stop' ? 'Stop tracking' : 'Save'}</button>
                <button type="button" className={btnLight} onClick={() => setOpen(null)}>Cancel</button>
              </form>
            </td></tr>,
          ]; })}
        </tbody>
      </table></div>
    </Section>

    <Section title="Hired trips without tracking">
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Lane</th><th className={th}>Status</th><th className={th}>Last position</th><th className={th}></th></tr></thead>
        <tbody>
          {(d?.hiredTripsWithoutTracking || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Every open hired trip is tracked.</td></tr>}
          {(d?.hiredTripsWithoutTracking || []).map((t: any) => <tr key={t.id} className="border-t border-slate-200">
            <td className={td}><Link to={`/trips/${t.id}`} className="text-sky-700 hover:underline">{t.tripNumber}</Link></td>
            <td className={td}>{t.vehicleNumber} <span className="text-xs text-slate-500">{t.ownership}</span></td>
            <td className={td}>{t.from} to {t.to}</td>
            <td className={td}>{t.status}</td>
            <td className={td}>{t.lastPositionAt ? `${minutesText(Math.round((Date.now() - new Date(t.lastPositionAt).getTime()) / 60000))} ago` : 'none'}</td>
            <td className={`${td} text-right`}><button className={btnLight} onClick={() => setStarting(t)}>Start tracking</button></td>
          </tr>)}
        </tbody>
      </table></div>
    </Section>
  </>;
}
