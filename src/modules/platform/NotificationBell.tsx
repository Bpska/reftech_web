/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-003 -- the bell in the page header: unread count (asked every 60 s, paused while the tab is hidden), the
// latest 10 unread in a list coloured by severity, click = open the link and mark it read, "See all" opens
// /platform/notifications. Before script 60 the count is 0 and the list says so.
// Backend: /api/platform/notifications (NotificationController).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, Info, OctagonAlert } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDate } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'border-l-4 border-red-600 bg-red-50',
  WARN: 'border-l-4 border-amber-500 bg-amber-50',
  INFO: 'border-l-4 border-sky-500 bg-white',
};

export function SeverityIcon({ s }: { s: string }) {
  if (s === 'CRITICAL') return <OctagonAlert aria-label="Critical" className="h-4 w-4 shrink-0 text-red-700" />;
  if (s === 'WARN') return <AlertTriangle aria-label="Warning" className="h-4 w-4 shrink-0 text-amber-700" />;
  return <Info aria-label="Information" className="h-4 w-4 shrink-0 text-sky-700" />;
}

/** Opens a notification link: inside the portal by the router, else in the same tab. */
export function openLink(link: string | null | undefined, navigate: (to: string) => void) {
  if (!link) return;
  if (link.startsWith('/')) navigate(link); else window.location.href = link;
}

const ago = (v: string) => {
  const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(v);
};

/** tone="dark" for the dark header bar (white icon), "light" for a white background. */
export function NotificationBell({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const navigate = useNavigate();
  const [count, setCount] = useState(0), [open, setOpen] = useState(false), [items, setItems] = useState<any[]>([]);
  const [ready, setReady] = useState(true), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(() => {
    api('/api/platform/notifications/count').then(x => { setCount(Number(x.unread || 0)); setReady(x.ready !== false); }).catch(() => {});
  }, []);

  // Count every 60 s while the tab is visible; at once when it becomes visible again.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!timer) timer = setInterval(refresh, 60_000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = undefined; } };
    const onVis = () => { if (document.hidden) stop(); else { refresh(); start(); } };
    refresh();
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  const loadList = () => {
    setBusy(true); setErr('');
    api('/api/platform/notifications?unread=true&page=1&size=10')
      .then(x => { if (x.ready === false) { setReady(false); setItems([]); } else setItems(Array.isArray(x.items) ? x.items : []); })
      .catch(e => setErr(e.message)).finally(() => setBusy(false));
  };
  useEffect(() => { if (open) loadList(); }, [open]);

  // Close on a click outside or Escape (focus goes back to the bell).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function click(n: any) {
    setOpen(false);
    try { const x = await api(`/api/platform/notifications/${n.id}/read`, { method: 'POST' }); setCount(Number(x.unread ?? Math.max(0, count - 1))); } catch { /* opening still works */ }
    openLink(n.link, navigate);
  }
  async function readAll() {
    try { await api('/api/platform/notifications/read-all', { method: 'POST' }); setCount(0); setItems([]); } catch (e: any) { setErr(e.message); }
  }

  const label = count === 0 ? 'Notifications, none unread' : `Notifications, ${count} unread`;
  const iconColour = tone === 'dark' ? 'text-white hover:bg-white/10 focus:ring-white/40' : 'text-slate-700 hover:bg-slate-100 focus:ring-sky-300';
  return <div ref={box} className="relative inline-block text-left">
    <button ref={button} type="button" aria-label={label} title={label} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 ${iconColour}`}>
      <Bell aria-hidden className="h-6 w-6" />
      {count > 0 && <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-center text-xs font-bold leading-5 text-white">{count > 99 ? '99+' : count}</span>}
    </button>
    {open && <div role="dialog" aria-label="Latest notifications" className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-2xl bg-white text-left text-slate-900 shadow-xl ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="font-bold">Notifications</span>
        {items.length > 0 && <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"><CheckCheck aria-hidden className="h-4 w-4" />Mark all read</button>}
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {!ready && <p className="p-4 text-sm text-amber-900">The notification centre needs database script 60. Ask the administrator to run it.</p>}
        {err && <p role="alert" className="p-4 text-sm text-red-800">{err}</p>}
        {ready && !err && busy && <p className="p-4 text-sm text-slate-500">Loading...</p>}
        {ready && !err && !busy && items.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing new. You are up to date.</p>}
        <ul>
          {items.map(n => <li key={n.id} className="border-b last:border-b-0">
            <button type="button" onClick={() => click(n)} className={`flex w-full gap-2 px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-100 focus:outline-none ${SEVERITY_STYLE[n.severity] || SEVERITY_STYLE.INFO}`}>
              <SeverityIcon s={n.severity} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{n.title}</span>
                {n.body && <span className="mt-0.5 block line-clamp-2 text-xs text-slate-600">{n.body}</span>}
                <span className="mt-0.5 block text-xs text-slate-500">{String(n.category || '').replace(/_/g, ' ')} · {ago(n.createdAt)}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </div>
      <div className="flex justify-between border-t px-4 py-2 text-sm">
        <button type="button" onClick={() => { setOpen(false); navigate('/platform/notifications'); }} className="font-semibold text-sky-700 hover:underline">See all</button>
        <button type="button" onClick={() => { setOpen(false); navigate('/platform/notifications/settings'); }} className="font-semibold text-slate-600 hover:underline">Settings</button>
      </div>
    </div>}
  </div>;
}
