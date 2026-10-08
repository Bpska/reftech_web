/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-007 / REQ-PLT-015 -- what the display choices put on <html>.
import { describe, expect, it } from 'vitest';
import { a11yAttributes } from './useA11yPrefs';

describe('a11yAttributes', () => {
  it('standard choices change nothing', () => {
    expect(a11yAttributes({ textSize: '100', highContrast: false, reduceMotion: false, language: 'en' })).toEqual({ fontSize: '', highContrast: false, reduceMotion: false, lang: 'en' });
  });
  it('bigger text, contrast, motion and language', () => {
    expect(a11yAttributes({ textSize: '125', highContrast: true, reduceMotion: true, language: 'or' })).toEqual({ fontSize: '125%', highContrast: true, reduceMotion: true, lang: 'or' });
  });
  it('an unknown size is the normal size', () => {
    expect(a11yAttributes({ textSize: '300' as any, highContrast: false, reduceMotion: false, language: 'hi' }).fontSize).toBe('');
  });
});
