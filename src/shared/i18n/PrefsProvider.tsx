/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- the language, units and display choices for the whole portal.
// <PrefsProvider> (in App.tsx, around the routes) loads GET /api/platform/preferences once after sign-in and again
// when another login signs in; the last answer is kept in localStorage so the first paint is already right.
// Components use `const { t, prefs, fmt } = usePrefs()` and re-render when a choice changes.
// Before script 60 the server answers the standard choices (English, Asia/Kolkata, tons, °C, km, rupees).
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/shared/services/api';
import { useA11yPrefs } from '@/shared/a11y/useA11yPrefs';
import '@/shared/a11y/a11y.css';
import { translate, Vars } from './i18n';
import { formatDate, formatDateTime, formatDistance, formatMoney, formatNumber, formatTemp, formatWeight } from './format';
import { currentPrefs, normalizePrefs, onPrefsChange, Prefs, readCachedPrefs, setCurrentPrefs } from './prefs';

type Num = number | string | null | undefined;
type When = string | number | Date | null | undefined;

export type PrefsContextValue = {
  prefs: Prefs;
  /** false until script 60 is run (choices cannot be saved yet) or while not signed in. */
  ready: boolean;
  t: (text: string, vars?: Vars) => string;
  fmt: {
    number: (n: Num, decimals?: number) => string; weight: (tons: Num) => string; temp: (celsius: Num) => string;
    distance: (km: Num) => string; money: (rupees: Num) => string; date: (v: When) => string; dateTime: (v: When) => string;
  };
  /** Use these choices now (e.g. after a save, or the language switch). */
  setPrefs: (p: Partial<Prefs>) => void;
  /** Ask the server again. */
  reload: () => Promise<void>;
};

function valueFor(prefs: Prefs, ready: boolean, setPrefs: (p: Partial<Prefs>) => void, reload: () => Promise<void>): PrefsContextValue {
  return {
    prefs, ready, setPrefs, reload,
    t: (text, vars) => translate(prefs.language, text, vars),
    fmt: {
      number: (n, d = 2) => formatNumber(n, prefs, d), weight: v => formatWeight(v, prefs), temp: v => formatTemp(v, prefs),
      distance: v => formatDistance(v, prefs), money: v => formatMoney(v, prefs), date: v => formatDate(v, prefs), dateTime: v => formatDateTime(v, prefs),
    },
  };
}

// Without a provider (tests, a page outside App) the hook still works with the choices in use now.
const PrefsContext = createContext<PrefsContextValue | null>(null);

const token = () => { try { return localStorage.getItem('reftech_token'); } catch { return null; } };

// The cached choices are put in use when this file loads, before the first paint.
const cached = readCachedPrefs();
if (cached) setCurrentPrefs(cached, false);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(currentPrefs());
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState<string | null>(token());

  useEffect(() => onPrefsChange(p => setState(p)), []);

  const reload = useCallback(async () => {
    if (!token()) return;
    try {
      const x = await api('/api/platform/preferences');
      setReady(!!x?.ready);
      setCurrentPrefs(normalizePrefs(x?.values));
    } catch { /* offline or an older server: keep what we have */ }
  }, []);

  // Once after sign-in, and again when the login changes (the sign-in page stores a new token).
  useEffect(() => { if (signedIn) void reload(); }, [signedIn, reload]);
  useEffect(() => {
    const look = () => setSignedIn(token());
    const id = window.setInterval(look, 2000);
    window.addEventListener('storage', look);
    window.addEventListener('focus', look);
    return () => { window.clearInterval(id); window.removeEventListener('storage', look); window.removeEventListener('focus', look); };
  }, []);

  useA11yPrefs(prefs);
  const setPrefs = useCallback((p: Partial<Prefs>) => { setCurrentPrefs(p); }, []);
  const value = useMemo(() => valueFor(prefs, ready, setPrefs, reload), [prefs, ready, setPrefs, reload]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  const [p, setP] = useState(currentPrefs());
  useEffect(() => (ctx ? undefined : onPrefsChange(setP)), [ctx]);
  return ctx ?? valueFor(p, false, x => { setCurrentPrefs(x); }, async () => { });
}
