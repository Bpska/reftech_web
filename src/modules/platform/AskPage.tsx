/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-017 -- Ask (/ask): questions in plain words, typed or spoken (the browser's own speech recognition, Indian
// English or Hindi), answered with a sentence, a chart, the rows and the steps used. Only the kinds of question of
// a fixed list can be answered, each with its own read-only query; the answer covers only what the login may see
// (a partner: its own company). Every question is logged. A document (invoice, proof of delivery) can be uploaded
// and checked against a trip. Staff need ASK_QUESTIONS. Backend: /api/platform/ask/** (com.reftech.core.platform.ask).
import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Mic, MicOff, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { BarChart } from '@/modules/platform/charts';
import { post, useRunner, when } from '@/modules/cnf/cnf';
import { Grid, Pill } from '@/modules/cnf/CnfKit';
import { ASK_SCRIPT, AskLang, cell, chartOf, checkDocument, columnTitle, docProblem, recogniser, speechLang } from './ask';

export function AskPage() {
  const r = useRunner();
  const [status, setStatus] = useState<any>(null);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState<AskLang>('en');
  const [listening, setListening] = useState(false);
  const [answer, setAnswer] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [n, setN] = useState(0);
  const rec = useRef<any>(null);
  const spoken = useRef(false);

  useEffect(() => { api('/api/platform/ask/status').then(setStatus).catch(x => r.setError((x as Error).message)); }, []);
  useEffect(() => { if (status?.ready) api('/api/platform/ask/history?limit=20').then(x => setHistory(x.questions || [])).catch(() => {}); }, [status, n]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    r.run(() => api(`/api/platform/ask/answer?question=${encodeURIComponent(text.trim())}&spoken=${spoken.current}`)).then(x => { if (x) { setAnswer(x); setN(v => v + 1); } spoken.current = false; });
  };
  const listen = () => {
    if (listening) { rec.current?.stop(); return; }
    const s = recogniser();
    if (!s) { r.setError('This browser cannot listen. Use Chrome or Edge, or type the question.'); return; }
    s.lang = speechLang(lang); s.interimResults = false; s.maxAlternatives = 1;
    s.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript || ''; setQ(t); spoken.current = true; ask(t); };
    s.onerror = () => setListening(false);
    s.onend = () => setListening(false);
    rec.current = s; setListening(true); s.start();
  };

  if (status?.ready === false) return <NotReady script={status.script || ASK_SCRIPT} />;
  const chart = answer ? chartOf(answer) : null;
  return <div>
    <h1 className="flex items-center gap-2 text-2xl font-bold"><MessageCircleQuestion className="h-7 w-7 text-sky-700" />Ask</h1>
    <p className="mt-1 text-sm text-slate-600">Ask about trips, delays, fuel, cost per km, temperature alerts, loads, stock, billing, energy or carbon, in English or Hindi. {status?.partner ? 'Answers cover only your own company.' : 'Answers cover only what your role may see.'}</p>
    <Banner msg="" error={r.error} />
    <Section title="Your question">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); spoken.current = false; ask(q); }} className="flex flex-col gap-2 md:flex-row">
        <input className={`${input} flex-1 text-lg`} value={q} onChange={e => setQ(e.target.value)} maxLength={300} placeholder={lang === 'hi' ? 'जैसे: पिछले हफ्ते कितनी ट्रिप लेट हुईं?' : 'e.g. How many trips were late last week?'} aria-label="Question" />
        <select className={`${input} md:w-36`} value={lang} onChange={e => setLang(e.target.value as AskLang)} aria-label="Speech language"><option value="en">English</option><option value="hi">हिन्दी</option></select>
        <button type="button" className={btnLight} onClick={listen} title="Speak the question" aria-pressed={listening}>{listening ? <MicOff className="h-5 w-5 text-red-600" /> : <Mic className="h-5 w-5" />}</button>
        <button className={btn} disabled={r.busy}>{r.busy ? 'Working…' : 'Ask'}</button>
      </form>
      {listening && <p className="mt-2 text-sm text-red-700">Listening… speak now.</p>}
      {(status?.catalogue || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">
        {status.catalogue.map((c: any) => <button key={c.id} type="button" className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-sky-50"
          onClick={() => { const t = lang === 'hi' ? c.exampleHi : c.exampleEn; setQ(t); ask(t); }} title={lang === 'hi' ? c.titleHi : c.titleEn}>{lang === 'hi' ? c.exampleHi : c.exampleEn}</button>)}
      </div>}
    </Section>

    {answer && <Section title={<>{answer.title || 'Answer'} <Pill s={answer.status} /></>} right={answer.logId ? <Feedback id={answer.logId} r={r} /> : null}>
      <p className="text-lg font-semibold text-slate-900">{answer.text}</p>
      {chart && <div className="mt-4"><BarChart title={chart.title} labels={chart.labels} series={chart.series} /></div>}
      {(answer.rows || []).length > 0 && <div className="mt-4"><Grid rows={answer.rows} empty="" cols={(answer.columns || []).map((k: string) => ({ key: k, title: columnTitle(k), render: (x: any) => cell(x[k]) }))} />
        {answer.rowCount > answer.rows.length && <p className="mt-1 text-xs text-slate-500">The first {answer.rows.length} of {answer.rowCount} rows.</p>}</div>}
      <details className="mt-4" open={answer.status !== 'ANSWERED'}><summary className="cursor-pointer text-sm font-semibold text-sky-800">How this was worked out</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-slate-700">{(answer.steps || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
        {answer.params && Object.keys(answer.params).length > 0 && <p className="mt-2 text-xs text-slate-500">Values understood: {Object.entries(answer.params).map(([k, v]) => `${k} = ${v}`).join('; ')}</p>}
        <p className="mt-1 text-xs text-slate-500">Engine {answer.engine} · {answer.durationMs} ms</p>
      </details>
      {answer.status !== 'ANSWERED' && (answer.examples || []).length > 0 && <p className="mt-3 text-sm text-slate-600">Questions I can answer: {(answer.examples || []).map((x: any) => (lang === 'hi' ? x.titleHi : x.titleEn)).join(', ')}.</p>}
    </Section>}

    <DocumentCheck r={r} />

    <Section title="My recent questions">
      <Grid rows={history} empty="No question yet." onRow={x => { setQ(x.question); }} cols={[
        { key: 'createdAt', title: 'When', render: x => when(x.createdAt) }, { key: 'question', title: 'Question' }, { key: 'status', title: 'Result', render: x => <Pill s={x.status} /> },
        { key: 'answerText', title: 'Answer' }, { key: 'helpful', title: 'Helpful', render: x => (x.helpful === true ? 'Yes' : x.helpful === false ? 'No' : '') },
      ]} />
    </Section>
  </div>;
}

