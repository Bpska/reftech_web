/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

type Props = { dark?: boolean; compact?: boolean; sidebar?: boolean };

// v0.2.2: swapped to the new RefTech brand mark. Per explicit direction, the
// full logo picture (public/media/reftech_logo_new.png) is used as-is,
// uncropped, everywhere it appears — navbar, sidebar, and login — just
// scaled to fit each spot; never a cropped/round badge version of it.
//
// v0.2.2 update: the navbar ("compact") mark was far too small (h-9 / 36px)
// for a wide banner-style logo (918x325, ~2.8:1) that has a tagline and a
// feature-icon row baked into the image itself — at 36px tall none of that
// was legible. Sized up to a large, clearly-visible top-left mark on an
// elevated white plate, matching a standard enterprise/MNC navbar treatment.
export function BrandMark({ compact = false, sidebar = false }: Props) {
  if (compact) {
    return (
      <img
        src="/media/reftech_logo_new.png"
        alt="RefTech - Temperature Controlled, Powered By Technology"
        className="h-14 w-auto max-w-[260px] shrink-0 rounded-xl bg-white p-1.5 object-contain shadow-md ring-1 ring-black/5 sm:h-16 sm:max-w-[300px] md:h-20 md:max-w-[340px]"
      />
    );
  }

  if (sidebar) {
    return (
      <img
        src="/media/reftech_logo_new.png"
        alt="RefTech - Temperature Controlled, Powered By Technology"
        className="h-auto w-full max-w-[220px] shrink-0 rounded-lg bg-white p-1.5 object-contain"
      />
    );
  }

  return (
    <img
      src="/media/reftech_logo_new.png"
      alt="RefTech - Temperature Controlled, Powered By Technology"
      className="h-auto w-full max-w-[280px] shrink-0 rounded-lg bg-white p-1.5 object-contain"
    />
  );
}
