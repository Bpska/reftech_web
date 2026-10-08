/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-003 -- the daily stock statement of a principal at a depot (from the warehouse stock ledger): opening,
// received, dispatched, returned, damaged, adjusted and closing by product and batch. The principal's own figures are
// typed or uploaded (CSV: product code, batch, quantity); every difference is closed with a reason; staff then lock
// the day. Excel and PDF.
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { ask, csvRows, day, post, qty, useRunner, when, yesterday } from './cnf';
import { ExcelButton, Grid, Info, PdfButton, Pill } from './CnfKit';
import type { CnfCtx } from './CnfPage';

export function StockTab({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const [d, setD] = useState(yesterday());
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [st, setSt] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [csv, setCsv] = useState('');
  const [replace, setReplace] = useState(true);
  const qs = useCallback((extra = '') => {
    const p = new URLSearchParams();
    if (ctx.principalId) p.set('principalId', String(ctx.principalId));
    if (warehouseId) p.set('warehouseId', warehouseId);
    if (d) p.set('day', d);
    const s = p.toString();
    return `${s ? `?${s}` : ''}${extra}`;
  }, [ctx.principalId, warehouseId, d]);
  const load = useCallback(async () => {
    const s = await api(`/api/cnf/stock-statement${qs()}`);
    setSt(s);
    if (!warehouseId && s.warehouseId) setWarehouseId(String(s.warehouseId));
    const h = await api(`/api/cnf/stock-statement/history${ctx.principalId ? `?principalId=${ctx.principalId}` : ''}`);
    setHistory(h.statements || []);
  }, [qs]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);
  useEffect(() => { api(`/api/cnf/warehouses${ctx.principalId ? `?principalId=${ctx.principalId}` : ''}`).then(x => setWarehouses(x.warehouses || [])).catch(() => {}); }, []);
  const writer = !ctx.partner || ctx.canWrite;
  const body = () => ({ principalId: ctx.principalId, warehouseId: st?.warehouseId, day: st?.day });
  const upload = async () => { const x = await r.run(() => post('/api/cnf/stock-statement/upload', { ...body(), csv, replace })); if (x) { setSt(x); setCsv(''); } };
  const close = async (row: any) => {
    const reason = ask(`Why does ${row.productName}${row.batchNo ? ` batch ${row.batchNo}` : ''} differ by ${qty(row.difference)}? (at least 5 characters)`);
    if (reason === null) return;
    const x = await r.run(() => post('/api/cnf/stock-statement/close-difference', { ...body(), productId: row.productId, batchNo: row.batchNo || '', reason }));
    if (x) setSt(x);
  };
  const lock = async () => { const x = await r.run(() => post('/api/cnf/stock-statement/lock', body())); if (x) { setSt(x); await load(); } };
  const readFile = (f?: File) => { if (!f) return; const rd = new FileReader(); rd.onload = () => setCsv(String(rd.result || '')); rd.readAsText(f); };
  const t = st?.totals || {};
  return <>
    <Banner msg={r.msg} error={r.error} />
    <Section title="Stock statement" right={st && <div className="flex gap-2">
      <ExcelButton r={r} path={`/api/cnf/stock-statement/excel${qs()}`} file={`stock-statement-${st.day}.xlsx`} />
      <PdfButton r={r} path={`/api/cnf/stock-statement/pdf${qs()}`} />
    </div>}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div><label className={label}>Day</label><input type="date" className={input} value={d} max={new Date().toISOString().slice(0, 10)} onChange={e => setD(e.target.value)} /></div>
        <div className="w-72"><label className={label}>Depot</label><select className={input} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
        {st && <div className="pb-2 text-sm">Status <Pill s={st.status} />{st.lockedBy && <> by {st.lockedBy}, {when(st.lockedAt)}</>}</div>}
      </div>
      {st && <>
        <Info items={[['Principal', st.principalName], ['Depot', st.warehouseName], ['Opening', qty(t.opening)], ['Received', qty(t.received)], ['Dispatched', qty(t.dispatched)],
          ['Returned', qty(t.returned)], ['Damaged', qty(t.damaged)], ['Adjusted', qty(t.adjusted)], ['Closing', qty(t.closing)],
          ['Principal\'s figures', st.hasFigures ? `${st.figuresSource === 'UPLOAD' ? 'Uploaded' : 'Typed'} by ${st.figuresBy}` : 'Not given yet'], ['Open differences', st.openDifferences]]} />
        <div className="mt-3"><Grid rows={st.lines || []} empty="No stock or movement on this day." cols={[
          { key: 'productCode', title: 'Code' }, { key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch' }, { key: 'expiryDate', title: 'Expiry', render: x => day(x.expiryDate) },
          ...['opening', 'received', 'dispatched', 'returned', 'damaged', 'adjusted', 'closing'].map(k => ({ key: k, title: k[0].toUpperCase() + k.slice(1), right: true, render: (x: any) => qty(x[k]) }))]} /></div>
      </>}
    </Section>
    {st && <Section title="Against the principal's figures" right={!ctx.partner && st.status !== 'LOCKED' && <button className={btn} disabled={r.busy || !st.canLock} title={st.lockProblem || ''} onClick={lock}>Lock the day</button>}>
      {st.status !== 'LOCKED' && st.lockProblem && <div className="mb-2 text-sm text-amber-800">{st.lockProblem}.</div>}
      {writer && st.status !== 'LOCKED' && <div className="mb-3 rounded-xl border p-3">
        <div className={label}>The principal's closing stock (CSV: product code, batch, quantity; a heading line is fine)</div>
        <textarea className={`${input} font-mono text-xs`} rows={4} value={csv} onChange={e => setCsv(e.target.value)} placeholder={'product_code,batch_no,quantity\nPANEER-1,B2409,120'} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,.txt" onChange={e => readFile(e.target.files?.[0])} className="text-sm" />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />Replace earlier figures of the day</label>
          <button className={btn} disabled={r.busy || !csv.trim()} onClick={upload}>Save {csvRows(csv) || ''} figure(s)</button>
        </div>
      </div>}
      <Grid rows={st.differences || []} empty="No figures of the principal for this day yet." cols={[
        { key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch', render: x => x.batchNo || 'all' },
        { key: 'ourQty', title: 'Ours', right: true, render: x => qty(x.ourQty) }, { key: 'principalQty', title: 'Principal', right: true, render: x => (x.missingFromPrincipal ? 'not given' : qty(x.principalQty)) },
        { key: 'difference', title: 'Difference', right: true, render: x => <span className={Number(x.difference) ? 'font-bold text-red-700' : ''}>{qty(x.difference)}</span> },
        { key: 'reason', title: 'Reason', render: x => (x.reason ? `${x.reason} (${x.closedBy})` : '') },
        { key: 'a', title: '', render: x => writer && st.status !== 'LOCKED' && Number(x.difference) !== 0 && !x.closedAt && <button className={btnLight} onClick={() => close(x)}>Close with reason</button> }]} />
    </Section>}
    <Section title="Last statements">
      <Grid rows={history} empty="No statements yet." onRow={x => { setD(String(x.day).slice(0, 10)); setWarehouseId(String(x.warehouseId)); }} cols={[
        { key: 'day', title: 'Day', render: x => day(x.day) }, { key: 'warehouseName', title: 'Depot' }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
        { key: 'figures', title: 'Figures', right: true }, { key: 'openDifferences', title: 'Open differences', right: true }, { key: 'lockedBy', title: 'Locked by' }]} />
    </Section>
  </>;
}
