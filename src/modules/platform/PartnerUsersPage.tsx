/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-001 -- Partner Users (staff: Manager, Admin or a role with MASTERS_EDIT). Pick a partner (customer)
// company, see its logins and their partner roles, add, change, reset password, lock, deactivate.
// Backend: /api/platform/partner-users/** (PartnerUserController). Opened from Partners with ?partner=<id>.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '@/shared/services/api';
import { input, label } from '@/shared/components/FormKit';
import { NotAllowed, PageTitle, ScriptMissing } from './platform';
import { PartnerLoginsManager } from './partnerUsers';

export function PartnerUsersPage() {
  const [params, setParams] = useSearchParams();
  const [partners, setPartners] = useState<any[] | null>(null), [ready, setReady] = useState(true), [err, setErr] = useState('');
  const partnerId = params.get('partner') || '';
  useEffect(() => {
    api('/api/platform/partner-users/partners').then(x => { if (x.ready === false) setReady(false); else setPartners(x.items || []); })
      .catch(e => setErr(e.message));
  }, []);
  const chosen = partners?.find(p => String(p.id) === partnerId);
  const head = <PageTitle icon={<Users aria-hidden />} title="Partner Users">The sign-in logins of your customers (partners) and what each may do.</PageTitle>;
  if (!ready) return <>{head}<ScriptMissing /></>;
  if (err && !partners) return <>{head}{/403|may/i.test(err) ? <NotAllowed what="manage partner logins" /> : <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}</>;
  return <>
    {head}
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <label className={label} htmlFor="partner-pick">Partner company</label>
      <select id="partner-pick" className={input} value={partnerId} onChange={e => setParams(e.target.value ? { partner: e.target.value } : {})}>
        <option value="">Choose the partner</option>
        {(partners || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.partnerCode || '#' + p.id}) - {p.activeLogins} active of {p.logins} logins{p.active ? '' : ' - inactive partner'}</option>)}
      </select>
      {partners && partners.length > 0 && !partnerId && <table className="mt-4 w-full text-sm">
        <thead><tr className="bg-slate-50"><th scope="col" className="px-2.5 py-2 text-left">Partner</th><th scope="col" className="px-2.5 py-2 text-left">Active logins</th><th scope="col" className="px-2.5 py-2 text-left">All logins</th></tr></thead>
        <tbody>{partners.map(p => <tr key={p.id} className="border-t">
          <td className="px-2.5 py-2"><button type="button" className="font-semibold text-sky-700 underline" onClick={() => setParams({ partner: String(p.id) })}>{p.name}</button> <span className="text-xs text-slate-500">{p.partnerCode}</span></td>
          <td className="px-2.5 py-2">{p.activeLogins}</td><td className="px-2.5 py-2">{p.logins}</td></tr>)}</tbody>
      </table>}
    </div>
    {partnerId && <PartnerLoginsManager key={partnerId} base="/api/platform/partner-users" query={`?partnerId=${partnerId}`} exportName={`partner-logins-${chosen?.partnerCode || partnerId}`} />}
  </>;
}
