/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-009 -- Code 128 (set B) barcodes for pallet labels, bin labels, pick lists and gate passes.
// Drawn as SVG so a label prints sharp on any printer and any handheld scanner reads it. No library needed.

// Widths of bar, space, bar, space, bar, space for code values 0..106 (106 = stop, which has a 7th element).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104, STOP = 106;

/** The bar and space widths (in modules) of text as Code 128 B. Characters outside space..~ are dropped. */
export function code128Widths(text: string): number[] {
  const values = [...text].map(ch => ch.charCodeAt(0) - 32).filter(v => v >= 0 && v <= 94);
  let sum = START_B;
  values.forEach((v, i) => { sum += v * (i + 1); });
  const codes = [START_B, ...values, sum % 103, STOP];
  return codes.flatMap(c => [...PATTERNS[c]].map(Number));
}

/** An SVG barcode with the text printed under it. moduleWidth is the width of the thinnest bar in px. */
export function barcodeSvg(text: string, height = 60, moduleWidth = 2, showText = true): string {
  const widths = code128Widths(text);
  const quiet = 10 * moduleWidth;
  const total = widths.reduce((a, b) => a + b, 0) * moduleWidth + quiet * 2;
  const textH = showText ? 18 : 0;
  let x = quiet;
  const bars: string[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w * moduleWidth}" height="${height}"/>`);
    x += w * moduleWidth;
  });
  const label = showText
    ? `<text x="${total / 2}" y="${height + 15}" font-family="monospace" font-size="14" text-anchor="middle">${escapeXml(text)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${height + textH}" viewBox="0 0 ${total} ${height + textH}">` +
    `<rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars.join('')}</g>${label}</svg>`;
}

export const escapeXml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));
