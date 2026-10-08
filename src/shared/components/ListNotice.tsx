/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-004 -- when the server cut a list at a fixed number of rows (header X-List-Note, backend common/ListCut),
// this bar says so: "Showing the first 300 ... There are more: narrow the search ...". It closes by itself after a while.
import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { LIST_NOTE_EVENT } from '@/shared/services/api';

export function ListNotice() {
  const [note, setNote] = useState('');
  useEffect(() => {
    const on = (e: Event) => setNote(String((e as CustomEvent).detail || ''));
    window.addEventListener(LIST_NOTE_EVENT, on);
    return () => window.removeEventListener(LIST_NOTE_EVENT, on);
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 15000);
    return () => clearTimeout(t);
  }, [note]);
  if (!note) return null;
  return <div role="status" className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg">
    <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
    <span className="flex-1">{note}</span>
    <button type="button" onClick={() => setNote('')} aria-label="Close" className="text-amber-800"><X className="h-4 w-4" /></button>
  </div>;
}