function Feedback({ id, r }: { id: number; r: ReturnType<typeof useRunner> }) {
  const [sent, setSent] = useState<boolean | null>(null);
  useEffect(() => setSent(null), [id]);
  const send = (helpful: boolean) => r.run(() => post(`/api/platform/ask/${id}/feedback`, { helpful })).then(x => x && setSent(helpful));
  if (sent !== null) return <span className="text-sm text-slate-600">Thank you for the feedback.</span>;
  return <div className="flex items-center gap-1 text-sm text-slate-600">Helpful?
    <button className={btnLight} onClick={() => send(true)} aria-label="Helpful"><ThumbsUp className="h-4 w-4" /></button>
    <button className={btnLight} onClick={() => send(false)} aria-label="Not helpful"><ThumbsDown className="h-4 w-4" /></button></div>;
}

function DocumentCheck({ r }: { r: ReturnType<typeof useRunner> }) {
  const [search, setSearch] = useState('');
  const [trips, setTrips] = useState<any[]>([]);
  const [tripId, setTripId] = useState('');
  const [kind, setKind] = useState('INVOICE');
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<any>(null);
  const [checks, setChecks] = useState<any[]>([]);
  const [n, setN] = useState(0);
  useEffect(() => { api(`/api/platform/ask/trips?q=${encodeURIComponent(search)}`).then(x => setTrips(x.trips || [])).catch(() => setTrips([])); }, [search]);
  useEffect(() => { api('/api/platform/ask/document-checks').then(x => setChecks(x.checks || [])).catch(() => {}); }, [n]);
  const run = () => {
    const p = docProblem(file);
    if (p) { r.setError(p); return; }
    r.run(() => checkDocument(Number(tripId), kind, file as File)).then(x => { if (x) { setRes(x); setN(v => v + 1); } });
  };
  return <Section title="Check a document against a trip">
    <p className="mb-2 text-sm text-slate-600">Upload an invoice or proof of delivery (PDF made by software, or a text file). The truck number, LR or trip number, amounts and dates in it are compared with the trip. Scanned images cannot be read yet.</p>
    <div className="grid gap-3 md:grid-cols-4">
      <label className="text-sm"><span className={label}>Find trip</span><input className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Trip number" /></label>
      <label className="text-sm"><span className={label}>Trip</span><select className={input} value={tripId} onChange={e => setTripId(e.target.value)}>
        <option value="">Choose</option>{trips.map(t => <option key={t.id} value={t.id}>{t.tripNumber} {t.sourceCity} - {t.destinationCity}</option>)}</select></label>
      <label className="text-sm"><span className={label}>Document</span><select className={input} value={kind} onChange={e => setKind(e.target.value)}>
        <option value="INVOICE">Invoice</option><option value="PROOF">Proof of delivery</option><option value="OTHER">Other</option></select></label>
      <label className="text-sm"><span className={label}>File</span><input className={input} type="file" accept=".pdf,.txt,.csv,application/pdf,text/plain" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
    </div>
    <button className={`${btn} mt-3`} disabled={r.busy || !tripId || !file} onClick={run}>Check document</button>
    {res && <div className={`mt-4 rounded-xl p-3 ${res.result === 'MATCH' ? 'bg-emerald-50' : res.result === 'MISMATCH' ? 'bg-red-50' : 'bg-amber-50'}`}>
      <p className="font-bold">{res.tripNumber}: <Pill s={res.result} /></p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">{(res.findings || []).map((f: string, i: number) => <li key={i}>{f}</li>)}</ul>
    </div>}
    {checks.length > 0 && <div className="mt-4"><Grid rows={checks} empty="" cols={[
      { key: 'createdAt', title: 'When', render: x => when(x.createdAt) }, { key: 'tripNumber', title: 'Trip' }, { key: 'fileName', title: 'File' },
      { key: 'docKind', title: 'Kind' }, { key: 'result', title: 'Result', render: x => <Pill s={x.result} /> }, { key: 'userName', title: 'By' },
    ]} /></div>}
  </Section>;
}
