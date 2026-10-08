/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-002 / MOB-204 -- the page a hired truck's driver opens from the link RefTech sends him by SMS or WhatsApp.
// He reads what will be shared, agrees (or refuses), and while the page is open his phone's position is sent every
// minute. He can stop sharing and withdraw his consent at any time. No login.
// Backend: /api/public/driver-tracking/{token} (HiredTrackingController).
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { publicApi, when } from './telematics';
import { fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function DriverSharePage() {
  const { token } = useParams();
  const base = `/api/public/driver-tracking/${encodeURIComponent(token || '')}`;
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false), [last, setLast] = useState<string>(''), [busy, setBusy] = useState(false);
  const watch = useRef<number | null>(null), lastSent = useRef(0), lastPos = useRef<GeolocationPosition | null>(null), tick = useRef<number | null>(null);

  const load = () => publicApi(base).then(x => { setD(x); setErr(''); }).catch(e => setErr(e instanceof Error ? e.message : 'This link is not valid any more'));
  useEffect(() => { void load(); return () => stop(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(p: GeolocationPosition) {
    const every = (d?.sendEverySeconds || 60) * 1000;
    if (Date.now() - lastSent.current < every) return;
    lastSent.current = Date.now();
    try {
      const r = await publicApi(`${base}/positions`, { method: 'POST', body: JSON.stringify({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0),
        speedKmph: p.coords.speed != null ? Math.round(p.coords.speed * 3.6) : null, heading: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? Math.round(p.coords.heading) : null }) });
      if (r.saved) { setLast(fmtTime(new Date())); setNote(''); }
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Not sent');
      if (e instanceof Error && /not valid|Agree|not started|ended/i.test(e.message)) stop();
    }
  }

  function start() {
    if (!('geolocation' in navigator)) { setNote('This phone does not give its location to the browser.'); return; }
    setSharing(true); setNote('');
    watch.current = navigator.geolocation.watchPosition(p => { lastPos.current = p; void send(p); },
      e => setNote(e.code === 1 ? 'Location is blocked. Allow location for this page in the browser settings, then press Start again.' : 'The location could not be read. Move to open sky and keep the page open.'),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 });
    // A truck standing still sends no new position event; send the last one again every minute.
    tick.current = window.setInterval(() => { if (lastPos.current) void send(lastPos.current); }, 30000);
  }
  function stop() {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    if (tick.current != null) window.clearInterval(tick.current);
    watch.current = null; tick.current = null; setSharing(false);
  }
  async function consent(agree: boolean) {
    setBusy(true);
    try { setD(await publicApi(`${base}/consent`, { method: 'POST', body: JSON.stringify({ agree }) })); if (agree) start(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Not saved'); } finally { setBusy(false); }
  }
  async function withdraw() {
    if (!window.confirm('Stop sharing your location with RefTech for this trip?')) return;
    stop(); setBusy(true);
    try { const r = await publicApi(`${base}/withdraw`, { method: 'POST' }); setD({ ...d, consentStatus: 'WITHDRAWN' }); setNote(r.message || 'Sharing stopped.'); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Not saved'); } finally { setBusy(false); }
  }

  const big = 'w-full rounded-2xl px-4 py-4 text-lg font-bold disabled:opacity-50';
  return <div className="min-h-screen bg-slate-50">
    <header className="bg-sky-800 px-4 py-3 text-white"><div className="mx-auto max-w-lg text-lg font-black">RefTech · Share location</div></header>
    <main className="mx-auto max-w-lg p-4">
      {err && <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm"><p className="font-bold">{err}</p></div>}
      {!d && !err && <p className="mt-6 text-center text-slate-500">Loading...</p>}
      {d && !err && <>
        <h1 className="text-xl font-black">Trip {d.tripNumber}</h1>
        <p className="text-slate-600">{d.from} to {d.to} · {d.driverName}</p>
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-relaxed shadow-sm">{d.consentText}</div>

        {(d.consentStatus === 'PENDING' || d.consentStatus === 'REFUSED' || d.consentStatus === 'WITHDRAWN') && <div className="mt-4 space-y-2">
          {d.consentStatus !== 'PENDING' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{d.consentStatus === 'REFUSED' ? 'You did not agree.' : 'You withdrew your consent.'} Nothing is shared. You can agree now if you wish.</p>}
          <button disabled={busy} onClick={() => consent(true)} className={`${big} bg-emerald-600 text-white`}>I agree, share my location</button>
          {d.consentStatus === 'PENDING' && <button disabled={busy} onClick={() => consent(false)} className={`${big} border border-slate-300 bg-white text-slate-700`}>I do not agree</button>}
        </div>}

        {d.consentStatus === 'GIVEN' && <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">You agreed on {when(d.consentAt)}.</p>
          {!d.tripRunning && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The trip has not started yet. Sharing begins once it starts; keep this link.</p>}
          {sharing
            ? <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900"><p className="flex items-center gap-2 font-bold"><MapPin className="h-5 w-5" />Sharing your location</p>
              <p className="text-sm">Keep this page open while driving. Last sent: {last || 'waiting for the first position'}.</p></div>
            : <button onClick={start} disabled={!d.tripRunning} className={`${big} bg-sky-700 text-white`}>Start sharing</button>}
          {sharing && <button onClick={stop} className={`${big} border border-slate-300 bg-white text-slate-700`}>Pause sharing</button>}
          <button disabled={busy} onClick={withdraw} className="w-full text-center text-sm font-semibold text-red-700 underline">Withdraw my consent</button>
        </div>}
        {note && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm">{note}</p>}
      </>}
    </main>
  </div>;
}
