/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- applies the display choices to the whole page: text size (font size of <html>; every Tailwind size
// is in rem, so everything grows), high contrast and reduce motion (classes on <html>, styled in a11y.css) and the
// page language (<html lang>, so screen readers read Hindi and Odia correctly).
import { useEffect } from 'react';
import type { Prefs } from '@/shared/i18n/prefs';

export const HIGH_CONTRAST_CLASS = 'rt-high-contrast';
export const REDUCE_MOTION_CLASS = 'rt-reduce-motion';

/** Pure part (tested): what to put on <html>. */
export function a11yAttributes(p: Pick<Prefs, 'textSize' | 'highContrast' | 'reduceMotion' | 'language'>) {
  const size = ['100', '112', '125'].includes(String(p.textSize)) ? String(p.textSize) : '100';
  return { fontSize: size === '100' ? '' : `${size}%`, highContrast: !!p.highContrast, reduceMotion: !!p.reduceMotion, lang: p.language || 'en' };
}

export function applyA11y(p: Pick<Prefs, 'textSize' | 'highContrast' | 'reduceMotion' | 'language'>, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement) {
  if (!root) return;
  const a = a11yAttributes(p);
  root.style.fontSize = a.fontSize;
  root.classList.toggle(HIGH_CONTRAST_CLASS, a.highContrast);
  root.classList.toggle(REDUCE_MOTION_CLASS, a.reduceMotion);
  root.lang = a.lang;
}

/** Keeps <html> in step with the choices (used by PrefsProvider). */
export function useA11yPrefs(p: Pick<Prefs, 'textSize' | 'highContrast' | 'reduceMotion' | 'language'>) {
  useEffect(() => { applyA11y(p); }, [p.textSize, p.highContrast, p.reduceMotion, p.language]);
}
