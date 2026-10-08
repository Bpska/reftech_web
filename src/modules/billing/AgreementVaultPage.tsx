/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-011 -- Agreement Vault. A Manager or an Admin, or a role with "Keep the agreement vault"
// (permission BILLING_AGREEMENTS, script 101).
//
// Customer and transporter agreements, rate annexures, insurance and service levels are kept with the rate contract
// they govern. Alerts go out 60, 30, 15 and 7 days before the end date, the manager is told at 15 days and a renewal
// is prompted at 30. When an agreement ends, the rates it governs are locked and any new bill on them is held.
// Backend: /api/billing/agreements/... (AgreementController).
// Needs database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql on reftech_billing.
import { useEffect, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { api, apiOpen, apiUpload } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { expiryNote, renewalDates } from './agreements';

const rupee = (n: unknown) => fmtMoney(Number(n || 0));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const SCRIPT = 'database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql';

const BAND: Record<string, string> = {
  EXPIRED: 'bg-red-50 text-red-800', TERMINATED: 'bg-slate-100 text-slate-600',
  DUE_7: 'bg-red-50 text-red-800', DUE_15: 'bg-orange-50 text-orange-900',
  DUE_30: 'bg-amber-50 text-amber-900', DUE_60: 'bg-sky-50 text-sky-900', OK: '',
};
const KIND_TEXT: Record<string, string> = {
  CUSTOMER_AGREEMENT: 'Customer agreement', TRANSPORTER_AGREEMENT: 'Transporter agreement',
  RATE_ANNEXURE: 'Rate annexure', INSURANCE: 'Insurance', SERVICE_LEVEL: 'Service levels',
};

export function AgreementVaultPage() {
  const [options, setOptions] = useState<any>(null);
  const [list, setList] = useState<any>(null);
  const [filter, setFilter] = useState({ status: '', partyType: '', q: '' });
  const [open, setOpen] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [renew, setRenew] = useState<any>(null);
  const [holds, setHolds] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const ready = list ? list.ready !== false : true;

  const load = async () => {
    setErr('');
    try {
      const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString();
      const [o, l, h] = await Promise.all([api('/api/billing/agreements/options'), api(`/api/billing/agreements${qs ? `?${qs}` : ''}`), api('/api/billing/agreements/holds')]);
      setOptions(o); setList(l); setHolds(h.holds || []);
    } catch (e) { setErr(errorText(e, 'Could not load the agreements.')); }
  };
  useEffect(() => { void load(); }, [filter.status, filter.partyType]);

  const show = async (id: number) => {
    setErr('');
    try { setOpen(await api(`/api/billing/agreements/${id}`)); }
    catch (e) { setErr(errorText(e, 'Could not open the agreement.')); }
  };

  const save = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = form.id ? await api(`/api/billing/agreements/${form.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : await api('/api/billing/agreements', { method: 'POST', body: JSON.stringify(form) });
      setMsg(r.message || 'Saved.'); setForm(null); await load();
    } catch (e) { setErr(errorText(e, 'Could not save the agreement.')); } finally { setBusy(false); }
  };

  const upload = async (id: number, file: File) => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await apiUpload(`/api/billing/agreements/${id}/files`, { file }); setMsg(r.message || 'The signed copy is in the vault.'); await show(id); await load(); }
    catch (e) { setErr(errorText(e, 'Could not store the file.')); } finally { setBusy(false); }
  };

  const doRenew = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(`/api/billing/agreements/${renew.id}/renew`, { method: 'POST', body: JSON.stringify(renew) }); setMsg(r.message || 'Renewed.'); setRenew(null); setOpen(null); await load(); }
    catch (e) { setErr(errorText(e, 'Could not renew the agreement.')); } finally { setBusy(false); }
  };

  const end = async (id: number) => {
    const reason = window.prompt('Why is this agreement ended? The rates it governs will be locked.');
    if (reason === null) return;
    setBusy(true); setErr('');
    try { const r = await api(`/api/billing/agreements/${id}/end`, { method: 'POST', body: JSON.stringify({ reason }) }); setMsg(r.message || 'Ended.'); setOpen(null); await load(); }
    catch (e) { setErr(errorText(e, 'Could not end the agreement.')); } finally { setBusy(false); }
  };

  const check = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/agreements/check', { method: 'POST' }); setMsg(r.message || 'Checked.'); await load(); }
    catch (e) { setErr(errorText(e, 'Could not run the check.')); } finally { setBusy(false); }
  };

  const blank = () => setForm({
    kind: 'CUSTOMER_AGREEMENT', partyType: 'PARTNER', partyId: '', title: '', referenceNo: '', startDate: today(), expiryDate: '',
    rateContractKind: 'PARTNER', rateContractId: '', serviceLevels: '', insuredValue: '', ownerUserId: '', managerUserId: '', notes: '',
  });

  const parties = form?.partyType === 'TRANSPORTER' ? options?.transporters : options?.partners;
  const rateContracts = form?.rateContractKind === 'TRANSPORTER' ? options?.transporterContracts : options?.partnerContracts;

  return <div className="mx-auto max-w-7xl p-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><FileSignature className="h-6 w-6" /> Agreement Vault</h1>
    <p className="mt-1 text-slate-600">
      Every signed agreement, rate annexure, insurance cover and service level, kept with the rate contract it governs.
      Alerts go out 60, 30, 15 and 7 days before the end date; the manager is told at 15 days and a renewal is prompted at 30.
      When an agreement ends, its rates are locked and a new bill on them is held until it is renewed.
    </p>
    <Banner msg={msg} error={err} />
    {!ready && <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">This screen needs the database script <b>{SCRIPT}</b> on reftech_billing. Ask the administrator to run it, then reload.</div>}

    {ready && <>
      <Section title="Agreements" right={<div className="flex flex-wrap gap-2">
        <button type="button" className={btnLight} disabled={busy} onClick={check}>Run the expiry check</button>
        <button type="button" className={btn} onClick={blank}>Add an agreement</button>
      </div>}>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-900">Ending in 30 days <b className="block text-lg">{list?.dueIn30Days ?? 0}</b></div>
          <div className="rounded-xl bg-red-50 p-3 text-red-800">Expired <b className="block text-lg">{list?.expired ?? 0}</b></div>
          <div className="rounded-xl bg-slate-50 p-3">Bills held <b className="block text-lg">{list?.heldBills ?? 0}</b></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div><span className={label}>Status</span>
            <select className={input} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="TERMINATED">Ended</option><option value="RENEWED">Renewed</option>
            </select></div>
          <div><span className={label}>Party</span>
            <select className={input} value={filter.partyType} onChange={e => setFilter({ ...filter, partyType: e.target.value })}>
              <option value="">All</option><option value="PARTNER">Customers</option><option value="TRANSPORTER">Transporters</option>
            </select></div>
          <div className="md:col-span-2"><span className={label}>Search</span>
            <div className="flex gap-2"><input className={input} value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} placeholder="Number, title or party" />
              <button type="button" className={btnLight} onClick={() => void load()}>Find</button></div></div>
        </div>

        {form && <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div><span className={label}>Kind</span>
              <select className={input} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
                {(options?.kinds || []).map((k: string) => <option key={k} value={k}>{KIND_TEXT[k] || k}</option>)}
              </select></div>
            <div><span className={label}>Party type</span>
              <select className={input} value={form.partyType} onChange={e => setForm({ ...form, partyType: e.target.value, partyId: '' })}>
                <option value="PARTNER">Customer</option><option value="TRANSPORTER">Transporter</option>
              </select></div>
            <div><span className={label}>Party</span>
              <select className={input} value={form.partyId} onChange={e => setForm({ ...form, partyId: e.target.value })}>
                <option value="">Choose</option>
                {(parties || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div><span className={label}>Title</span><input className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><span className={label}>Their reference</span><input className={input} value={form.referenceNo || ''} onChange={e => setForm({ ...form, referenceNo: e.target.value })} /></div>
            <div><span className={label}>Signed from</span><input type="date" className={input} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><span className={label}>Ends on</span><input type="date" className={input} value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} /></div>
            <div><span className={label}>Rates it governs</span>
              <select className={input} value={form.rateContractKind} onChange={e => setForm({ ...form, rateContractKind: e.target.value, rateContractId: '' })}>
                <option value="PARTNER">Customer rate contract</option><option value="TRANSPORTER">Transporter rate contract</option>
              </select></div>
            <div><span className={label}>Rate contract</span>
              <select className={input} value={form.rateContractId || ''} onChange={e => setForm({ ...form, rateContractId: e.target.value })}>
                <option value="">None</option>
                {(rateContracts || []).map((c: any) => <option key={c.id} value={c.id}>{c.contractNo}</option>)}
              </select></div>
            <div><span className={label}>Insured value (Rs)</span><input className={input} value={form.insuredValue || ''} onChange={e => setForm({ ...form, insuredValue: e.target.value })} /></div>
            <div><span className={label}>Owner</span>
              <select className={input} value={form.ownerUserId || ''} onChange={e => setForm({ ...form, ownerUserId: e.target.value })}>
                <option value="">None</option>{(options?.users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
            <div><span className={label}>Manager told at 15 days</span>
              <select className={input} value={form.managerUserId || ''} onChange={e => setForm({ ...form, managerUserId: e.target.value })}>
                <option value="">Every manager</option>{(options?.users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
            <div className="md:col-span-2"><span className={label}>Service levels</span><input className={input} value={form.serviceLevels || ''} onChange={e => setForm({ ...form, serviceLevels: e.target.value })} placeholder="Temperature -18 C, 98 % on time" /></div>
            <div className="md:col-span-2"><span className={label}>Notes</span><input className={input} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex gap-2"><button type="button" className={btn} disabled={busy} onClick={save}>Save</button>
            <button type="button" className={btnLight} onClick={() => setForm(null)}>Cancel</button></div>
        </div>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>Number</th><th className={th}>Kind</th><th className={th}>Party</th><th className={th}>Rates</th>
            <th className={th}>Ends</th><th className={th}>Status</th><th className={th}>Files</th><th className={th} />
          </tr></thead><tbody>
            {(list?.agreements || []).map((a: any) => <tr key={a.id} className={`border-b border-slate-100 ${BAND[a.band] || ''}`}>
              <td className={td}>{a.agreementNo}<div className="text-xs text-slate-500">{a.title}</div></td>
              <td className={td}>{KIND_TEXT[a.kind] || a.kind}</td>
              <td className={td}>{a.partyName}</td>
              <td className={td}>{a.rateContractNo || '-'}{a.locked ? <div className="text-xs font-semibold text-red-700">locked</div> : null}</td>
              <td className={td}>{a.expiryDate}<div className="text-xs">{expiryNote(a.daysLeft ?? null)}</div></td>
              <td className={td}>{a.status}{a.heldBills > 0 ? <div className="text-xs text-red-700">{a.heldBills} bills held</div> : null}</td>
              <td className={td}>{a.files || 0}</td>
              <td className={td}><button type="button" className={btnLight} onClick={() => show(a.id)}>Open</button></td>
            </tr>)}
            {(list?.agreements || []).length === 0 && <tr><td className={td} colSpan={8}>No agreement in the vault yet.</td></tr>}
          </tbody></table>
        </div>
      </Section>

      {open?.agreement && <Section title={`${open.agreement.agreementNo} - ${open.agreement.title}`} right={<button type="button" className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div>Party: <b>{open.agreement.partyName}</b></div>
          <div>Term: {open.agreement.startDate} to {open.agreement.expiryDate}</div>
          <div>{expiryNote(open.agreement.daysLeft ?? null)}</div>
          <div>Rates: {open.agreement.rateContractNo || '-'}{open.agreement.locked ? ' (locked)' : ''}</div>
          <div>Insured value: {open.agreement.insuredValue ? rupee(open.agreement.insuredValue) : '-'}</div>
          <div>Service levels: {open.agreement.serviceLevels || '-'}</div>
          <div>Owner: {open.agreement.ownerName || '-'}</div>
          <div>Manager: {open.agreement.managerName || 'every manager'}</div>
          <div>Status: {open.agreement.status}</div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnLight} onClick={() => setForm({ ...open.agreement })}>Change</button>
          <button type="button" className={btn} onClick={() => {
            const next = renewalDates(String(open.agreement.startDate).slice(0, 10), String(open.agreement.expiryDate).slice(0, 10));
            setRenew({ id: open.agreement.id, startDate: next?.from || today(), expiryDate: next?.to || '', rateContractId: open.agreement.rateContractId || '', referenceNo: '', notes: '' });
          }}>Renew</button>
          {open.agreement.status === 'ACTIVE' && <button type="button" className={btnRed} disabled={busy} onClick={() => end(open.agreement.id)}>End it now</button>}
          <label className={`${btnLight} cursor-pointer`}>Add the signed copy
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(open.agreement.id, f); }} />
          </label>
        </div>

        {renew && <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <h3 className="font-bold">Renew for a new term</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-4">
            <div><span className={label}>From</span><input type="date" className={input} value={renew.startDate} onChange={e => setRenew({ ...renew, startDate: e.target.value })} /></div>
            <div><span className={label}>To</span><input type="date" className={input} value={renew.expiryDate} onChange={e => setRenew({ ...renew, expiryDate: e.target.value })} /></div>
            <div><span className={label}>Their reference</span><input className={input} value={renew.referenceNo} onChange={e => setRenew({ ...renew, referenceNo: e.target.value })} /></div>
            <div><span className={label}>Notes</span><input className={input} value={renew.notes} onChange={e => setRenew({ ...renew, notes: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex gap-2"><button type="button" className={btn} disabled={busy} onClick={doRenew}>Renew</button>
            <button type="button" className={btnLight} onClick={() => setRenew(null)}>Cancel</button></div>
        </div>}

        <h3 className="mt-5 font-bold">Signed copies</h3>
        <table className="mt-2 min-w-full text-sm"><tbody>
          {(open.files || []).map((f: any) => <tr key={f.id} className="border-b border-slate-100">
            <td className={td}>{f.fileName}</td><td className={td}>{f.uploadedBy}</td><td className={td}>{String(f.uploadedAt || '').slice(0, 10)}</td>
            <td className={td}><button type="button" className={btnLight} onClick={() => void apiOpen(`/api/billing/agreements/files/${f.id}`)}>Open</button></td>
          </tr>)}
          {(open.files || []).length === 0 && <tr><td className={td}>No signed copy yet.</td></tr>}
        </tbody></table>

        <h3 className="mt-5 font-bold">Alerts sent</h3>
        <table className="mt-2 min-w-full text-sm"><tbody>
          {(open.alerts || []).map((al: any, i: number) => <tr key={i} className="border-b border-slate-100">
            <td className={td}>{al.stage >= 0 ? `${al.stage} days before` : 'at expiry'}</td><td className={td}>{al.kind}</td>
            <td className={td}>{al.sentTo}</td><td className={td}>{String(al.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
          </tr>)}
          {(open.alerts || []).length === 0 && <tr><td className={td}>No alert yet.</td></tr>}
        </tbody></table>

        {(open.holds || []).length > 0 && <>
          <h3 className="mt-5 font-bold">Bills held</h3>
          <table className="mt-2 min-w-full text-sm"><tbody>
            {open.holds.map((h: any) => <tr key={h.id} className="border-b border-slate-100">
              <td className={td}>{h.invoiceNumber || h.invoiceId}</td><td className={td}>{h.reason}</td><td className={td}>{String(h.createdAt || '').slice(0, 10)}</td>
            </tr>)}
          </tbody></table>
        </>}
      </Section>}

      {holds.length > 0 && <Section title="Bills held because an agreement ended">
        <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
          <th className={th}>Bill</th><th className={th}>Agreement</th><th className={th}>Reason</th><th className={th}>Held on</th>
        </tr></thead><tbody>
          {holds.map(h => <tr key={h.id} className="border-b border-slate-100">
            <td className={td}>{h.invoiceNumber || h.invoiceId}</td><td className={td}>{h.agreementNo || '-'}</td>
            <td className={td}>{h.reason}</td><td className={td}>{String(h.createdAt || '').slice(0, 10)}</td>
          </tr>)}
        </tbody></table>
        <p className="mt-2 text-sm text-slate-600">Renew the agreement, then approve the bill again.</p>
      </Section>}
    </>}
  </div>;
}

export default AgreementVaultPage;
