/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-002 -- the branding of the signed-in company (name, logo, colours) for the app frame.
// useBranding() reads /api/platform/branding/me once per page load (and when told to reload), sets the CSS variables
// --brand-primary and --brand-accent on <html> (and the rgb forms that drive the header, primary buttons and active
// menu through tailwind.config.js: sky-700, sky-800, frost-950), and gives the name and the full logo address.
// AppShell uses it (see INTEGRATION.md): <BrandMark /> in the header, or its own markup with useBranding().
import { useEffect, useState } from 'react';
import { api } from '@/shared/services/api';

export type Branding = {
  tenantId?: number; tenantCode?: string; tenantName?: string; displayName?: string; primaryColour?: string | null; accentColour?: string | null;
  logoUrl?: string | null; supportEmail?: string | null; supportPhone?: string | null; website?: string | null; supportSession?: boolean;
};

const DEFAULT_PRIMARY = '#0369A1';
const DEFAULT_ACCENT = '#F59E0B';
const EVENT = 'reftech-branding-changed';

let cached: Branding | null = null;
let loading: Promise<Branding | null> | null = null;

/** The full address of a logo (the server gives a path starting with /api/public/...). */
export function brandingAsset(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.VITE_API_URL || ''}${path}`;
}

/** "#0369A1" -> [3, 105, 161]; null for anything else. */
export function hexToRgb(hex?: string | null): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The colour mixed with black: factor 0.8 is 20 % darker. As "r g b" for rgb(var(--x) / alpha). */
export function shade(rgb: [number, number, number], factor: number) {
  return rgb.map(c => Math.max(0, Math.min(255, Math.round(c * factor)))).join(' ');
}

/**
 * REQ-PLT-002: the CSS variables the app's colours are made of (tailwind.config.js): --brand-primary-rgb (primary
 * buttons, active menu, links = sky-700), --brand-primary-dark-rgb (their hover = sky-800), --brand-header-rgb (header
 * and menu = frost-950) and --brand-accent-line (a thin line under the header). Without a company colour the
 * variables are removed and the built-in RefTech colours apply, exactly as before.
 */
export function brandVariables(b: Pick<Branding, 'primaryColour' | 'accentColour'> | null): Record<string, string | null> {
  const p = hexToRgb(b?.primaryColour), a = hexToRgb(b?.accentColour);
  return {
    '--brand-primary': b?.primaryColour || DEFAULT_PRIMARY,
    '--brand-accent': b?.accentColour || DEFAULT_ACCENT,
    '--brand-primary-rgb': p ? p.join(' ') : null,
    '--brand-primary-dark-rgb': p ? shade(p, 0.8) : null,
    '--brand-header-rgb': p ? shade(p, 0.3) : null,
    '--brand-accent-line': a ? `rgb(${a.join(' ')})` : null,
  };
}

function applyColours(b: Branding | null) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(brandVariables(b))) {
    if (v === null) root.style.removeProperty(k); else root.style.setProperty(k, v);
  }
}

function load(force = false): Promise<Branding | null> {
  if (cached && !force) return Promise.resolve(cached);
  if (loading && !force) return loading;
  loading = api('/api/platform/branding/me')
    .then((b: Branding) => { cached = b; applyColours(b); return b; })
    .catch(() => { applyColours(null); return null; })
    .finally(() => { loading = null; });
  return loading;
}

/** Call after the branding was saved: every useBranding() on the page shows the new name, logo and colours. */
export function reloadBranding() {
  cached = null;
  void load(true).then(() => window.dispatchEvent(new Event(EVENT)));
}

/** The branding of the signed-in company; null while loading or when not signed in. */
export function useBranding() {
  const [b, setB] = useState<Branding | null>(cached);
  useEffect(() => {
    let live = true;
    const signedIn = !!(sessionStorage.getItem('reftech_support_token') || localStorage.getItem('reftech_token'));
    if (!signedIn) { applyColours(null); return; }
    load().then(x => { if (live) setB(x); });
    const again = () => { if (live) setB(cached); };
    window.addEventListener(EVENT, again);
    return () => { live = false; window.removeEventListener(EVENT, again); };
  }, []);
  return b ? { ...b, logo: brandingAsset(b.logoUrl), name: b.displayName || b.tenantName || 'RefTech' } : null;
}

/** Logo and name of the company, for the AppShell header. Falls back to the text "RefTech". */
export function BrandMark({ className = '' }: { className?: string }) {
  const b = useBranding();
  const name = b?.name || 'RefTech';
  return <span className={`inline-flex items-center gap-2 ${className}`}>
    {b?.logo && <img src={b.logo} alt={`${name} logo`} className="h-8 w-auto max-w-32 object-contain" />}
    <span className="font-bold" style={{ color: 'var(--brand-primary, #0369A1)' }}>{name}</span>
  </span>;
}
