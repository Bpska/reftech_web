/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-006 -- the billing desk of the C&F agent: orders that are loaded or gone get a delivery challan and an
// invoice in the principal's name and series (or the principal's own invoice number when the principal invoices).
// The e-way bill is checked against the e-way bill register (number, truck, validity); the e-invoice IRN is typed
// from the IRP, or made as a SAMPLE when the server runs with the sample provider. PDFs with QR, Excel of invoices.
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { ask, day, inr, post, qty, useRunner, when } from './cnf';
import { ExcelButton, Grid, Info, PdfButton, Pill } from './CnfKit';
import type { CnfCtx } from './CnfPage';
import { pq } from './CnfPage';

export function DocumentsTab({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const staff = !ctx.partner;
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [pending, setPending] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [provider, setProvider] = useState('MANUAL');
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [inv, setInv] = useState<any>(null);
  const invQs = `?status=${status}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}${pq(ctx, false)}`;

  const load = useCallback(async () => {
    if (staff) {
      const d = await api(`/api/cnf/dispatches?pending=${pending}${pq(ctx, false)}`);
      setDispatches(d.dispatches || []);
    }
    const i = await api(`/api/cnf/invoices${invQs}`);
    setInvoices(i.invoices || []);
    if (i.provider) setProvider(i.provider);
    const c = await api(`/api/cnf/challans${pq(ctx)}`);
    setChallans(c.challans || []);
    const n = await api(`/api/cnf/credit-notes${pq(ctx)}`);
    setNotes(n.creditNotes || []);
  }, [pending, invQs, ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);

  const openInv = async (id: number) => { const d = await r.run(() => api(`/api/cnf/invoices/${id}`)); if (d) setInv(d); };
  const act = async (path: string, body?: unknown, reopen?: number) => {
    const d = await r.run(() => post(path, body));
    if (d) { await load(); if (reopen) await openInv(reopen); }
    return d;
  };

  const makeChallan = (x: any) => {
    let principalInvoiceNo: string | null = null;
    if (x.invoiceIssuer === 'PRINCIPAL') {
      principalInvoiceNo = ask(`The principal's own invoice number for order ${x.orderNo} (may be empty and added later):`);
      if (principalInvoiceNo === null) return;
    }
    act(`/api/cnf/orders/${x.salesOrderId}/challan`, { principalInvoiceNo: principalInvoiceNo || null });
  };
  const makeInvoice = (x: any) => {
    const ewayBillNo = ask(`E-way bill number for order ${x.orderNo} (12 digits; may be empty for now when the value is up to ₹ 50,000):`);
    if (ewayBillNo === null) return;
    act(`/api/cnf/orders/${x.salesOrderId}/invoice`, { ewayBillNo: ewayBillNo || null, vehicleNumber: x.vehicleNumber || null });
  };
  const principalInvoice = (challanId: number) => {
    const no = ask('The principal\'s invoice number for this challan:');
    if (no) act(`/api/cnf/challans/${challanId}/principal-invoice`, { principalInvoiceNo: no });
  };
  const irn = (kind: 'invoices' | 'credit-notes', id: number, reopen?: number) => {
    if (provider === 'SAMPLE' && window.confirm('Make a SAMPLE IRN (for testing; it is not registered with the IRP)? Press Cancel to type a real IRN.')) {
      act(`/api/cnf/${kind}/${id}/irn`, { sample: true }, reopen);
      return;
    }
    const v = ask('IRN from the e-invoice portal (64 letters and digits):');
    if (!v) return;
    const ackNo = ask('Acknowledgement number:');
    if (!ackNo) return;
    const ackDate = ask('Acknowledgement date (YYYY-MM-DD; empty for today):');
    if (ackDate === null) return;
    act(`/api/cnf/${kind}/${id}/irn`, { irn: v, ackNo, ackDate: ackDate || null }, reopen);
  };
  const eway = (id: number) => { const v = ask('E-way bill number (12 digits):'); if (v) act(`/api/cnf/invoices/${id}/eway`, { ewayBillNo: v }, id); };
  const cancelInv = (id: number) => { const v = ask('Reason for cancelling the invoice (at least 5 characters):'); if (v !== null) act(`/api/cnf/invoices/${id}/cancel`, { reason: v }, id); };
  const cancelChallan = (id: number) => { const v = ask('Reason for cancelling the challan (at least 5 characters):'); if (v !== null) act(`/api/cnf/challans/${id}/cancel`, { reason: v }); };

  return <>
    <Banner msg={r.msg} error={r.error} />
    {staff && <Section title="Dispatches to bill" right={<label className="flex items-center gap-1 text-sm">
      <input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} />Only those still needing a challan or invoice</label>}>
      <Grid rows={dispatches} empty={pending ? 'Nothing to bill. Orders appear here once the warehouse has loaded them.' : 'No dispatches yet.'} cols={[
        { key: 'orderNo', title: 'Order' }, { key: 'distributorName', title: 'Distributor' }, { key: 'warehouseOrderNo', title: 'Warehouse order' },
        { key: 'warehouseStatus', title: 'At the depot', render: x => <Pill s={x.warehouseStatus} /> }, { key: 'vehicleNumber', title: 'Truck' },
        { key: 'leftAt', title: 'Left', render: x => when(x.leftAt) }, { key: 'orderValue', title: 'Value', right: true, render: x => inr(x.orderValue) },
        { key: 'invoiceIssuer', title: 'Invoiced by', render: x => (x.invoiceIssuer === 'PRINCIPAL' ? 'Principal' : 'C&F (in principal\'s name)') },
        { key: 'challanNo', title: 'Challan', render: x => x.challanNo || '' },
        { key: 'invoiceNo', title: 'Invoice', render: x => x.invoiceNo || x.principalInvoiceNo || '' },
        { key: 'a', title: '', render: x => <div className="flex flex-wrap gap-1">
          {!x.challanId && <button className={btnLight} disabled={r.busy} onClick={() => makeChallan(x)}>Make challan</button>}
          {x.challanId && x.invoiceIssuer === 'PRINCIPAL' && !x.principalInvoiceNo && <button className={btnLight} disabled={r.busy} onClick={() => principalInvoice(x.challanId)}>Principal's invoice no.</button>}
          {!x.invoiceId && x.invoiceIssuer !== 'PRINCIPAL' && <button className={btn} disabled={r.busy} onClick={() => makeInvoice(x)}>Make invoice</button>}
        </div> }]} />
    </Section>}

    <Section title="Invoices" right={<ExcelButton r={r} path={`/api/cnf/invoices/excel${invQs}`} file="cnf-invoices.xlsx" />}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div><label className={label}>Status</label><select className={`${input} w-36`} value={status} onChange={e => setStatus(e.target.value)}>
          {['ALL', 'ISSUED', 'CANCELLED'].map(s => <option key={s} value={s}>{s === 'ALL' ? 'All' : s}</option>)}</select></div>
        <div><label className={label}>From</label><input type="date" className={input} value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className={label}>To</label><input type="date" className={input} value={to} onChange={e => setTo(e.target.value)} /></div>
        {provider === 'SAMPLE' && <div className="pb-2 text-xs text-amber-800">E-invoice: SAMPLE IRNs (testing only).</div>}
      </div>
      <Grid rows={invoices} empty="No invoices." onRow={x => openInv(x.id)} selected={inv?.id} cols={[
        { key: 'invoiceNo', title: 'Invoice' }, { key: 'invoiceDate', title: 'Date', render: x => day(x.invoiceDate) }, { key: 'buyerName', title: 'Distributor' },
        { key: 'sellerName', title: 'In the name of' }, { key: 'taxableValue', title: 'Taxable', right: true, render: x => inr(x.taxableValue) },
        { key: 'gst', title: 'GST', right: true, render: x => inr(Number(x.cgst || 0) + Number(x.sgst || 0) + Number(x.igst || 0)) },
        { key: 'total', title: 'Total', right: true, render: x => inr(x.total) }, { key: 'dueDate', title: 'Due', render: x => day(x.dueDate) },
        { key: 'ewayBillNo', title: 'E-way bill' }, { key: 'irn', title: 'IRN', render: x => (x.irn ? `${String(x.irn).slice(0, 8)}...${x.irnSource === 'SAMPLE' ? ' (sample)' : ''}` : '') },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }]} />
      {inv && <div className="mt-4 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Invoice {inv.invoiceNo} <Pill s={inv.status} /></h3>
          <div className="flex flex-wrap gap-2">
            <PdfButton r={r} path={`/api/cnf/invoices/${inv.id}/pdf`} />
            {staff && inv.status === 'ISSUED' && !inv.ewayBillNo && <button className={btnLight} onClick={() => eway(inv.id)}>Add e-way bill</button>}
            {staff && inv.status === 'ISSUED' && !inv.irn && <button className={btnLight} onClick={() => irn('invoices', inv.id, inv.id)}>Record IRN</button>}
            {ctx.manager && inv.status === 'ISSUED' && <button className={btnRed} onClick={() => cancelInv(inv.id)}>Cancel invoice</button>}
            <button className={btnLight} onClick={() => setInv(null)}>Close view</button>
          </div>
        </div>
        {inv.needsEway && inv.status === 'ISSUED' && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">The value is above ₹ 50,000. The goods need an e-way bill before they move.</div>}
        <div className="mt-2"><Info items={[['Seller', `${inv.sellerName || ''}${inv.sellerGstin ? `, GSTIN ${inv.sellerGstin}` : ''}`], ['Buyer', `${inv.buyerName || inv.distributorName || ''}${inv.buyerGstin ? `, GSTIN ${inv.buyerGstin}` : ''}`],
          ['Place of supply', inv.placeOfSupply], ['Truck', inv.vehicleNumber], ['Taxable', inr(inv.taxableValue)], ['CGST', inr(inv.cgstAmount)], ['SGST', inr(inv.sgstAmount)],
          ['IGST', inr(inv.igstAmount)], ['Total', inr(inv.totalAmount)], ['In words', inv.amountInWords], ['Due', day(inv.dueDate)], ['E-way bill', inv.ewayBillNo],
          ['IRN', inv.irn ? `${inv.irn}${inv.irnSource === 'SAMPLE' ? ' (SAMPLE)' : ''}` : ''], ['Ack.', inv.irnAckNo], ['Cancel reason', inv.cancelReason]]} /></div>
        <div className="mt-3"><Grid rows={inv.lines || []} empty="No lines." cols={[
          { key: 'productCode', title: 'Code' }, { key: 'description', title: 'Item', render: x => x.description || x.productName }, { key: 'hsnCode', title: 'HSN' },
          { key: 'batchNo', title: 'Batch' }, { key: 'quantity', title: 'Qty', right: true, render: x => `${qty(x.quantity)} ${x.uom || ''}` },
          { key: 'unitPrice', title: 'Rate', right: true, render: x => inr(x.unitPrice) }, { key: 'taxableValue', title: 'Taxable', right: true, render: x => inr(x.taxableValue) },
          { key: 'gstRate', title: 'GST %', right: true, render: x => qty(x.gstRate) }, { key: 'lineTotal', title: 'Total', right: true, render: x => inr(x.lineTotal) }]} /></div>
        {(inv.creditNotes || []).length > 0 && <div className="mt-2 text-sm">Credit notes: {inv.creditNotes.map((n: any) => `${n.creditNoteNo} (${inr(n.totalAmount)}, ${n.status})`).join('; ')}</div>}
      </div>}
    </Section>

    <Section title="Delivery challans">
      <Grid rows={challans} empty="No challans." cols={[
        { key: 'challanNo', title: 'Challan' }, { key: 'challanDate', title: 'Date', render: x => day(x.challanDate) }, { key: 'distributorName', title: 'Distributor' },
        { key: 'orderNo', title: 'Order' }, { key: 'vehicleNumber', title: 'Truck' }, { key: 'totalQty', title: 'Qty', right: true, render: x => qty(x.totalQty) },
        { key: 'totalValue', title: 'Value', right: true, render: x => inr(x.totalValue) }, { key: 'principalInvoiceNo', title: 'Principal\'s invoice' },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
        { key: 'a', title: '', render: x => <div className="flex gap-1">
          <PdfButton r={r} path={`/api/cnf/challans/${x.id}/pdf`} />
          {ctx.manager && x.status === 'ISSUED' && <button className={btnRed} onClick={() => cancelChallan(x.id)}>Cancel</button>}
        </div> }]} />
    </Section>

    <Section title="Credit notes">
      <Grid rows={notes} empty="No credit notes. They are issued from an accepted claim on the Returns tab." cols={[
        { key: 'creditNoteNo', title: 'Credit note' }, { key: 'noteDate', title: 'Date', render: x => day(x.noteDate) }, { key: 'distributorName', title: 'Distributor' },
        { key: 'invoiceNo', title: 'Against invoice' }, { key: 'claimNo', title: 'Claim' }, { key: 'reason', title: 'Reason' },
        { key: 'total', title: 'Total', right: true, render: x => inr(x.total) },
        { key: 'irn', title: 'IRN', render: x => (x.irn ? `${String(x.irn).slice(0, 8)}...${x.irnSource === 'SAMPLE' ? ' (sample)' : ''}` : '') },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
        { key: 'a', title: '', render: x => <div className="flex gap-1">
          <PdfButton r={r} path={`/api/cnf/credit-notes/${x.id}/pdf`} />
          {staff && x.status === 'ISSUED' && !x.irn && <button className={btnLight} onClick={() => irn('credit-notes', x.id)}>Record IRN</button>}
        </div> }]} />
    </Section>
  </>;
}
