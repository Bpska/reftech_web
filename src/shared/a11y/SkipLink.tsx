/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- "Skip to main content": the first thing the Tab key reaches. Hidden until it has the keyboard focus;
// Enter moves the focus to the page content (the element with id="main"), past the menu.
import { MouseEvent } from 'react';
import { usePrefs } from '@/shared/i18n/PrefsProvider';

export function SkipLink({ target = 'main' }: { target?: string }) {
  const { t } = usePrefs();
  function go(e: MouseEvent<HTMLAnchorElement>) {
    const el = document.getElementById(target);
    if (!el) return;
    e.preventDefault();
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus();
    el.scrollIntoView({ block: 'start' });
  }
  return <a href={`#${target}`} onClick={go}
    className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1000] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-bold focus:text-sky-900 focus:shadow-lg">
    {t('Skip to main content')}
  </a>;
}
