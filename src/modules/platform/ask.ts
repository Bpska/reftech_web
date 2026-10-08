/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-017 -- pure helpers of the Ask screen (tested by ask.test.ts) and the document upload.

export const ASK_SCRIPT = 'database_v2/106_req_plt_017_ask_questions_reftech_ai.sql';
export const DOC_MAX_BYTES = 5 * 1024 * 1024;

export type AskLang = 'en' | 'hi';

/** The language the browser listens for: Indian English or Hindi. */
export function speechLang(lang: AskLang): string {
  return lang === 'hi' ? 'hi-IN' : 'en-IN';
}

/** The browser's speech recogniser, or null (Chrome and Edge have it; Firefox does not). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Web Speech API has no types in lib.dom
export function recogniser(w: any = typeof window === 'undefined' ? {} : window): any {
  const R = w.SpeechRecognition || w.webkitSpeechRecognition;
  return R ? new R() : null;
}

/** "avgLateHours" -> "Avg late hours". */
export function columnTitle(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A cell of the answer table: numbers with Indian grouping, ISO times shortened, the rest as text. */
export function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const s = String(v);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 16).replace('T', ' ');
  return s;
}

/** The chart of an answer for the BarChart of the chart kit, or null. */
export function chartOf(answer: { chart?: { title?: string; labels?: unknown[]; values?: unknown[] } | null }): { title: string; labels: string[]; series: { name: string; values: number[] }[] } | null {
  const c = answer?.chart;
  if (!c || !Array.isArray(c.labels) || c.labels.length === 0) return null;
  return { title: c.title || '', labels: c.labels.map(String), series: [{ name: c.title || 'Value', values: (c.values || []).map(v => Number(v) || 0) }] };
}

/** What is wrong with a file for the document check, or ''. */
export function docProblem(file: { name: string; size: number } | null): string {
  if (!file) return 'Choose the file.';
  if (file.size > DOC_MAX_BYTES) return 'The file is larger than 5 MB.';
  if (!/\.(pdf|txt|csv)$/i.test(file.name)) return 'Upload a PDF (made by the billing software, not a scan) or a text file.';
  return '';
}

function token() {
  try { return sessionStorage.getItem('reftech_support_token') || localStorage.getItem('reftech_token'); } catch { return localStorage.getItem('reftech_token'); }
}

/** Uploads a document and checks it against a trip. */
export async function checkDocument(tripId: number, kind: string, file: File) {
  const url = import.meta.env.VITE_API_URL;
  if (!url) throw new Error('VITE_API_URL is not configured');
  const form = new FormData();
  form.append('file', file);
  const t = token();
  const res = await fetch(`${url}/api/platform/ask/document-check?tripId=${tripId}&kind=${encodeURIComponent(kind)}`, { method: 'POST', headers: t ? { Authorization: `Bearer ${t}` } : {}, body: form });
  const text = await res.text();
  let b: any = {};
  try { b = text ? JSON.parse(text) : {}; } catch { b = { message: text }; }
  if (!res.ok) throw new Error(b.message || `Check failed (${res.status})`);
  return b;
}
