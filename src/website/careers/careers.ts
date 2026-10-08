/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-010 -- the public Careers page talks to /api/public/careers (no login, no token sent).

export type Opening = {
  id: number; code: string; title: string; department?: string | null; location: string; employmentType: string; openings: number;
  experienceMin?: number | null; experienceMax?: number | null; salaryText?: string | null; summary?: string | null;
  closesOn?: string | null; publishedAt?: string | null; description?: string; requirements?: string | null;
  formToken?: string; resumeMaxMb?: number;
};

export const TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACT: 'Contract', INTERNSHIP: 'Internship', TEMPORARY: 'Temporary',
};

export const RESUME_TYPES = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function base() {
  const url = import.meta.env.VITE_API_URL;
  if (!url) throw new Error('VITE_API_URL is not configured');
  return url;
}

async function read(response: Response) {
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error((body as { message?: string })?.message || `Request failed (${response.status})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the caller says what it expects
  return body as any;
}

export async function listOpenings(): Promise<Opening[]> {
  const x = await read(await fetch(`${base()}/api/public/careers/openings`));
  return Array.isArray(x) ? x : [];
}

export async function getOpening(id: string | number): Promise<Opening> {
  return read(await fetch(`${base()}/api/public/careers/openings/${encodeURIComponent(String(id))}`));
}

export async function apply(id: number, form: FormData): Promise<{ reference: string; title: string; message: string }> {
  return read(await fetch(`${base()}/api/public/careers/openings/${id}/apply`, { method: 'POST', body: form }));
}

/** "2-10 years", "From 3 years", "Up to 4 years", "Freshers welcome" ... */
export function experienceText(min?: number | null, max?: number | null) {
  const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));
  const a = n(min), b = n(max);
  const y = (v: number) => `${v % 1 === 0 ? v.toFixed(0) : v} year${v === 1 ? '' : 's'}`;
  if (a === null && b === null) return '';
  if (a !== null && b !== null) return a === b ? y(a) : `${a % 1 === 0 ? a.toFixed(0) : a}-${y(b)}`;
  if (a !== null) return a === 0 ? 'Freshers welcome' : `From ${y(a)}`;
  return `Up to ${y(b as number)}`;
}

/** The resume checks the server also makes, so the candidate hears at once. Returns an error message or ''. */
export function resumeProblem(file: File | null | undefined, maxMb = 5) {
  if (!file || file.size === 0) return 'Please attach your resume (PDF, DOC or DOCX).';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'doc', 'docx'].includes(ext)) return 'The resume must be a PDF, DOC or DOCX file.';
  if (file.size > maxMb * 1024 * 1024) return `The resume must be ${maxMb} MB or smaller.`;
  return '';
}

/** Splits the text HR typed into paragraphs and bullet lists (lines starting with -, * or •). */
export function blocks(text?: string | null): { list: boolean; lines: string[] }[] {
  const out: { list: boolean; lines: string[] }[] = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { out.push({ list: false, lines: [] }); continue; }
    const bullet = /^[-*•]\s+/.test(line);
    const last = out[out.length - 1];
    const clean = line.replace(/^[-*•]\s+/, '');
    if (last && last.list === bullet && last.lines.length) last.lines.push(clean);
    else out.push({ list: bullet, lines: [clean] });
  }
  return out.filter(b => b.lines.length);
}
