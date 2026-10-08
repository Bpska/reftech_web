/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-010 -- Collections. A Manager or an Admin, or a role with "Chase payments and match bank receipts"
// (permission BILLING_COLLECTIONS, script 101). Three tabs:
//   Due & reminders  open bills with the days overdue, the reminder settings, and "Send today's reminders"
//   Promises         a customer's promise to pay on a date, and the follow-up when the date passes
//   Bank statement   a CSV of the bank, matched to bills; a line nobody could match is left for staff to place
// Backend: /api/billing/collections/... (CollectionsController).
// Needs database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql on reftech_billing.
import { useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { api, apiUpload } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { ageing, bucket, daysToDue, promiseLate } from './collections';

const rupee = (n: unknown) => fmtMoney(Number(n || 0));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const SCRIPT = 'database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql';

const BAND: Record<string, string> = {
  overdue: 'bg-red-50 text-red-800', 'due-today': 'bg-amber-50 text-amber-900',
  'due-soon': 'bg-sky-50 text-sky-900', 'due-later': '', 'no-due-date': 'text-slate-500',
};

export function CollectionsPage() {
  const [tab, setTab] = useState<'due' | 'promises' | 'bank'>('due');
  const [due, setDue] = useState<any>(null);
  const [setting, setSetting] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [promises, setPromises] = useState<any>(null);
  const [promiseForm, setPromiseForm] = useState<any>(null);
  const [statements, setStatements] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [bankAccount, setBankAccount] = useState('');
  const [pasted, setPasted] = useState('');
  const [confirmLine, setConfirmLine] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const ready = due ? due.ready !== false : true;

  const loadDue = async () => {
    try { const d = await api('/api/billing/collections/due'); setDue(d); if (d.setting) setSetting({ ...d.setting }); }
    catch (e) { setErr(errorText(e, 'Could not load the open bills.')); }
  };
  const loadReminders = async () => {
    try { setReminders(await api('/api/billing/collections/reminders')); } catch { /* the list is extra */ }
  };
  const loadPromises = async () => {
    try { setPromises(await api('/api/billing/collections/promises')); }
    catch (e) { setErr(errorText(e, 'Could not load the promises.')); }
  };
  const loadBank = async () => {
    try { const [s, l] = await Promise.all([api('/api/billing/collections/statements'), api('/api/billing/collections/lines')]); setStatements(s); setLines(l.lines || []); }
    catch (e) { setErr(errorText(e, 'Could not load the bank statements.')); }
  };

  useEffect(() => { void loadDue(); void loadReminders(); }, []);
  useEffect(() => { if (tab === 'promises') void loadPromises(); if (tab === 'bank') void loadBank(); }, [tab]);

  const saveSetting = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/collections/settings', { method: 'PUT', body: JSON.stringify(setting) }); setMsg(r.message || 'Settings saved.'); await loadDue(); }
    catch (e) { setErr(errorText(e, 'Could not save the settings.')); } finally { setBusy(false); }
  };

  const runReminders = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/collections/reminders/run', { method: 'POST' }); setMsg(r.message || 'Done.'); await loadDue(); await loadReminders(); }
    catch (e) { setErr(errorText(e, 'Could not send the reminders.')); } finally { setBusy(false); }
  };

  const sendOne = async (invoiceId: number) => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(`/api/billing/collections/reminders/${invoiceId}`, { method: 'POST', body: JSON.stringify({}) }); setMsg(r.message || 'Sent.'); await loadReminders(); await loadDue(); }
    catch (e) { setErr(errorText(e, 'Could not send the reminder.')); } finally { setBusy(false); }
  };

  const savePromise = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/collections/promises', { method: 'POST', body: JSON.stringify(promiseForm) }); setMsg(r.message || 'Promise recorded.'); setPromiseForm(null); await loadPromises(); await loadDue(); }
    catch (e) { setErr(errorText(e, 'Could not record the promise.')); } finally { setBusy(false); }
  };

  const closePromise = async (id: number, status: string) => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(`/api/billing/collections/promises/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); setMsg(r.message || 'Saved.'); await loadPromises(); }
    catch (e) { setErr(errorText(e, 'Could not change the promise.')); } finally { setBusy(false); }
  };

  const importStatement = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = file ? await apiUpload(`/api/billing/collections/statements${bankAccount ? `?bankAccount=${encodeURIComponent(bankAccount)}` : ''}`, { file })
        : await api('/api/billing/collections/statements', { method: 'POST', body: JSON.stringify({ fileName: 'pasted statement', text: pasted, bankAccount }) });
      setMsg(r.message || 'Imported.'); setFile(null); setPasted(''); await loadBank();
    } catch (e) { setErr(errorText(e, 'Could not import the statement.')); } finally { setBusy(false); }
  };

  const rematch = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/collections/lines/rematch', { method: 'POST' }); setMsg(r.message || 'Matched again.'); await loadBank(); }
    catch (e) { setErr(errorText(e, 'Could not match the credits.')); } finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const body = { partnerId: Number(confirmLine.partnerId), invoiceIds: String(confirmLine.invoiceIds || '').split(',').filter(Boolean).map(Number), tdsAmount: confirmLine.tdsAmount || null, method: confirmLine.method || 'NEFT' };
      const r = await api(`/api/billing/collections/lines/${confirmLine.id}/confirm`, { method: 'POST', body: JSON.stringify(body) });
      setMsg(r.message || 'Receipt saved.'); setConfirmLine(null); await loadBank(); await loadDue();
    } catch (e) { setErr(errorText(e, 'Could not record the receipt.')); } finally { setBusy(false); }
  };

  const ignore = async (id: number) => {
    const reason = window.prompt('Why is this line set aside?');
    if (reason === null) return;
    setBusy(true); setErr('');
    try { const r = await api(`/api/billing/collections/lines/${id}/ignore`, { method: 'POST', body: JSON.stringify({ reason }) }); setMsg(r.message || 'Set aside.'); await loadBank(); }
    catch (e) { setErr(errorText(e, 'Could not set the line aside.')); } finally { setBusy(false); }
  };

  const bills = due?.bills || [];
  const rows = ageing(bills, today());
  const tabBtn = (k: typeof tab, text: string) => <button type="button" className={tab === k ? btn : btnLight} onClick={() => setTab(k)}>{text}</button>;

  return <div className="mx-auto max-w-7xl p-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><HandCoins className="h-6 w-6" /> Collections</h1>
    <p className="mt-1 text-slate-600">
      Reminders by email and WhatsApp before the due date, on the day and after it, with the bill and the delivery proof attached.
      Promises to pay are recorded and followed up. A bank statement is imported and its credits are matched to bills; anything
      not matched is left here for staff to place.
    </p>
    <Banner msg={msg} error={err} />
    {!ready && <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">This screen needs the database script <b>{SCRIPT}</b> on reftech_billing. Ask the administrator to run it, then reload.</div>}

    {ready && <>
      <div className="mt-4 flex flex-wrap gap-2">{tabBtn('due', 'Due & reminders')}{tabBtn('promises', 'Payment promises')}{tabBtn('bank', 'Bank statement')}</div>

      {tab === 'due' && <>
        <Section title="What is outstanding">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">Outstanding <b className="block text-lg">{rupee(due?.outstanding)}</b></div>
            <div className="rounded-xl bg-red-50 p-3 text-red-800">Overdue <b className="block text-lg">{rupee(due?.overdue)}</b></div>
            {rows.map(r => <div key={r.label} className="rounded-xl bg-slate-50 p-3">{r.label} <b className="block">{rupee(r.amount)}</b><span className="text-xs text-slate-500">{r.count} bills</span></div>)}
          </div>
        </Section>

        {setting && <Section title="Reminder settings" right={<button type="button" className={btn} disabled={busy} onClick={saveSetting}>Save</button>}>
          <div className="grid gap-3 md:grid-cols-4">
            <div><span className={label}>Days before the due date</span><input className={input} value={setting.daysBefore} onChange={e => setSetting({ ...setting, daysBefore: e.target.value })} /></div>
            <div><span className={label}>On the due date</span>
              <select className={input} value={String(setting.onDue)} onChange={e => setSetting({ ...setting, onDue: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <div><span className={label}>Days after (overdue)</span><input className={input} value={setting.overdueDays} onChange={e => setSetting({ ...setting, overdueDays: e.target.value })} /></div>
            <div><span className={label}>Channels</span><input className={input} value={setting.channels} onChange={e => setSetting({ ...setting, channels: e.target.value })} placeholder="EMAIL,WHATSAPP" /></div>
            <div><span className={label}>Days of grace after a promise</span><input className={input} value={setting.promiseGraceDays} onChange={e => setSetting({ ...setting, promiseGraceDays: e.target.value })} /></div>
            <div><span className={label}>Attach the bill</span>
              <select className={input} value={String(setting.attachInvoice)} onChange={e => setSetting({ ...setting, attachInvoice: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <div><span className={label}>Attach the delivery proof</span>
              <select className={input} value={String(setting.attachProof)} onChange={e => setSetting({ ...setting, attachProof: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Reminder days: {(setting.stageDays || []).join(', ') || 'none'}. The morning job is {setting.automatic ? 'on' : 'off (app.billing.collections.reminders-enabled)'};
            email {setting.emailReady ? 'is set up' : 'is not set up'}; WhatsApp: {setting.whatsappStatus}.
          </p>
        </Section>}

        <Section title="Open bills" right={<button type="button" className={btn} disabled={busy} onClick={runReminders}>Send today's reminders</button>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
              <th className={th}>Bill</th><th className={th}>Customer</th><th className={th}>Due</th><th className={th}>Outstanding</th>
              <th className={th}>Reminder today</th><th className={th}>Last reminder</th><th className={th}>Promise</th><th className={th} />
            </tr></thead><tbody>
              {bills.map((b: any) => {
                const d = daysToDue(b.dueDate, today());
                return <tr key={b.id} className={`border-b border-slate-100 ${BAND[bucket(d, setting?.daysBefore || 0)] || ''}`}>
                  <td className={td}>{b.taxInvoiceNumber || b.invoiceNumber}</td>
                  <td className={td}>{b.partnerName || '-'}</td>
                  <td className={td}>{b.dueDate || '-'}<div className="text-xs">{d === null ? '' : d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : `in ${d} days`}</div></td>
                  <td className={td}>{rupee(b.outstanding)}</td>
                  <td className={td}>{b.reminderDueToday === null || b.reminderDueToday === undefined ? '-' : b.reminderDueToday > 0 ? `${b.reminderDueToday} days before` : b.reminderDueToday === 0 ? 'on the day' : `${-b.reminderDueToday} days overdue`}</td>
                  <td className={td}>{b.lastReminder ? `${b.lastReminder.channel} ${b.lastReminder.status}` : '-'}</td>
                  <td className={td}>{b.promise ? `${rupee(b.promise.amount)} on ${b.promise.date}` : '-'}</td>
                  <td className={td}><button type="button" className={btnLight} disabled={busy} onClick={() => sendOne(b.id)}>Send now</button>{' '}
                    <button type="button" className={btnLight} onClick={() => { setTab('promises'); setPromiseForm({ partnerId: b.partnerId, invoiceId: b.id, promisedAmount: b.outstanding, promisedDate: today(), contactName: '', contactPhone: '', channel: 'PHONE', notes: '' }); }}>Promise</button></td>
                </tr>;
              })}
              {bills.length === 0 && <tr><td className={td} colSpan={8}>Nothing is outstanding.</td></tr>}
            </tbody></table>
          </div>
        </Section>

        <Section title="Reminders sent">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
              <th className={th}>When</th><th className={th}>Bill</th><th className={th}>Customer</th><th className={th}>Stage</th><th className={th}>Channel</th><th className={th}>To</th><th className={th}>Status</th>
            </tr></thead><tbody>
              {reminders.slice(0, 100).map((r: any) => <tr key={r.id} className="border-b border-slate-100">
                <td className={td}>{String(r.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                <td className={td}>{r.billNo || r.invoiceId}</td><td className={td}>{r.partnerName || '-'}</td>
                <td className={td}>{r.stage}</td><td className={td}>{r.channel}</td><td className={td}>{r.sentTo || '-'}</td>
                <td className={td}>{r.status}{r.failureReason ? ` - ${r.failureReason}` : ''}</td>
              </tr>)}
              {reminders.length === 0 && <tr><td className={td} colSpan={7}>No reminder has gone out yet.</td></tr>}
            </tbody></table>
          </div>
        </Section>
      </>}

      {tab === 'promises' && <Section title="Payment promises" right={<button type="button" className={btn} onClick={() => setPromiseForm({ partnerId: '', invoiceId: '', promisedAmount: '', promisedDate: today(), contactName: '', contactPhone: '', channel: 'PHONE', notes: '' })}>Record a promise</button>}>
        {promiseForm && <div className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div><span className={label}>Customer</span>
              <select className={input} value={promiseForm.partnerId} onChange={e => setPromiseForm({ ...promiseForm, partnerId: e.target.value })}>
                <option value="">Choose</option>
                {(promises?.partners || bills.map((b: any) => ({ id: b.partnerId, name: b.partnerName }))).map((p: any, i: number) => <option key={`${p.id}-${i}`} value={p.id}>{p.name}</option>)}
              </select></div>
            <div><span className={label}>Bill (optional)</span>
              <select className={input} value={promiseForm.invoiceId} onChange={e => setPromiseForm({ ...promiseForm, invoiceId: e.target.value })}>
                <option value="">Any bill of the customer</option>
                {bills.filter((b: any) => String(b.partnerId) === String(promiseForm.partnerId)).map((b: any) => <option key={b.id} value={b.id}>{b.taxInvoiceNumber || b.invoiceNumber}</option>)}
              </select></div>
            <div><span className={label}>Amount promised</span><input className={input} value={promiseForm.promisedAmount} onChange={e => setPromiseForm({ ...promiseForm, promisedAmount: e.target.value })} /></div>
            <div><span className={label}>Promised for</span><input type="date" className={input} value={promiseForm.promisedDate} onChange={e => setPromiseForm({ ...promiseForm, promisedDate: e.target.value })} /></div>
            <div><span className={label}>Who said so</span><input className={input} value={promiseForm.contactName} onChange={e => setPromiseForm({ ...promiseForm, contactName: e.target.value })} /></div>
            <div><span className={label}>Phone</span><input className={input} value={promiseForm.contactPhone} onChange={e => setPromiseForm({ ...promiseForm, contactPhone: e.target.value })} /></div>
            <div><span className={label}>Told us by</span>
              <select className={input} value={promiseForm.channel} onChange={e => setPromiseForm({ ...promiseForm, channel: e.target.value })}>
                <option value="PHONE">Phone</option><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option><option value="MEETING">Meeting</option>
              </select></div>
            <div><span className={label}>Notes</span><input className={input} value={promiseForm.notes} onChange={e => setPromiseForm({ ...promiseForm, notes: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex gap-2"><button type="button" className={btn} disabled={busy} onClick={savePromise}>Save</button>
            <button type="button" className={btnLight} onClick={() => setPromiseForm(null)}>Cancel</button></div>
        </div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>Customer</th><th className={th}>Bill</th><th className={th}>Amount</th><th className={th}>Promised for</th>
            <th className={th}>Status</th><th className={th}>Follow up</th><th className={th} />
          </tr></thead><tbody>
            {(promises?.promises || []).map((p: any) => <tr key={p.id} className={`border-b border-slate-100 ${promiseLate(p.promisedDate, p.status, today()) ? 'bg-red-50' : ''}`}>
              <td className={td}>{p.partnerName || p.partnerId}</td><td className={td}>{p.billNo || '-'}</td>
              <td className={td}>{rupee(p.promisedAmount)}</td><td className={td}>{p.promisedDate}</td>
              <td className={td}>{p.status}{promiseLate(p.promisedDate, p.status, today()) ? ' - the date has passed' : ''}</td>
              <td className={td}>{p.followUpOn || '-'}</td>
              <td className={td}>{p.status === 'OPEN' && <>
                <button type="button" className={btnLight} disabled={busy} onClick={() => closePromise(p.id, 'KEPT')}>Kept</button>{' '}
                <button type="button" className={btnLight} disabled={busy} onClick={() => closePromise(p.id, 'PARTLY_KEPT')}>Part paid</button>{' '}
                <button type="button" className={btnRed} disabled={busy} onClick={() => closePromise(p.id, 'BROKEN')}>Broken</button>
              </>}</td>
            </tr>)}
            {(promises?.promises || []).length === 0 && <tr><td className={td} colSpan={7}>No promise recorded.</td></tr>}
          </tbody></table>
        </div>
      </Section>}

      {tab === 'bank' && <>
        <Section title="Import a bank statement">
          <div className="grid gap-3 md:grid-cols-3">
            <div><span className={label}>Bank account</span><input className={input} value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="HDFC 50200012345678" /></div>
            <div><span className={label}>CSV file</span><input type="file" accept=".csv,.txt" className={input} onChange={e => setFile(e.target.files?.[0] || null)} /></div>
            <div className="md:col-span-3"><span className={label}>Or paste the statement</span>
              <textarea className={`${input} h-24 font-mono text-xs`} value={pasted} onChange={e => setPasted(e.target.value)} /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className={btn} disabled={busy || (!file && !pasted.trim())} onClick={importStatement}>Import and match</button>
            <button type="button" className={btnLight} disabled={busy} onClick={rematch}>Match the open credits again</button>
          </div>
          {statements?.statements?.length > 0 && <p className="mt-2 text-sm text-slate-600">
            {statements.statements.length} statements imported; {rupee(statements.openCredit)} of credits still to place.
          </p>}
        </Section>

        <Section title="Bank credits">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
              <th className={th}>Date</th><th className={th}>Narration</th><th className={th}>Reference</th><th className={th}>Credit</th>
              <th className={th}>Suggestion</th><th className={th}>Status</th><th className={th} />
            </tr></thead><tbody>
              {lines.map(l => <tr key={l.id} className="border-b border-slate-100">
                <td className={td}>{l.txnDate}</td>
                <td className={`${td} max-w-xs truncate`} title={l.narration}>{l.narration}</td>
                <td className={td}>{l.reference || '-'}</td>
                <td className={td}>{rupee(l.credit)}</td>
                <td className={td}>{l.partnerName ? <>{l.partnerName}<div className="text-xs text-slate-500">{(l.bills || []).join(', ')} - {l.reason}</div></> : <span className="text-slate-500">nobody could be matched</span>}</td>
                <td className={td}>{l.status}{l.receiptNumber ? ` ${l.receiptNumber}` : ''}</td>
                <td className={td}>{(l.status === 'SUGGESTED' || l.status === 'OPEN') && <>
                  <button type="button" className={btnLight} onClick={() => setConfirmLine({ ...l, invoiceIds: l.invoiceIds || '', method: 'NEFT', tdsAmount: '' })}>Record</button>{' '}
                  <button type="button" className={btnRed} disabled={busy} onClick={() => ignore(l.id)}>Set aside</button>
                </>}</td>
              </tr>)}
              {lines.length === 0 && <tr><td className={td} colSpan={7}>No credit is waiting to be placed.</td></tr>}
            </tbody></table>
          </div>
          {confirmLine && <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <h3 className="font-bold">Record {rupee(confirmLine.credit)} of {confirmLine.txnDate}</h3>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              <div><span className={label}>Customer</span>
                <select className={input} value={confirmLine.partnerId || ''} onChange={e => setConfirmLine({ ...confirmLine, partnerId: e.target.value })}>
                  <option value="">Choose</option>
                  {bills.map((b: any) => ({ id: b.partnerId, name: b.partnerName })).filter((p: any, i: number, a: any[]) => a.findIndex(x => x.id === p.id) === i)
                    .map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div><span className={label}>Bills (ids, comma separated)</span><input className={input} value={confirmLine.invoiceIds} onChange={e => setConfirmLine({ ...confirmLine, invoiceIds: e.target.value })} /></div>
              <div><span className={label}>TDS kept back</span><input className={input} value={confirmLine.tdsAmount} onChange={e => setConfirmLine({ ...confirmLine, tdsAmount: e.target.value })} /></div>
              <div><span className={label}>Paid by</span>
                <select className={input} value={confirmLine.method} onChange={e => setConfirmLine({ ...confirmLine, method: e.target.value })}>
                  <option value="NEFT">NEFT</option><option value="RTGS">RTGS</option><option value="IMPS">IMPS</option><option value="UPI">UPI</option><option value="CHEQUE">Cheque</option>
                </select></div>
            </div>
            <p className="mt-2 text-sm text-slate-600">The bills are those on the Due tab; their ids are in the suggestion above.</p>
            <div className="mt-3 flex gap-2"><button type="button" className={btn} disabled={busy} onClick={confirm}>Save the receipt</button>
              <button type="button" className={btnLight} onClick={() => setConfirmLine(null)}>Cancel</button></div>
          </div>}
        </Section>
      </>}
    </>}
  </div>;
}

export default CollectionsPage;
