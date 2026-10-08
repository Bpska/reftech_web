/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-002, REQ-PLT-003 -- the pure helpers of branding colours and browser push.
import { describe, expect, it } from 'vitest';
import { brandVariables, hexToRgb, shade } from './branding';
import { keyBytes, pushProblem } from './push';

describe('branding colours', () => {
  it('reads #RRGGBB', () => {
    expect(hexToRgb('#0369A1')).toEqual([3, 105, 161]);
    expect(hexToRgb('abc')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
    expect(shade([100, 200, 50], 0.5)).toBe('50 100 25');
  });
  it('leaves the built-in colours when the company has none', () => {
    const v = brandVariables(null);
    expect(v['--brand-primary-rgb']).toBeNull();
    expect(v['--brand-header-rgb']).toBeNull();
    expect(v['--brand-accent-line']).toBeNull();
    expect(v['--brand-primary']).toBe('#0369A1');
  });
  it('makes the header, button and hover colours from the main colour', () => {
    const v = brandVariables({ primaryColour: '#C81E1E', accentColour: '#F59E0B' });
    expect(v['--brand-primary-rgb']).toBe('200 30 30');
    expect(v['--brand-primary-dark-rgb']).toBe('160 24 24');
    expect(v['--brand-header-rgb']).toBe('60 9 9');
    expect(v['--brand-accent-line']).toBe('rgb(245 158 11)');
  });
});

describe('push', () => {
  it('turns the base64url server key into bytes', () => {
    const b = keyBytes('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });
  it('says why push cannot work', () => {
    expect(pushProblem({ isSecureContext: false, navigator: {} })).toMatch(/https/);
    expect(pushProblem({ isSecureContext: true, navigator: {} })).toMatch(/cannot receive push/);
    expect(pushProblem({ isSecureContext: true, navigator: { serviceWorker: {} }, PushManager: {}, Notification: { permission: 'denied' } })).toMatch(/blocked/);
    expect(pushProblem({ isSecureContext: true, navigator: { serviceWorker: {} }, PushManager: {}, Notification: { permission: 'default' } })).toBeNull();
  });
});
