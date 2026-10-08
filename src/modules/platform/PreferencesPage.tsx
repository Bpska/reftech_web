/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- Language & Units (/platform/preferences): my own choices (every login) and the company defaults
// (Admin). The sample row shows at once how a weight, a temperature, a distance, a date and an amount will look.
// The language switch takes effect at once (and is saved). Backend: /api/platform/preferences (PreferencesController).
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, input, label, td, th } from '@/shared/components/FormKit';
import { Tabs } from '@/modules/hr/hr';
import { usePrefs } from '@/shared/i18n/PrefsProvider';
import { formatDate, formatDateTime, formatDistance, formatMoney, formatNumber, formatTemp, formatWeight } from '@/shared/i18n/format';
import { DEFAULT_PREFS, LANGUAGE_NAMES, normalizePrefs, Prefs, ZONES } from '@/shared/i18n/prefs';
import { PageTitle, ScriptMissing, usePlatform } from './platform';

type Draft = Partial<Record<keyof Prefs, string>>;
type Answer = { ready: boolean; message?: string; values: any; company: any; personal: any; options?: Record<string, string[]>; canEdit?: boolean };

const SAMPLE = { tons: 12.5, celsius: -18, km: 1234.56, rupees: 125000, day: '2026-10-07', moment: '2026-10-07T14:30:00Z' };

/** Choices as text for the form ("" = use the company default on the personal tab). */
const asDraft = (p: any): Draft => Object.fromEntries(Object.entries(p || {}).map(([k, v]) => [k, String(v)])) as Draft;

