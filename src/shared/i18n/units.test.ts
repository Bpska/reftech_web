/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- the conversions the screens use: shown in the login's unit, sent back in °C, tons and km.
import { afterEach, describe, expect, it } from 'vitest';
import {
  distanceFromUnit, distanceToUnit, fmtDateTime, fmtMoney, fmtTemp, fmtTempDelta, fmtTempNumber, fmtTempRange, fmtTime, fmtWeight,
  formatMoney, formatTempRange, formatTime, fromInputValue, tempFromUnit, tempNow, tempToUnit, toBase, toBaseFields, toBaseNumber,
  toInputValue, toShown, unitLabel, unitNow, weightFromUnit, weightToUnit, COMMON_UNIT_FIELDS,
} from './format';
import { statusText, statusWords, translate, translateStatus } from './i18n';
import { DEFAULT_PREFS, Prefs, setCurrentPrefs } from './prefs';

const P = (x: Partial<Prefs> = {}): Prefs => ({ ...DEFAULT_PREFS, ...x });
const F = P({ temperatureUnit: 'F' }), KG = P({ weightUnit: 'KG' }), MI = P({ distanceUnit: 'MI' });

describe('conversion both ways', () => {
  it('temperature', () => {
    expect(tempToUnit(-18, F)).toBeCloseTo(-0.4, 10);
    expect(tempToUnit(0, F)).toBe(32);
    expect(tempFromUnit(32, F)).toBe(0);
    expect(tempFromUnit(212, F)).toBe(100);
    expect(tempToUnit(5, P())).toBe(5);
    expect(tempFromUnit(5, P())).toBe(5);
  });
  it('weight and distance', () => {
    expect(weightToUnit(12.5, KG)).toBe(12500);
    expect(weightFromUnit(12500, KG)).toBe(12.5);
    expect(weightToUnit(12.5, P())).toBe(12.5);
    expect(distanceToUnit(160.9344, MI)).toBeCloseTo(100, 10);
    expect(distanceFromUnit(100, MI)).toBeCloseTo(160.9344, 10);
  });
  it('every whole °C from -40 to 40 comes back the same through a °F box', () => {
    for (let c = -40; c <= 40; c++) expect(Number(fromInputValue('temp', toInputValue('temp', c, F), F))).toBe(c);
  });
  it('a typical reefer range comes back to 2 places', () => {
    for (const c of [-25, -18.5, -0.4, 2, 2.5, 7.75, 8]) {
      expect(Number(fromInputValue('temp', toInputValue('temp', c, F), F))).toBeCloseTo(c, 2);
    }
  });
});

describe('input boxes', () => {
  it('show the stored value in the unit of the login', () => {
    expect(toInputValue('temp', -18, F)).toBe('-0.4');
    expect(toInputValue('temp', '2.5', F)).toBe('36.5');
    expect(toInputValue('temp', -18, P())).toBe('-18');
    expect(toInputValue('weight', 12.345, KG)).toBe('12345');
    expect(toInputValue('weight', 12.345, P())).toBe('12.345');
    expect(toInputValue('distance', 160.9344, MI)).toBe('100');
    expect(toInputValue('temp', null, F)).toBe('');
    expect(toInputValue('temp', '', F)).toBe('');
  });
  it('send what was typed in °C, tons and km', () => {
    expect(fromInputValue('temp', '35.6', F)).toBe('2');
    expect(fromInputValue('temp', ' -0.4 ', F)).toBe('-18');
    expect(fromInputValue('temp', '5', P())).toBe('5');
    expect(fromInputValue('weight', '12500', KG)).toBe('12.5');
    expect(fromInputValue('weight', '1', KG)).toBe('0.001');
    expect(fromInputValue('weight', '12.5', P())).toBe('12.5');
    expect(fromInputValue('distance', '100', MI)).toBe('160.934');
  });
  it('leave an empty or wrong box for the server to explain', () => {
    expect(fromInputValue('temp', '', F)).toBe('');
    expect(fromInputValue('temp', null, F)).toBe('');
    expect(fromInputValue('temp', 'abc', F)).toBe('abc');
  });
  it('labels', () => {
    expect(unitLabel('temp', F)).toBe('°F');
    expect(unitLabel('temp', P())).toBe('°C');
    expect(unitLabel('weight', KG)).toBe('kg');
    expect(unitLabel('weight', P())).toBe('tons');
    expect(unitLabel('distance', MI)).toBe('miles');
  });
});

