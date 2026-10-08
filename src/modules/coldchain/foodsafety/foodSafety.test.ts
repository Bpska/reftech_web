/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-015 -- the pure helpers of the Food Safety screen.
import { describe, expect, it } from 'vitest';
import { certTone, findingDue, hazardBody, inside, limitText, needsEvidence, risk, riskLevel, significant } from './foodSafety';

describe('food safety', () => {
  it('scores a hazard as the backend does', () => {
    expect(risk(3, 2)).toBe(6);
    expect(risk(4, 1)).toBeNull();
    expect(riskLevel(6)).toBe('HIGH');
    expect(riskLevel(4)).toBe('MEDIUM');
    expect(riskLevel(2)).toBe('LOW');
    expect(riskLevel(null)).toBe('-');
    expect(significant(2, 2)).toBe(true);
    expect(significant(3, 1)).toBe(true);
    expect(significant(1, 3)).toBe(false);
  });
  it('writes and checks a CCP limit', () => {
    expect(limitText({ limitMin: -25, limitMax: -18, limitUnit: '°C' })).toBe('-25 to -18 °C');
    expect(limitText({ limitMax: -15, limitUnit: '°C' })).toBe('-15 °C or lower');
    expect(limitText({ criticalLimit: 'No visible damage' })).toBe('No visible damage');
    expect(inside(-19, null, -15)).toBe(true);
    expect(inside(-12, null, -15)).toBe(false);
    expect(inside(5, null, null)).toBeNull();
  });
  it('sets the finding due date and evidence rule', () => {
    expect(findingDue('MAJOR', new Date('2026-10-08T00:00:00Z'))).toBe('2026-11-07');
    expect(findingDue('CRITICAL', new Date('2026-10-08T00:00:00Z'))).toBe('2026-10-15');
    expect(needsEvidence('MAJOR')).toBe(true);
    expect(needsEvidence('MINOR')).toBe(false);
  });
  it('colours certificates and cleans the hazard form', () => {
    expect(certTone('AUDIT_OVERDUE')).toBe('OVERDUE');
    expect(certTone('DUE_SOON')).toBe('DUE_SOON');
    expect(hazardBody({ severity: '3', likelihood: '1', isCcp: false, ccpCode: 'CCP-9', limitMax: -15 })).toEqual({ severity: 3, likelihood: 1, isCcp: false, ccpCode: null, criticalLimit: null, limitMin: null, limitMax: null });
  });
});
