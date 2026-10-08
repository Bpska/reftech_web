/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-009 -- Receiving and Putaway with pallet labels and scanning.
//   1. Receive: a batch arrives as one or more pallets; each gets a pallet code (P100001 ...) and a label
//      with its barcode. Batch / serial / expiry rules, catch-weight tolerance and the receipt temperature
//      are checked by the backend (a pallet received outside its range goes ON HOLD).
//   2. Put away: scan the pallet label, then the bin label. The bin must be active, have a free position,
//      take the weight, and its chamber must hold the product's temperature. Suggested bins are shown.
//   3. Move a stored pallet the same way, and put a pallet on hold, mark it damaged or release it (Manager).
//
// Backend: PutawayController (/api/warehouse/pallets/**, /api/warehouse/putaway/**).
import { useCallback, useEffect, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, ScanBox, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, errorText, expiryStyle, palletLabelsHtml, pill, printHtml, qty, td, th, when, who } from './wms';
import { fmtTemp } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function PutawayPage() {
  const me = who();
  const [ready, setReady] = useState<boolean | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [partners, setPartners] = useState<any[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [waiting, setWaiting] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [pallet, setPallet] = useState<any>(null);
  const [suggest, setSuggest] = useState<any>(null);
  const [mode, setMode] = useState<'putaway' | 'move'>('putaway');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadWaiting = useCallback(async () => {
    try {
      const r = await api(`/api/warehouse/putaway${warehouseId ? `?warehouseId=${warehouseId}` : ''}`);
      setReady(r.ready); setWaiting(r.pallets || []);
    } catch (x) { setError(errorText(x, 'Could not load the pallets waiting for putaway')); }
  }, [warehouseId]);
  useEffect(() => {
    if (!me.staff) return;
    api('/api/warehouse/layout').then(d => {
      const list = (d.warehouses || []).filter((w: any) => w.active);
      setWarehouses(list); if (list.length === 1) setWarehouseId(String(list[0].id));
    }).catch(() => setWarehouses([]));
    api('/api/operations/partners').then(p => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([]));
  }, []);
  useEffect(() => { if (me.staff) void loadWaiting(); }, [loadWaiting]);
  useEffect(() => {
    if (!partnerId) { setProducts([]); return; }
    api(`/api/warehouse/products?partnerId=${partnerId}`).then(r => setProducts(r.products || [])).catch(() => setProducts([]));
  }, [partnerId]);

  async function step<T>(action: () => Promise<T>, after?: (r: T) => void | Promise<void>) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await action(); if (after) await after(r); return r; }
    catch (x) { setError(errorText(x, 'Could not complete the step')); return null; }
    finally { setBusy(false); }
  }
  const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

  async function printLabels(list: any[]) {
    const fresh = await step(() => Promise.all(list.map(p => post(`/api/warehouse/pallets/${p.id}/label`))));
    if (fresh) printHtml(`Pallet labels ${fresh.map(p => p.palletCode).join(' ')}`, palletLabelsHtml(fresh));
  }
  async function selectPallet(code: string) {
    await step(async () => {
      const p = await api(`/api/warehouse/pallets/by-code/${encodeURIComponent(code)}`);
      setPallet(p); setSuggest(null);
      if (p.status === 'RECEIVED') { setMode('putaway'); setSuggest(await api(`/api/warehouse/pallets/${p.id}/suggestions`)); }
      else if (p.status === 'STORED') setMode('move');
      setMsg(p.status === 'RECEIVED' ? `Pallet ${p.palletCode}: now scan the bin.` : p.status === 'STORED' ? `Pallet ${p.palletCode} is in ${p.binCode}. Scan a new bin to move it.` : `Pallet ${p.palletCode} is ${p.status}.`);
    });
  }
  async function scanBin(binCode: string) {
    if (!pallet) { setError('Scan the pallet label first'); return; }
    const path = mode === 'putaway' ? '/api/warehouse/putaway/confirm' : '/api/warehouse/pallets/move';
    await step(() => post(path, { palletCode: pallet.palletCode, binCode, palletId: pallet.id }), async (r: any) => {
      setPallet(null); setSuggest(null); await loadWaiting(); setMsg(r?.message || 'Done.');
    });
  }
  async function setState(p: any, state: string) {
    const reason = window.prompt(state === 'GOOD' ? `Why is pallet ${p.palletCode} good again?` : `Reason for ${state === 'HOLD' ? 'holding' : 'marking damaged'} pallet ${p.palletCode}:`);
    if (reason === null) return;
    await step(() => post(`/api/warehouse/pallets/${p.id}/state`, { state, reason }), async (r: any) => {
      setPallet(pallet && pallet.id === p.id ? { ...pallet, ...r, stockState: state } : pallet); await loadWaiting(); setMsg(r?.message || `Pallet ${p.palletCode} is ${state}.`);
    });
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Receiving & Putaway</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const product = products.find(p => String(p.id) === productId);
  const units: [string, string][] = product ? [[product.baseUom, product.baseUom], ...(product.uoms || []).map((u: any) => [u.uom, `${u.uom} (${Number(u.factorToBase)} ${product.baseUom})`] as [string, string])] : [];
  const receiveFields: Field[] = [
    { name: 'batchNo', label: 'Batch', required: product?.trackingRule === 'BATCH' },
    ...(product?.trackingRule === 'SERIAL' ? [{ name: 'serialNo', label: 'Serial number', required: true } as Field] : []),
    { name: 'mfgDate', label: 'Manufacturing date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry date', type: 'date', hint: product?.shelfLifeDays ? `Left empty: manufacturing date + ${product.shelfLifeDays} days` : undefined },
    { name: 'quantity', label: 'Quantity per pallet', type: 'number', required: true },
    { name: 'uom', label: 'Unit', type: 'select', options: units, required: true },
    { name: 'palletCount', label: 'Number of pallets', type: 'number', step: '1', placeholder: '1' },
    { name: 'weightKg', label: product?.catchWeight ? 'Actual weight per pallet (kg)' : 'Weight per pallet (kg)', type: 'number', required: !!product?.catchWeight },
    { name: 'volumeM3', label: 'Volume per pallet (m³)', type: 'number', hint: 'Optional. Empty: quantity x the volume per unit of the product' },
    { name: 'receivedTemperatureC', label: 'Product temperature at receipt', type: 'number', unit: 'temp' },
    { name: 'reference', label: 'Delivery note / truck', wide: true },
  ];
  const receive = (v: Record<string, unknown>, form: HTMLFormElement) => step(
    () => post('/api/warehouse/pallets/receive', { ...v, warehouseId, partnerId, productId }),
    async (r: any) => { setReceived(r.pallets || []); form.reset(); await loadWaiting(); setMsg(r.message); });

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ScanLine className="h-8 w-8 text-sky-700" />Receiving & Putaway</h1>
    <p className="text-slate-600">Receive pallets, print their labels, then put each away by scanning the pallet label and the bin label.</p>
    <Banner msg={msg} error={error} />
    {ready === false && <NotReady script="database_v2/30_req_wms_006_011_warehouse.sql" />}
    {ready && <>
      <div className="mt-3 max-w-md"><label className="mb-1 block text-sm font-semibold text-slate-700">Warehouse</label>
        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
          <option value="">All warehouses</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>

      <Section id="putaway" title="Scan to put away or move">
        <div className="grid gap-4 md:grid-cols-2">
          <div><div className="mb-1 text-sm font-semibold">1. Scan the pallet label</div><ScanBox autoFocus disabled={busy} placeholder="Pallet code, e.g. P100001" onScan={selectPallet} /></div>
          <div><div className="mb-1 text-sm font-semibold">2. Scan the bin label {pallet && <span className="text-sky-700">({mode === 'putaway' ? 'put away' : 'move'} {pallet.palletCode})</span>}</div>
            <ScanBox disabled={busy || !pallet} placeholder="Bin code, e.g. FRZ-A-R01-L1-P01" onScan={scanBin} /></div>
        </div>
        {pallet && <div className="mt-4 rounded-xl border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="text-lg font-bold">{pallet.palletCode} · {pallet.productName}</div>
              <div className="text-sm text-slate-600">{pallet.partnerName} · batch {pallet.batchNo || '-'} · expiry <span className={expiryStyle(pallet.daysToExpiry)}>{day(pallet.expiryDate)}</span> · {qty(pallet.quantity, pallet.uom)} · {pallet.temperatureProfileName || ''}</div>
              <div className="mt-1 flex gap-2"><span className={pill(pallet.status)}>{pallet.status}</span><span className={pill(pallet.stockState)}>{pallet.stockState}</span>{pallet.binCode && <span className="text-sm">in <b>{pallet.binCode}</b></span>}</div>
              {pallet.stateReason && <div className="text-sm text-amber-800">{pallet.stateReason}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => printLabels([pallet])} className={btnLight}>Print label</button>
              {pallet.stockState !== 'HOLD' && <button onClick={() => setState(pallet, 'HOLD')} className={btnLight}>Hold</button>}
              {pallet.stockState !== 'DAMAGED' && <button onClick={() => setState(pallet, 'DAMAGED')} className={btnRed}>Damaged</button>}
              {me.manager && pallet.stockState !== 'GOOD' && <button onClick={() => setState(pallet, 'GOOD')} className={btnLight}>Release (good)</button>}
              <button onClick={() => { setPallet(null); setSuggest(null); }} className={btnLight}>Clear</button>
            </div>
          </div>
          {suggest && <div className="mt-3">
            <div className="text-sm font-semibold">Suggested bins for {suggest.need}</div>
            <div className="mt-1 flex flex-wrap gap-2">{suggest.bins.slice(0, 8).map((b: any) => <button key={b.binId} title={b.reason} disabled={busy} onClick={() => scanBin(b.binCode)}
              className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-left text-sm"><div className="font-mono font-bold">{b.binCode}</div><div className="text-xs text-slate-600">{b.chamberName} · L{b.levelNo ?? '-'} · {b.freePositions} free</div></button>)}
              {suggest.bins.length === 0 && <span className="text-sm text-red-700">No free bin can hold this pallet.</span>}</div>
            {suggest.refusedChambers?.length > 0 && <div className="mt-2 text-xs text-slate-500">{suggest.refusedChambers.map((c: any) => <div key={c.chamberId}>Not offered: {c.reason}</div>)}</div>}
          </div>}
        </div>}
      </Section>

      <Section id="receive" title="Receive pallets">
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className="mb-1 block text-sm font-semibold text-slate-700">Partner *</label>
            <select value={partnerId} onChange={e => { setPartnerId(e.target.value); setProductId(''); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="">Choose</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="mb-1 block text-sm font-semibold text-slate-700">Product *</label>
            <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="">Choose</option>{products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.productCode} · {p.name}</option>)}</select></div>
          <div className="text-sm text-slate-600 md:pt-6">{product && <>Tracking {product.trackingRule}{product.catchWeight ? `, catch weight ±${Number(product.catchWeightTolerancePct ?? 0)} %` : ''}, {product.temperatureProfileName || 'no profile'}</>}</div>
        </div>
        {!warehouseId && <div className="mt-2 text-sm text-amber-700">Choose the warehouse above first.</div>}
        {warehouseId && product && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm key={product.id} fields={receiveFields} initial={{ uom: product.baseUom, palletCount: 1 }} busy={busy} submitText="Receive" onSubmit={receive} /></div>}
        {received.length > 0 && <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><b>Just received: {received.map(p => p.palletCode).join(', ')}</b>
            <button onClick={() => printLabels(received)} className={btn}>Print {received.length} label(s)</button></div>
        </div>}
      </Section>

      <Section id="waiting" title={`Waiting for putaway (${waiting.length})`} right={<button onClick={() => void loadWaiting()} className={btnLight}>Refresh</button>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Pallet</th><th className={th}>Product</th><th className={th}>Batch / expiry</th><th className={th}>Quantity</th>
            <th className={th}>State</th><th className={th}>Received</th><th className={th}>Suggested bin</th><th className={th}></th></tr></thead>
          <tbody>{waiting.map(p => <tr key={p.id} className="border-t">
            <td className={`${td} font-mono font-bold`}>{p.palletCode}</td>
            <td className={td}>{p.productName}<div className="text-slate-500">{p.partnerName}</div></td>
            <td className={td}>{p.batchNo || '-'}<div className={expiryStyle(p.daysToExpiry)}>{day(p.expiryDate)}</div></td>
            <td className={td}>{qty(p.quantity, p.uom)}{p.weightKg ? <div className="text-slate-500">{Number(p.weightKg)} kg</div> : null}</td>
            <td className={td}><span className={pill(p.stockState)}>{p.stockState}</span>{p.stateReason && <div className="text-xs text-slate-500">{p.stateReason}</div>}</td>
            <td className={td}>{when(p.receivedAt)}{p.receivedTemperatureC != null && <div className="text-slate-500">{fmtTemp(p.receivedTemperatureC)}</div>}</td>
            <td className={`${td} font-mono`}>{p.suggestedBinCode || '-'}</td>
            <td className={`${td} text-right`}><div className="flex justify-end gap-2">
              <button onClick={() => selectPallet(p.palletCode)} className={btnLight}>Put away</button>
              <button onClick={() => printLabels([p])} className={btnLight}>Label ({p.labelPrintCount || 0})</button></div></td>
          </tr>)}
            {waiting.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>Nothing is waiting.</td></tr>}</tbody>
        </table></div>
      </Section>
    </>}
  </>;
}