describe('with the choices in use now', () => {
  afterEach(() => { setCurrentPrefs(DEFAULT_PREFS, false); });
  it('the defaults keep °C, tons, km and rupees', () => {
    expect(toBase('temp', '4')).toBe('4');
    expect(toShown('weight', 3)).toBe('3');
    expect(unitNow('temp')).toBe('°C');
    expect(fmtWeight(3)).toBe('3 t');
    expect(fmtTempRange(2, 8)).toBe('2.0 to 8.0 °C');
  });
  it('a °F and kg login', () => {
    setCurrentPrefs({ temperatureUnit: 'F', weightUnit: 'KG', currencyDisplay: 'CODE', timeZone: 'UTC', dateFormat: 'YYYY-MM-DD' }, false);
    expect(toBase('temp', '35.6')).toBe('2');
    expect(toBaseNumber('temp', '35.6')).toBe(2);
    expect(toBaseNumber('temp', '')).toBeNull();
    expect(toBaseNumber('temp', 'x')).toBeNull();
    expect(toShown('temp', 8)).toBe('46.4');
    expect(toBase('weight', '2500')).toBe('2.5');
    expect(unitNow('temp')).toBe('°F');
    expect(unitNow('weight')).toBe('kg');
    expect(fmtTemp(-18)).toBe('-0.4 °F');
    expect(fmtTempRange(2, 8)).toBe('35.6 to 46.4 °F');
    expect(fmtTempNumber(-18)).toBe('-0.4');
    expect(tempNow(100)).toBe(212);
    expect(fmtTempDelta(1)).toBe('1.8 °F');
    expect(fmtWeight(2.5)).toBe('2,500 kg');
    expect(fmtMoney(1500.5)).toBe('INR 1,500.50');
    expect(fmtMoney(1500.5, 0)).toBe('INR 1,501');
    expect(fmtDateTime('2026-10-07T20:00:00Z')).toBe('2026-10-07 20:00');
    expect(fmtTime('2026-10-07T20:05:00Z')).toBe('20:05');
  });
  it('toBaseFields changes only the named fields', () => {
    setCurrentPrefs({ temperatureUnit: 'F', weightUnit: 'KG' }, false);
    const body = { name: 'Reefer 1', minTemperatureC: '-0.4', maxTemperatureC: '46.4', capacityTons: '9000', note: '32', missing: undefined };
    expect(toBaseFields(body, COMMON_UNIT_FIELDS)).toEqual({ name: 'Reefer 1', minTemperatureC: '-18', maxTemperatureC: '8', capacityTons: '9', note: '32', missing: undefined });
    expect(toBaseFields({ temperatureC: 50 }, { temperatureC: 'temp' })).toEqual({ temperatureC: 10 });
    expect(toBaseFields({ temperatureC: '' }, { temperatureC: 'temp' })).toEqual({ temperatureC: '' });
    expect(body.minTemperatureC).toBe('-0.4'); // the original is not changed
  });
});

describe('ranges, times and money', () => {
  it('a range with one end missing', () => {
    expect(formatTempRange(null, 8, P())).toBe('up to 8.0 °C');
    expect(formatTempRange(-18, undefined, P())).toBe('-18.0 °C or above');
    expect(formatTempRange(null, null, P())).toBe('-');
    expect(formatTempRange('2', '8', F)).toBe('35.6 to 46.4 °F');
  });
  it('a time in the zone of the login', () => {
    expect(formatTime('2026-10-07T20:00:00Z', P())).toBe('01:30');
    expect(formatTime('2026-10-07T20:00:00Z', P({ timeZone: 'UTC' }))).toBe('20:00');
    expect(formatTime(null, P())).toBe('-');
    expect(formatTime('later', P())).toBe('later');
  });
  it('money in whole rupees', () => {
    expect(formatMoney(125000.4, P(), 0)).toBe('₹ 1,25,000');
    expect(formatMoney(-99.5, P(), 0)).toBe('-₹ 100');
  });
});

describe('status words', () => {
  afterEach(() => { setCurrentPrefs(DEFAULT_PREFS, false); });
  it('a code becomes words', () => {
    expect(statusWords('IN_TRANSIT')).toBe('In transit');
    expect(statusWords('partially-paid')).toBe('Partially paid');
    expect(statusWords('')).toBe('');
  });
  it('English keeps the code; Hindi and Odia translate a known status', () => {
    expect(translateStatus('en', 'IN_TRANSIT')).toBe('IN_TRANSIT');
    expect(translateStatus('hi', 'IN_TRANSIT')).toBe(translate('hi', 'In transit'));
    expect(translateStatus('hi', 'IN_TRANSIT')).not.toBe('In transit');
    expect(translateStatus('or', 'COMPLETED')).toBe(translate('or', 'Completed'));
    expect(translateStatus('hi', 'SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
    expect(translateStatus('hi', null)).toBe('');
    setCurrentPrefs({ language: 'or' }, false);
    expect(statusText('PENDING')).toBe(translate('or', 'Pending'));
  });
  it('the common buttons are translated', () => {
    for (const w of ['Save', 'Cancel', 'Search', 'Export', 'Add', 'Edit', 'Delete', 'Approve', 'Reject', 'Status']) {
      expect(translate('hi', w)).not.toBe(w);
      expect(translate('or', w)).not.toBe(w);
    }
  });
});
