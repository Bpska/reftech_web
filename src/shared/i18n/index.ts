/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- one import for the screens: import { usePrefs, t, fmtWeight } from '@/shared/i18n';
export { PrefsProvider, usePrefs } from './PrefsProvider';
export type { PrefsContextValue } from './PrefsProvider';
export { t, translate, hasTranslation, statusText, statusWords, translateStatus } from './i18n';
export { fmtDate, fmtDateTime, fmtDistance, fmtMoney, fmtNumber, fmtTemp, fmtWeight, formatDate, formatDateTime, formatDistance, formatMoney, formatNumber, formatTemp, formatWeight } from './format';
export { currentPrefs, DEFAULT_PREFS, LANGUAGE_NAMES, normalizePrefs, setCurrentPrefs, ZONES } from './prefs';
export type { Lang, Prefs } from './prefs';
export { COMMON_UNIT_FIELDS, fmtTempDelta, fmtTempNumber, formatTempDelta, tempNow, toBaseFields, fmtTempRange, fmtTime, formatTempRange, formatTime, fromInputValue, toInputValue, toBase, toBaseNumber, toShown, unitNow, unitLabel, tempFromUnit, tempToUnit, weightFromUnit, weightToUnit, distanceFromUnit, distanceToUnit } from './format';
export type { UnitKind } from './format';
export { usePrefsFormat, Temp, TempRange, Weight, Distance, Money, DateTime, DateOnly, Time, Unit, UnitInput } from './Units';
