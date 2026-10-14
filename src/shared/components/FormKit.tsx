/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-006 .. 011, REQ-TAL-001, 002 -- small building blocks the warehouse and transporter screens share:
// the style classes, a form built from a list of fields, the message banner, the "run script NN" notice and a scan box.
// REQ-PLT-015: a field with `unit` ('temp' | 'weight' | 'distance') is shown and typed in the login's unit and sent
// in the stored unit (°C, tons, km); the buttons follow the login's language.
import { FormEvent, ReactNode, useEffect, useRef } from 'react';
import { t, toBase, toShown, unitNow, UnitKind } from '@/shared/i18n';

export const input = 'ui-input w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
export const label = 'ui-label mb-1 block text-sm font-semibold text-slate-700';
export const btn = 'ui-button ui-button-primary rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-50';
export const btnLight = 'ui-button ui-button-secondary rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const btnRed = 'ui-button ui-button-danger rounded-xl border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50';
export const th = 'px-2.5 py-2 text-left font-semibold';
export const td = 'px-2.5 py-2 align-top';
export const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);

export type Field = {
  name: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  options?: [string | number, string][]; required?: boolean; step?: string; placeholder?: string; wide?: boolean; hint?: string;
  /** The value is stored in °C / tons / km and shown and typed in the login's unit (REQ-PLT-015). */
  unit?: UnitKind;
};

/** Reads a form built by QuickForm into a plain object; a checkbox gives true or false. */
export function formValues(form: HTMLFormElement, fields: Field[]) {
  const f = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const x of fields) out[x.name] = x.type === 'checkbox' ? f.get(x.name) === 'on' : x.unit ? toBase(x.unit, f.get(x.name)) : f.get(x.name);
  return out;
}

export function QuickForm({ fields, initial, onSubmit, submitText, onCancel, busy, cols = 3 }: {
  fields: Field[]; initial?: Record<string, any>; onSubmit: (values: Record<string, unknown>, form: HTMLFormElement) => void | Promise<unknown>;
  submitText: string; onCancel?: () => void; busy?: boolean; cols?: 2 | 3 | 4;
}) {
  const grid = cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3';
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSubmit(formValues(e.currentTarget, fields), e.currentTarget);
  }
  const value = (n: string) => (initial && initial[n] !== null && initial[n] !== undefined ? String(initial[n]) : undefined);
  const shown = (x: Field) => (x.unit ? toShown(x.unit, value(x.name)) || undefined : value(x.name));
  return <form onSubmit={submit} className={`grid gap-3 ${grid}`}>
    {fields.map(x => <div key={x.name} className={x.wide ? 'md:col-span-full' : ''}>
      {x.type === 'checkbox'
        ? <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name={x.name} defaultChecked={Boolean(initial?.[x.name])} className="h-4 w-4" />{x.label}
          </label>
        : <>
          <label className={label}>{x.label}{x.unit && ` (${unitNow(x.unit)})`}{x.required && <span className="text-red-600"> *</span>}</label>
          {x.type === 'select'
            ? <select name={x.name} defaultValue={value(x.name) ?? ''} required={x.required} className={input}>
                {!x.required && <option value="">-</option>}
                {x.options?.map(([v, t]) => <option key={String(v)} value={v}>{t}</option>)}
              </select>
            : x.type === 'textarea'
              ? <textarea name={x.name} defaultValue={value(x.name)} rows={2} placeholder={x.placeholder} className={input} />
              : <input name={x.name} type={x.type || 'text'} step={x.unit ? 'any' : x.step ?? (x.type === 'number' ? 'any' : undefined)} defaultValue={shown(x)?.slice(0, x.type === 'date' ? 10 : undefined)}
                  required={x.required} placeholder={x.placeholder} className={input} />}
        </>}
      {x.hint && <div className="mt-0.5 text-xs text-slate-500">{x.hint}</div>}
    </div>)}
    <div className="flex items-end gap-2 md:col-span-full">
      <button disabled={busy} className={btn}>{submitText}</button>
      {onCancel && <button type="button" onClick={onCancel} className={btnLight}>{t('Cancel')}</button>}
    </div>
  </form>;
}

export function Banner({ msg, error }: { msg?: string; error?: string }) {
  return <>
    {msg && <div role="status" className="ui-notice my-3 whitespace-pre-line rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {error && <div role="alert" className="ui-notice my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{error}</div>}
  </>;
}

/** Shown while the database script of the module has not been run yet. */
export function NotReady({ script }: { script: string }) {
  return <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">
    {t('This screen needs the database script')} <b>{script}</b>. {t('Ask the administrator to run it on reftech_operational, then reload.')}
  </div>;
}

/**
 * A text box for a handheld barcode scanner (it types the code and presses Enter) or for typing by hand.
 * onScan gets the trimmed text; the box clears and keeps the focus for the next scan.
 */
export function ScanBox({ placeholder, onScan, autoFocus, disabled }: { placeholder: string; onScan: (code: string) => void; autoFocus?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return <input ref={ref} disabled={disabled} placeholder={placeholder}
    className={`${input} font-mono text-lg tracking-wide`}
    onKeyDown={e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.currentTarget.value.trim();
      if (v) onScan(v);
      e.currentTarget.value = '';
    }} />;
}

export function Section({ id, title, right, children }: { id?: string; title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return <section id={id} className="ui-panel mt-5 rounded-2xl bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{title}</h2>{right}</div>
    <div className="mt-3">{children}</div>
  </section>;
}

/** Asks for the reason (needed by the backend) and returns it, or null when the user cancels. */
export function askReason(what: string): string | null {
  const r = window.prompt(`Reason for deactivating ${what}:`);
  return r === null ? null : r.trim();
}
