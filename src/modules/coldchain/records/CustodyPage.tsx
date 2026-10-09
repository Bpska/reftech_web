/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-008 -- Chain of Custody: one record per batch, from receipt to delivery. It joins what the system
// already knows (receipt, the chambers the pallets stayed in with their temperature, picking, loading checks,
// the trips with their temperature, proof of delivery) with the hand-overs staff or the partner record (who handed
// the goods to whom, where, at what temperature). Every reading of a sensor whose calibration was overdue is counted.
// Download as PDF. A Partner login sees only its own batches; a partner viewer cannot add hand-overs.
// A hand-over typed by hand can carry the receiver's signature (drawn here) and a photo (goods or signed paper).
// Backend: /api/coldchain/custody (CustodyController). Needs database_v2/66_cold_chain_records.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { api, apiDownload, apiOpen } from '@/shared/services/api';
import { SignaturePad } from '@/shared/components/SignaturePad';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { CUSTODY_STAGES, SCRIPT66, at, custodyQuery, day, fileName, notReady, nowIndia, send, temp, who, words } from './records';
import { Pill, Tiles } from './ui';
import { toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Key = { partnerId?: number; productId?: number; batchNo?: string; palletCode?: string };
const PICTURE_LIMIT = 3 * 1024 * 1024;
/** A picture as a data URL, to send inside the JSON body of the hand-over. */
const dataUrl = (f: File) => new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => fail(new Error('The picture could not be read.')); r.readAsDataURL(f); });

