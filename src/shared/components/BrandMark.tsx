/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

type Props = { dark?: boolean; compact?: boolean; sidebar?: boolean; className?: string };

export function BrandMark({ compact = false, sidebar = false, className = '' }: Props) {
  if (compact) {
    return (
      <img
        src="/media/reftech_logo_new.png"
        alt="RefTech - Temperature Controlled, Powered By Technology"
        className={`h-10 sm:h-11 w-auto max-w-[190px] sm:max-w-[220px] shrink-0 rounded-lg bg-white p-1 object-contain shadow-sm ring-1 ring-black/5 ${className}`}
      />
    );
  }

  if (sidebar) {
    return (
      <img
        src="/media/reftech_logo_new.png"
        alt="RefTech - Temperature Controlled, Powered By Technology"
        className={`h-auto w-full max-w-[220px] shrink-0 rounded-lg bg-white p-1.5 object-contain shadow-sm ${className}`}
      />
    );
  }

  return (
    <img
      src="/media/reftech_logo_new.png"
      alt="RefTech - Temperature Controlled, Powered By Technology"
      className={`h-auto w-full max-w-[320px] shrink-0 rounded-xl bg-white p-2 object-contain shadow-md ring-1 ring-white/10 ${className}`}
    />
  );
}