export function PreferencesPage() {
  const status = usePlatform();
  const { t, setPrefs, reload } = usePrefs();
  const [tab, setTab] = useState<'mine' | 'company'>('mine');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  async function load(which = tab) {
    setErr('');
    try {
      const x: Answer = await api(which === 'company' ? '/api/platform/preferences/company' : '/api/platform/preferences');
      setAnswer(x);
      setDraft(asDraft(which === 'company' ? x.company : x.personal));
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { void load(tab); setMsg(''); }, [tab]);

  const company = normalizePrefs(answer?.company || DEFAULT_PREFS);
  // What the sample row shows: the draft over the company default (personal tab) or over the built-in default.
  const shown = useMemo(() => normalizePrefs(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '')), tab === 'mine' ? company : DEFAULT_PREFS),
    [JSON.stringify(draft), JSON.stringify(company), tab]);
  const ready = !!answer?.ready;
  const admin = !!status?.admin && !status?.supportSession;
  const canEdit = ready && (tab === 'mine' || admin);
  const options = (k: string, fallback: readonly string[]) => answer?.options?.[k] || fallback;

  async function save(body: Draft, done?: string) {
    setBusy(true); setMsg(''); setErr('');
    try {
      const x: Answer = await api(tab === 'company' ? '/api/platform/preferences/company' : '/api/platform/preferences', { method: 'PUT', body: JSON.stringify(body) });
      setAnswer(x);
      setDraft(asDraft(tab === 'company' ? x.company : x.personal));
      setPrefs(normalizePrefs(x.values));
      setMsg(done || t('Saved. The screens use your new choices now.'));
    } catch (e: any) { setErr(e.message || t('Not saved')); }
    finally { setBusy(false); }
  }

  function changeLanguage(v: string) {
    setDraft(d => ({ ...d, language: v }));
    if (tab !== 'mine') return;
    // REQ-PLT-015: the language switch takes effect at once, and is saved when script 60 is there.
    setPrefs({ language: (v || company.language) as Prefs['language'] });
    if (ready) void save({ language: v }, t('Saved'));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save(draft);
  }

  const set = (k: keyof Prefs) => (e: { target: { value: string } }) => setDraft(d => ({ ...d, [k]: e.target.value }));
  const def = tab === 'mine' ? <option value="">{t('Use the company default')}</option> : null;
  const companyHint = (k: keyof Prefs, text: (v: string) => string) => tab === 'mine' && (draft[k] ?? '') === ''
    ? <div className="mt-0.5 text-xs text-slate-600">{t('Company default: {value}', { value: text(String(company[k])) })}</div> : null;

  const langText = (v: string) => LANGUAGE_NAMES[v as Prefs['language']] || v;
  const weightText = (v: string) => (v === 'KG' ? t('Kilograms') : t('Tons'));
  const tempText = (v: string) => (v === 'F' ? t('Fahrenheit (°F)') : t('Celsius (°C)'));
  const distText = (v: string) => (v === 'MI' ? t('Miles') : t('Kilometres'));
  const moneyText = (v: string) => (v === 'CODE' ? t('Code (INR)') : t('Symbol (₹)'));
  const groupText = (v: string) => (v === 'INTERNATIONAL' ? t('International (100,000)') : t('Indian (1,00,000)'));
  const sizeText = (v: string) => `${v === '125' ? t('Larger') : v === '112' ? t('Large') : t('Normal')} (${v}%)`;
  const onOff = (v: string) => (v === 'true' ? t('On') : t('Off'));
  const dateText = (v: string) => `${v} (${formatDate(SAMPLE.day, { dateFormat: v as Prefs['dateFormat'], timeZone: 'UTC' })})`;

  const field = (k: keyof Prefs, title: string, values: readonly string[], text: (v: string) => string, onChange = set(k)) => {
    const id = `pref-${tab}-${k}`;
    return <div>
      <label htmlFor={id} className={label}>{title}</label>
      <select id={id} className={input} value={draft[k] ?? ''} onChange={onChange} disabled={!canEdit || busy}>
        {def}{tab === 'company' && (draft[k] ?? '') === '' && <option value="">{text(String((DEFAULT_PREFS as any)[k]))}</option>}
        {values.map(v => <option key={v} value={v}>{text(v)}</option>)}
      </select>
      {companyHint(k, text)}
    </div>;
  };

  if (status && !status.ready) return <><PageTitle icon={<Languages aria-hidden />} title={t('Language & Units')} /><ScriptMissing /></>;

  return <>
    <PageTitle icon={<Languages aria-hidden />} title={t('Language & Units')}>{t('Choose your language, time zone, units and display.')}</PageTitle>
    <Tabs value={tab} onChange={v => setTab(v as 'mine' | 'company')} tabs={[['mine', t('My choices')], ['company', t('Company defaults')]]} />
    {answer && !answer.ready && <div role="status" className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">{t('Your choices cannot be saved until the database script is run. The screens use the standard settings.')}</div>}
    <div aria-live="polite"><Banner msg={msg} /></div>
    {err && <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    <p className="mt-3 text-slate-700">{tab === 'mine' ? t('Your own choices. Choose "Use the company default" to follow the company.') : t('Defaults for everyone in the company. Each person can change them for themselves.')}</p>
    {tab === 'company' && !admin && <p className="mt-1 font-semibold text-amber-800">{t('Only an Admin can change the company defaults.')}</p>}

    <form onSubmit={submit}>
      <Section title={t('Language, time and units')}>
        <div className="grid gap-3 md:grid-cols-3">
          {field('language', t('Language'), options('language', ['en', 'hi', 'or']), langText, e => changeLanguage(e.target.value))}
          {field('timeZone', t('Time zone'), Array.from(new Set([...options('timeZone', ZONES), ...(draft.timeZone ? [draft.timeZone] : [])])), v => v)}
          {field('dateFormat', t('Date format'), options('dateFormat', ['DD-MM-YYYY', 'YYYY-MM-DD', 'DD MMM YYYY']), dateText)}
          {field('weightUnit', t('Weight'), options('weightUnit', ['TON', 'KG']), weightText)}
          {field('temperatureUnit', t('Temperature'), options('temperatureUnit', ['C', 'F']), tempText)}
          {field('distanceUnit', t('Distance'), options('distanceUnit', ['KM', 'MI']), distText)}
          {field('currency', t('Currency'), options('currency', ['INR']), () => t('Indian Rupee (INR)'))}
          {field('currencyDisplay', t('Show money as'), options('currencyDisplay', ['SYMBOL', 'CODE']), moneyText)}
          {field('numberGrouping', t('Number grouping'), options('numberGrouping', ['INDIAN', 'INTERNATIONAL']), groupText)}
        </div>
        <p className="mt-3 text-sm text-slate-600">{t('Amounts are kept in rupees. Only the way they are shown changes.')} {t('Weights, temperatures and distances are kept in tons, °C and km. Only the screen converts them.')}</p>
        {tab === 'mine' && <p className="mt-1 text-sm text-slate-600">{t('The language changes at once and is saved.')}</p>}
      </Section>

      <Section title={t('Display and accessibility')}>
        <p className="mb-3 text-sm text-slate-600">{t('Bigger text, stronger borders and less movement on the screen.')}</p>
        <div className="grid gap-3 md:grid-cols-3">
          {field('textSize', t('Text size'), options('textSize', ['100', '112', '125']), sizeText)}
          {field('highContrast', t('High contrast'), ['false', 'true'], onOff)}
          {field('reduceMotion', t('Reduce motion'), ['false', 'true'], onOff)}
        </div>
      </Section>

      <Section title={t('Preview')}>
        <table className="w-full text-sm">
          <caption className="mb-2 text-left text-slate-600">{t('Sample row in your units')}</caption>
          <thead><tr className="bg-slate-50">
            <th scope="col" className={th}>{t('Weight')}</th><th scope="col" className={th}>{t('Temperature')}</th><th scope="col" className={th}>{t('Distance')}</th>
            <th scope="col" className={th}>{t('Date')}</th><th scope="col" className={th}>{t('Date and time')}</th><th scope="col" className={th}>{t('Amount')}</th><th scope="col" className={th}>{t('Number')}</th>
          </tr></thead>
          <tbody><tr className="border-t">
            <td className={td}>{formatWeight(SAMPLE.tons, shown)}</td>
            <td className={td}>{formatTemp(SAMPLE.celsius, shown)}</td>
            <td className={td}>{formatDistance(SAMPLE.km, shown)}</td>
            <td className={td}>{formatDate(SAMPLE.day, shown)}</td>
            <td className={td}>{formatDateTime(SAMPLE.moment, shown)} <span className="text-xs text-slate-600">({shown.timeZone})</span></td>
            <td className={td}>{formatMoney(SAMPLE.rupees, shown)}</td>
            <td className={td}>{formatNumber(12345678, shown, 0)}</td>
          </tr></tbody>
        </table>
      </Section>

      {canEdit && <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={busy} className={btn}>{t('Save')}</button>
        <button type="button" disabled={busy} className={btnLight} onClick={() => { setMsg(''); setErr(''); void load(tab); void reload(); }}>{t('Cancel')}</button>
      </div>}
    </form>
  </>;
}
