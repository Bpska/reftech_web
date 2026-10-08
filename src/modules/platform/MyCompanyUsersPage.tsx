/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-001 -- My Company Users: a partner login with the role PARTNER_ADMIN manages the logins of its own company.
// It cannot change its own role or lock / deactivate itself; the plan of the transport company limits the number of logins.
// Backend: /api/partner-account/users/** (PartnerAccountController).
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { NotAllowed, PageTitle, ScriptMissing } from './platform';
import { PartnerLoginsManager } from './partnerUsers';

export function MyCompanyUsersPage() {
  const [me, setMe] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => { api('/api/partner-account/users/me').then(setMe).catch(e => setErr(e.message)); }, []);
  const head = <PageTitle icon={<Users aria-hidden />} title="My Company Users">The logins of {me?.partner?.name || 'your company'} and what each may do.</PageTitle>;
  if (err) return <>{head}<NotAllowed what="open this page" /></>;
  if (!me) return <>{head}<p className="mt-4 text-slate-500">Loading...</p></>;
  if (me.ready === false) return <>{head}<ScriptMissing /></>;
  if (!me.canManage) return <>{head}<NotAllowed what="manage the logins of your company (only a Partner Admin may)" /></>;
  return <>{head}<PartnerLoginsManager base="/api/partner-account/users" query="" selfId={Number(currentUser().userId) || undefined} /></>;
}
