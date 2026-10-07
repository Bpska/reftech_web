/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- small display pieces that follow the login's Language & Units choices, and re-render when a
// choice changes. The value given is always in the stored unit: °C, tons, km, rupees, an ISO date or moment.
//   <Temp c={-18} />  <TempRange min={2} max={8} />  <Weight t={12.5} />  <Distance km={420} />
//   <Money inr={125000} />  <DateTime at={trip.plannedStartAt} />  <DateOnly at="2026-10-07" />  <Time at={...} />
// In code (strings, CSV, titles) use usePrefsFormat() in a component, or fmtX() from format.ts.
import { InputHTMLAttributes, useEffect, useMemo, useState } from 'react';
import { usePrefs } from './PrefsProvider';
import {
  formatDate, formatDateTime, formatDistance, formatMoney, formatNumber, formatTemp, formatTempRange, formatTime, formatWeight,
  fromInputValue, toInputValue, unitLabel, UnitKind,
} from './format';

type Num = number | string | null | undefined;
type When = string | number | Date | null | undefined;

/** Everything a screen needs to show and read values in the login's units. */
export function usePrefsFormat() {
  const { prefs, t } = usePrefs();
  return useMemo(() => ({
    prefs, t,
    number: (n: Num, d = 2) => formatNumber(n, prefs, d),
    temp: (c: Num) => formatTemp(c, prefs),
    tempRange: (min: Num, max: Num) => formatTempRange(min, max, prefs),
    weight: (tons: Num) => formatWeight(tons, prefs),
    distance: (km: Num) => formatDistance(km, prefs),
    money: (inr: Num) => formatMoney(inr, prefs),
    date: (v: When) => formatDate(v, prefs),
    dateTime: (v: When) => formatDateTime(v, prefs),
    time: (v: When) => formatTime(v, prefs),
    /** "°C"/"°F", "tons"/"kg", "km"/"miles". */
    unit: (kind: UnitKind) => unitLabel(kind, prefs),
    /** Stored value -> text for an input box in the person's unit. */
    shown: (kind: UnitKind, stored: Num) => toInputValue(kind, stored, prefs),
    /** Typed in the person's unit -> stored unit as text (send this). */
    base: (kind: UnitKind, typed: unknown) => fromInputValue(kind, typed, prefs),
  }), [prefs, t]);
}

export function Temp({ c }: { c: Num }) { const f = usePrefsFormat(); return <>{f.temp(c)}</>; }
export function TempRange({ min, max }: { min: Num; max: Num }) { const f = usePrefsFormat(); return <>{f.tempRange(min, max)}</>; }
export function Weight({ t }: { t: Num }) { const f = usePrefsFormat(); return <>{f.weight(t)}</>; }
export function Distance({ km }: { km: Num }) { const f = usePrefsFormat(); return <>{f.distance(km)}</>; }
export function Money({ inr }: { inr: Num }) { const f = usePrefsFormat(); return <>{f.money(inr)}</>; }
export function DateTime({ at }: { at: When }) { const f = usePrefsFormat(); return <>{f.dateTime(at)}</>; }
export function DateOnly({ at }: { at: When }) { const f = usePrefsFormat(); return <>{f.date(at)}</>; }
export function Time({ at }: { at: When }) { const f = usePrefsFormat(); return <>{f.time(at)}</>; }
/** The unit word of the login: <Unit kind="temp" /> -> °C or °F. */
export function Unit({ kind }: { kind: UnitKind }) { const f = usePrefsFormat(); return <>{f.unit(kind)}</>; }

/**
 * A controlled number box for a temperature, weight or distance in the person's unit. `value` is the STORED value
 * (°C / tons / km) and onBase gets the stored value back as text, ready to send. What the person types is kept as
 * typed (so "3." or "-" can be typed), and the box follows a new value given from outside.
 * For an uncontrolled form box (FormData), show unit(kind) in the label, defaultValue={shown(kind, stored)} and
 * send base(kind, typed) (toBase / toShown in format.ts outside a component).
 */
export function UnitInput({ kind, value, onBase, ...rest }: { kind: UnitKind; value: Num; onBase: (stored: string) => void }
  & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const f = usePrefsFormat();
  const [typed, setTyped] = useState(() => f.shown(kind, value));
  const stored = value === null || value === undefined ? '' : String(value);
  useEffect(() => {
    // a new value from outside (reset, loaded record) or a new unit: show it, unless it is what was typed
    if (f.base(kind, typed) !== f.base(kind, f.shown(kind, stored))) setTyped(f.shown(kind, stored));
  }, [stored, f.prefs]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input type="number" step="any" {...rest} value={typed} onChange={e => { setTyped(e.target.value); onBase(f.base(kind, e.target.value)); }} />;
}
