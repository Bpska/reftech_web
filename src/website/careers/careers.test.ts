/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-010 -- the small helpers of the Careers page.
import { describe, expect, it } from 'vitest';
import { blocks, experienceText, resumeProblem } from './careers';

const file = (name: string, size: number) => ({ name, size } as File);

describe('experienceText', () => {
  it('reads like a person wrote it', () => {
    expect(experienceText(2, 10)).toBe('2-10 years');
    expect(experienceText(1, 1)).toBe('1 year');
    expect(experienceText(0, null)).toBe('Freshers welcome');
    expect(experienceText(3, null)).toBe('From 3 years');
    expect(experienceText(null, 4)).toBe('Up to 4 years');
    expect(experienceText(null, null)).toBe('');
    expect(experienceText(1.5, 3)).toBe('1.5-3 years');
  });
});

describe('resumeProblem', () => {
  it('takes PDF, DOC and DOCX up to the limit', () => {
    expect(resumeProblem(file('cv.pdf', 1000))).toBe('');
    expect(resumeProblem(file('CV.DOCX', 1000))).toBe('');
    expect(resumeProblem(file('cv.doc', 5 * 1024 * 1024))).toBe('');
  });
  it('refuses the rest', () => {
    expect(resumeProblem(null)).toMatch(/attach your resume/);
    expect(resumeProblem(file('cv.jpg', 1000))).toMatch(/PDF, DOC or DOCX/);
    expect(resumeProblem(file('cv.pdf', 5 * 1024 * 1024 + 1))).toMatch(/5 MB or smaller/);
    expect(resumeProblem(file('cv.pdf', 3 * 1024 * 1024), 2)).toMatch(/2 MB or smaller/);
  });
});

describe('blocks', () => {
  it('makes paragraphs and bullet lists from the text HR typed', () => {
    expect(blocks('Drive reefer trucks.\n\n- HMV licence\n- 2 years\nHindi or Marathi')).toEqual([
      { list: false, lines: ['Drive reefer trucks.'] },
      { list: true, lines: ['HMV licence', '2 years'] },
      { list: false, lines: ['Hindi or Marathi'] },
    ]);
    expect(blocks(null)).toEqual([]);
  });
});
