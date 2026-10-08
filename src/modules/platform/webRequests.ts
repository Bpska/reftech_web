/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-004 -- pure helpers of the Website Requests screen (tested by webRequests.test.ts).

export const WEB_SCRIPT = 'database_v2/104_req_cnf_008_009_prt_004_plt_018_trading_public_energy.sql';

/** The statuses staff can move a request to (the server refuses the others): a load request is made with its own button. */
export function nextStatuses(current: string): string[] {
  const c = String(current || '').toUpperCase();
  if (['CONVERTED', 'CLOSED', 'SPAM'].includes(c)) return [];
  return ['CONTACTED', 'QUOTED', 'CLOSED', 'SPAM'].filter(s => s !== c);
}
