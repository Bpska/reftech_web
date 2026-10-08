/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-017 -- Ask screen helpers.
import { describe, expect, it } from 'vitest';
import { cell, chartOf, columnTitle, docProblem, recogniser, speechLang } from './ask';

describe('ask helpers', () => {
  it('listens in Indian English or Hindi', () => {
    expect(speechLang('en')).toBe('en-IN');
    expect(speechLang('hi')).toBe('hi-IN');
    expect(recogniser({})).toBeNull();
    class Fake { lang = ''; }
    expect(recogniser({ webkitSpeechRecognition: Fake })).toBeInstanceOf(Fake);
  });
  it('formats the answer table', () => {
    expect(columnTitle('avgLateHours')).toBe('Avg late hours');
    expect(columnTitle('lane')).toBe('Lane');
    expect(cell(123456.789)).toBe('1,23,456.79');
    expect(cell('47200.00')).toBe('47,200');
    expect(cell('2026-10-10T14:30:00.000+05:30')).toBe('2026-10-10 14:30');
    expect(cell(null)).toBe('');
    expect(cell('Pune to Mumbai')).toBe('Pune to Mumbai');
  });
  it('makes the chart', () => {
    expect(chartOf({ chart: null })).toBeNull();
    expect(chartOf({ chart: { title: 'Trips', labels: [], values: [] } })).toBeNull();
    expect(chartOf({ chart: { title: 'Trips', labels: ['A', 'B'], values: [1, '2'] } })).toEqual({ title: 'Trips', labels: ['A', 'B'], series: [{ name: 'Trips', values: [1, 2] }] });
  });
  it('checks the document file', () => {
    expect(docProblem(null)).toContain('Choose');
    expect(docProblem({ name: 'a.pdf', size: 6 * 1024 * 1024 })).toContain('5 MB');
    expect(docProblem({ name: 'scan.jpg', size: 10 })).toContain('PDF');
    expect(docProblem({ name: 'Invoice.PDF', size: 10 })).toBe('');
  });
});
