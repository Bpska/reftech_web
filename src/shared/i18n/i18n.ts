/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- translation. The key is the English text itself: t('Dashboard') gives 'डैशबोर्ड' in Hindi and
// 'Dashboard' in English or when a translation is missing. {name} in a text is filled from vars:
// t('Page {page} of {pages}', { page: 2, pages: 9 }).
import { hi } from './hi';
import { or } from './or';
import { currentPrefs, Lang } from './prefs';

const DICTIONARIES: Record<Lang, Record<string, string>> = { en: {}, hi, or };

export type Vars = Record<string, string | number | null | undefined>;

/** The text in the language, else the English text. Pure: used by t() and by the tests. */
export function translate(lang: string | null | undefined, text: string, vars?: Vars): string {
  if (text === null || text === undefined) return '';
  const dict = DICTIONARIES[(lang || 'en') as Lang] || {};
  const found = Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : undefined;
  return fill(found && found.length ? found : text, vars);
}

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (all, k) => (vars[k] === undefined || vars[k] === null ? all : String(vars[k])));
}

/** True when the language has its own text for this English text. */
export function hasTranslation(lang: string, text: string) {
  const dict = DICTIONARIES[lang as Lang];
  return !!dict && Object.prototype.hasOwnProperty.call(dict, text);
}

/** The text in the language of the login now. In a component use `const { t } = usePrefs()` so it re-renders on a change. */
export function t(text: string, vars?: Vars): string { return translate(currentPrefs().language, text, vars); }

/** "IN_TRANSIT" or "in transit" -> "In transit", the form the status words are kept in (en.ts STATUS_TEXTS). */
export function statusWords(code: string): string {
  const s = String(code ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/**
 * A status code in the login's language. In English the code is shown as it is (screens keep their look); in
 * Hindi or Odia a known status word is translated, and an unknown one is shown as it is.
 */
export function translateStatus(lang: string | null | undefined, code: unknown): string {
  if (code === null || code === undefined) return '';
  const raw = String(code);
  if (!lang || lang === 'en') return raw;
  const words = statusWords(raw);
  return hasTranslation(lang, words) ? translate(lang, words) : raw;
}

/** A status code in the language of the login now. */
export function statusText(code: unknown): string { return translateStatus(currentPrefs().language, code); }
