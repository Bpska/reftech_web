/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-007 / REQ-PLT-015 -- dictionary lookup, fallbacks and completeness of the Hindi and Odia texts.
import { afterEach, describe, expect, it } from 'vitest';
import { EN_TEXTS, MENU_TEXTS } from './en';
import { hi } from './hi';
import { or } from './or';
import { hasTranslation, t, translate } from './i18n';
import { DEFAULT_PREFS, setCurrentPrefs } from './prefs';

describe('translate', () => {
  it('gives the Hindi and Odia text', () => {
    expect(translate('hi', 'Dashboard')).toBe('डैशबोर्ड');
    expect(translate('or', 'Dashboard')).toBe('ଡ୍ୟାସବୋର୍ଡ');
    expect(translate('hi', 'Save')).toBe('सहेजें');
  });
  it('falls back to the English text', () => {
    expect(translate('en', 'Dashboard')).toBe('Dashboard');
    expect(translate('hi', 'A text nobody translated')).toBe('A text nobody translated');
    expect(translate('fr', 'Dashboard')).toBe('Dashboard');
    expect(translate(null, 'Dashboard')).toBe('Dashboard');
    expect(translate('hi', 'constructor')).toBe('constructor');
  });
  it('fills {names}', () => {
    expect(translate('en', 'Page {page} of {pages}', { page: 2, pages: 9 })).toBe('Page 2 of 9');
    expect(translate('hi', 'Page {page} of {pages}', { page: 2, pages: 9 })).toBe('पृष्ठ 2 / 9');
    expect(translate('en', '{from}-{to} of {total}', { from: 1, to: 25 })).toBe('1-25 of {total}');
  });
});

describe('t() follows the language in use', () => {
  afterEach(() => { setCurrentPrefs(DEFAULT_PREFS, false); });
  it('switches at once', () => {
    expect(t('Sign Out')).toBe('Sign Out');
    setCurrentPrefs({ language: 'hi' }, false);
    expect(t('Sign Out')).toBe('साइन आउट');
    setCurrentPrefs({ language: 'or' }, false);
    expect(t('Sign Out')).toBe('ସାଇନ୍ ଆଉଟ୍');
  });
});

describe('dictionaries', () => {
  it('every English text has a Hindi and an Odia text', () => {
    const missing = EN_TEXTS.filter(k => !hasTranslation('hi', k) || !hasTranslation('or', k));
    expect(missing).toEqual([]);
  });
  it('no text is left over or empty', () => {
    expect(Object.keys(hi).filter(k => !EN_TEXTS.includes(k))).toEqual([]);
    expect(Object.keys(or).filter(k => !EN_TEXTS.includes(k))).toEqual([]);
    expect(Object.entries(hi).filter(([, v]) => !v.trim())).toEqual([]);
    expect(Object.entries(or).filter(([, v]) => !v.trim())).toEqual([]);
  });
  it('Hindi is in Devanagari and Odia in Odia script', () => {
    const latinOnly = /^[\x00-\x7F°₹]*$/;
    // a few texts are only codes or numbers in brackets
    const words = (d: Record<string, string>) => Object.values(d).filter(v => latinOnly.test(v.replace(/\{\w+\}/g, '')));
    expect(words(hi)).toEqual([]);
    expect(words(or)).toEqual([]);
    expect(Object.values(hi).every(v => !/[\u0B00-\u0B7F]/.test(v))).toBe(true);
    // the danda (U+0964, U+0965) is shared by both scripts
    expect(Object.values(or).every(v => !/[\u0900-\u0963\u0966-\u097F]/.test(v))).toBe(true);
  });
  it('placeholders are kept', () => {
    for (const k of EN_TEXTS.filter(x => x.includes('{'))) {
      const names = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join();
      expect(names(hi[k])).toBe(names(k));
      expect(names(or[k])).toBe(names(k));
    }
  });
  it('covers the main menu', () => {
    for (const k of ['Dashboard', 'Temperature Alerts', 'HR', 'Add Employee / Driver', 'Billing', 'Change Password', 'Sign Out']) expect(MENU_TEXTS).toContain(k);
  });
});