export function CustodyPage() {
  const me = who();
  const [q, setQ] = useState(''), [batches, setBatches] = useState<any>(null), [key, setKey] = useState<Key | null>(null), [rec, setRec] = useState<any>(null);
  const [pallet, setPallet] = useState(''), [adding, setAdding] = useState(false);
  const [signature, setSignature] = useState<File | null>(null), [photo, setPhoto] = useState<File | null>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => api(`/api/coldchain/custody/batches${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`).then(setBatches).catch(e => setErr(errorText(e, 'The batches could not be read.'))), 300);
    return () => clearTimeout(t);
  }, [q]);
  const load = (k: Key) => api(`/api/coldchain/custody${custodyQuery(k)}`).then(x => { setRec(x); setErr(''); }).catch(e => { setRec(null); setErr(errorText(e, 'The custody record could not be read.')); });
  useEffect(() => { if (key) void load(key); }, [key]);

  if (notReady(batches)) return <><h1 className="text-3xl font-bold">Chain of Custody</h1><NotReady script={batches.script || SCRIPT66} /></>;

  async function addHandover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rec) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>; delete f.photoFile;
    const b: Record<string, unknown> = { ...toBaseFields(f, { temperatureC: 'temp' }), partnerId: rec.partnerId, productId: rec.productId, batchNo: rec.batchNo };
    if (photo && photo.size > PICTURE_LIMIT) { setErr('The photo is larger than 3 MB. Take it at a lower resolution.'); return; }
    setBusy(true); setMsg(''); setErr('');
    try {
      if (signature) b.signature = await dataUrl(signature);
      if (photo) b.photo = await dataUrl(photo);
      const x = await send('/api/coldchain/custody/handovers', b); setMsg(x?.message || 'The hand-over was saved.'); setAdding(false); setSignature(null); setPhoto(null); await load(key as Key);
    }
    catch (e2) { setErr(errorText(e2, 'The hand-over was not saved.')); } finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!window.confirm('Remove this hand-over from the record?')) return;
    try { const x = await send(`/api/coldchain/custody/handovers/${id}/remove`); setMsg(x?.message || 'Removed.'); await load(key as Key); } catch (e) { setErr(errorText(e, 'Not removed.')); }
  }
  async function pdf() {
    if (!rec) return;
    try { await apiDownload(`/api/coldchain/custody/record.pdf${custodyQuery({ partnerId: rec.partnerId, productId: rec.productId, batchNo: rec.batchNo })}`, `Custody_${fileName(rec.productCode)}_${fileName(rec.batchNo)}.pdf`); }
    catch (e) { setErr(errorText(e, 'The PDF could not be made.')); }
  }

  const canAdd = !!rec?.canAddHandover && !me.partnerViewer;
  const tot = rec?.totals || {};
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Link2 />Chain of Custody</h1>
        <p className="text-slate-600">One record per batch: who held the goods, where, for how long and at what temperature, from receipt to delivery.</p>
      </div>
    </div>
    <Banner msg={msg} error={err} />

    {!key && <>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1"><span className={label}>Find a batch (batch, product or partner)</span><input className={input} value={q} onChange={e => setQ(e.target.value)} placeholder="IC2601" /></label>
        <form onSubmit={e => { e.preventDefault(); if (pallet.trim()) setKey({ palletCode: pallet.trim() }); }} className="flex items-end gap-2">
          <label><span className={label}>or scan a pallet label</span><input className={input} value={pallet} onChange={e => setPallet(e.target.value)} placeholder="TP0001" /></label>
          <button className={btnLight}>Open</button>
        </form>
      </div>
      <Section title="Batches">
        {!batches ? <p className="text-slate-500">Loading...</p> : !batches.batches?.length ? <p className="text-slate-500">No batch found.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead><tr className="bg-slate-50 text-left"><th className="p-2">Batch</th><th>Product</th><th>Partner</th><th>Pallets</th><th>Quantity</th><th>First received</th><th>Expiry</th><th /></tr></thead>
            <tbody>{batches.batches.map((b: any) => <tr key={`${b.partnerId}-${b.productId}-${b.batchNo}`} className="border-t">
              <td className="p-2 font-semibold">{b.batchNo}</td><td>{b.productCode} {b.productName}</td><td>{b.partnerName}</td><td>{b.pallets}</td><td>{Number(b.quantity)}</td>
              <td>{at(b.firstReceivedAt)}</td><td>{day(b.expiryDate)}</td>
              <td className="p-2"><button className={btnLight} onClick={() => setKey({ partnerId: b.partnerId, productId: b.productId, batchNo: b.batchNo })}>Open</button></td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {key && <button onClick={() => { setKey(null); setRec(null); setAdding(false); }} className="mt-2 text-sm font-bold text-sky-700 hover:underline">← All batches</button>}
    {key && !rec && !err && <p className="mt-4 text-slate-500">Loading...</p>}
    {key && rec && <>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Batch {rec.batchNo} · {rec.productCode} {rec.productName}</h2>
          <p className="text-slate-600">{rec.partnerName}{rec.profileName ? ` · ${rec.profileName}` : ''}{rec.profileMinC != null || rec.profileMaxC != null ? ` · ${temp(rec.profileMinC)} to ${temp(rec.profileMaxC)}` : ''}</p>
        </div>
        <div className="flex gap-2">
          {canAdd && <button className={btnLight} onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add a hand-over'}</button>}
          <button className={btn} onClick={pdf}>Download record (PDF)</button>
        </div>
      </div>
      <Tiles items={[['Pallets', tot.pallets ?? 0], ['In the building', Number(tot.inBuilding ?? 0)], ['Dispatched', Number(tot.dispatched ?? 0)], ['Not good', Number(tot.notGood ?? 0), tot.notGood ? 'FAIL' : undefined], ['Disposed', Number(tot.disposed ?? 0)],
        ['Readings by overdue sensors', rec.flaggedReadings ?? 0, rec.flaggedReadings ? 'CAL_OVERDUE' : undefined]]} />

      {adding && <Section title="Add a hand-over">
        <form onSubmit={addHandover} className="grid gap-3 md:grid-cols-4">
          <div><span className={label}>Stage *</span><select name="stage" required className={input}>{CUSTODY_STAGES.map(s => <option key={s} value={s}>{words(s)}</option>)}</select></div>
          <div><span className={label}>Handed at *</span><input name="handedAt" required defaultValue={nowIndia()} className={input} placeholder="YYYY-MM-DD HH:MM" /></div>
          <div><span className={label}>From *</span><input name="fromParty" required className={input} placeholder="Supplier plant dispatch" /></div>
          <div><span className={label}>To *</span><input name="toParty" required className={input} placeholder="Transporter driver" /></div>
          <div><span className={label}>Place *</span><input name="place" required className={input} /></div>
          <div><span className={label}>Product temperature ({unitNow('temp')})</span><input name="temperatureC" type="number" step="any" className={input} /></div>
          <div><span className={label}>Quantity</span><input name="quantity" type="number" step="any" className={input} /></div>
          <div><span className={label}>Truck number</span><input name="vehicleNumber" className={input} /></div>
          <div><span className={label}>Pallet (blank: whole batch)</span><select name="palletCode" className={input}><option value="">Whole batch</option>{(rec.pallets || []).map((p: any) => <option key={p.id} value={p.palletCode}>{p.palletCode}</option>)}</select></div>
          <div className="md:col-span-3"><span className={label}>Note (seal number, condition)</span><input name="note" className={input} /></div>
          <div className="md:col-span-2"><span className={label}>Signature of the person who received the goods</span><SignaturePad onChange={setSignature} disabled={busy} /></div>
          <div className="md:col-span-2"><span className={label}>Photo (goods, seal or the signed paper; JPG or PNG, at most 3 MB)</span>
            <input name="photoFile" type="file" accept="image/jpeg,image/png" capture="environment" className={input} onChange={e => setPhoto(e.target.files?.[0] || null)} /></div>
          <div><button className={btn} disabled={busy}>Save hand-over</button></div>
        </form>
      </Section>}

      <Section title="Timeline">
        {!rec.timeline?.length ? <p className="text-slate-500">Nothing recorded yet.</p> :
          <ol className="relative ml-2 border-l-2 border-sky-200">{rec.timeline.map((e: any, i: number) => <li key={i} className="mb-3 ml-4">
            <span className="absolute left-[-7px] mt-1.5 h-3 w-3 rounded-full bg-sky-600" />
            <div className="text-xs text-slate-500">{at(e.at)} · {words(e.stage)}</div>
            <div className="font-semibold">{e.what}{e.temperatureC != null ? <span className="ml-2 font-normal">{temp(e.temperatureC)}</span> : null}{e.flag ? <span className="ml-2"><Pill state={e.flag} text="Sensor calibration overdue" /></span> : null}</div>
            <div className="text-sm text-slate-700">{[e.who, e.where].filter(Boolean).join(' · ')}</div>
            {e.detail && <div className="text-xs text-slate-500">{e.detail}</div>}
          </li>)}</ol>}
      </Section>

      <Section title="Chambers">
        {!rec.chamberStays?.length ? <p className="text-slate-500">No stay in a chamber.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Chamber</th><th>From</th><th>To</th><th>Hours</th><th>Range</th><th>Lowest / highest / average</th><th>Readings</th><th>Out of range</th><th>Alerts</th></tr></thead>
          <tbody>{rec.chamberStays.map((s: any, i: number) => <tr key={i} className="border-t">
            <td className="p-2">{s.chamberName}</td><td>{at(s.from)}</td><td>{s.to ? at(s.to) : 'still there'}</td><td>{s.hours}</td><td>{temp(s.minC)} to {temp(s.maxC)}</td>
            <td>{temp(s.lowestC)} / {temp(s.highestC)} / {temp(s.averageC)}</td><td>{s.readings}{s.flaggedReadings ? <span className="ml-1 text-xs text-amber-700">({s.flaggedReadings} ▲)</span> : null}</td>
            <td>{s.outOfRange ? <Pill state="OUT_OF_RANGE" text={String(s.outOfRange)} /> : 0}{s.powerOffReadings ? <div className="text-xs text-red-700">{s.powerOffReadings} power off</div> : null}</td><td>{s.alerts}</td></tr>)}</tbody></table></div>}
      </Section>

      {(rec.loading?.length > 0 || rec.trips?.length > 0) && <Section title="Loading and transport">
        {rec.loading?.map((l: any, i: number) => <p key={`l${i}`} className="text-sm">Order {l.orderNo} to {l.consignee}{l.city ? `, ${l.city}` : ''}: truck {l.vehicleNumber || '-'}, {l.truckPrecooled ? 'pre-cooled' : 'not pre-cooled'}, {l.truckClean ? 'clean' : 'not marked clean'}, truck {temp(l.truckTemperatureC)}, seal {l.sealNumber || '-'}, checked {at(l.loadingCheckedAt)} by {l.loadingCheckedBy || '-'}; gate pass {l.gatePassNo || '-'}.</p>)}
        {rec.trips?.length > 0 && <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Trip</th><th>Truck / compartment</th><th>Range</th><th>Lowest / highest / average</th><th>Readings</th><th>Out of range</th><th>Alerts</th><th>Delivered</th></tr></thead>
          <tbody>{rec.trips.map((t: any) => <tr key={t.tripId} className="border-t align-top">
            <td className="p-2">{me.partner ? t.tripNumber : <Link to={`/trips/${t.tripId}`} className="font-semibold text-sky-700 hover:underline">{t.tripNumber}</Link>}<div className="text-xs text-slate-500">{t.status}</div></td>
            <td>{t.vehicleNumber}{t.compartment ? ` / ${t.compartment}` : ''}</td><td>{temp(t.minC)} to {temp(t.maxC)}</td><td>{temp(t.lowestC)} / {temp(t.highestC)} / {temp(t.averageC)}</td>
            <td>{t.readings ?? 0}{t.flaggedReadings ? <span className="ml-1 text-xs text-amber-700">({t.flaggedReadings} ▲)</span> : null}</td><td>{t.outOfRange ?? 0}</td><td>{Array.isArray(t.alerts) ? t.alerts.length : t.alerts ?? 0}</td>
            <td className="text-xs">{(t.deliveries || []).map((d: any, k: number) => <div key={k}>{d.consigneeName || d.receiverName || ''} {at(d.deliveredAt || d.at)}</div>)}</td></tr>)}</tbody></table></div>}
      </Section>}

      <Section title="Hand-overs">
        {!rec.handovers?.length ? <p className="text-slate-500">No hand-over recorded.</p> : <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">When</th><th>Stage</th><th>From → to</th><th>Place</th><th>Temperature</th><th>Note</th><th /></tr></thead>
          <tbody>{rec.handovers.map((h: any) => <tr key={h.id} className="border-t align-top">
            <td className="p-2">{at(h.handedAt)}</td><td>{words(h.stage)}</td><td>{h.fromParty} → {h.toParty}{h.palletCode ? <div className="text-xs text-slate-500">pallet {h.palletCode}</div> : null}</td>
            <td>{h.place}{h.vehicleNumber ? <div className="text-xs text-slate-500">{h.vehicleNumber}</div> : null}</td><td>{temp(h.temperatureC)}</td><td className="max-w-xs">{h.note || '-'}<div className="text-xs text-slate-400">{h.recordedByName}</div>
              {(h.hasSignature || h.hasPhoto) && <div className="mt-1 flex gap-2 text-xs">
                {h.hasSignature && <button type="button" className="font-semibold text-sky-700 hover:underline" onClick={() => apiOpen(`/api/coldchain/custody/handovers/${h.id}/signature`).catch(e => setErr(errorText(e, 'The signature could not be opened.')))}>Signature</button>}
                {h.hasPhoto && <button type="button" className="font-semibold text-sky-700 hover:underline" onClick={() => apiOpen(`/api/coldchain/custody/handovers/${h.id}/photo`).catch(e => setErr(errorText(e, 'The photo could not be opened.')))}>Photo</button>}</div>}</td>
            <td>{canAdd && <button className={btnRed} onClick={() => remove(h.id)}>Remove</button>}</td></tr>)}</tbody></table>}
      </Section>

      <Section title="Pallets">
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Pallet</th><th>Quantity</th><th>Status</th><th>Where</th><th>Received</th><th>Left</th></tr></thead>
          <tbody>{(rec.pallets || []).map((p: any) => <tr key={p.id} className="border-t">
            <td className="p-2 font-semibold">{p.palletCode}</td><td>{Number(p.quantity)} {p.uom}</td><td>{words(p.status)}{p.stockState && p.stockState !== 'GOOD' ? ` (${words(p.stockState)})` : ''}</td>
            <td>{[p.chamberName, p.binCode].filter(Boolean).join(' · ') || '-'}</td><td>{at(p.receivedAt)}</td><td>{at(p.leftAt)}</td></tr>)}</tbody></table></div>
      </Section>
    </>}
  </>;
}
