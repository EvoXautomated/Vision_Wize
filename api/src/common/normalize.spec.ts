import { describe, expect, it } from 'vitest';
import { diff } from '../audit/audit.service.js';
import { parseDate } from '../clients/import.service.js';
import { addMonths, fold, normalizePhone, toDate, ymd } from './normalize.js';

describe('normalize', () => {
  it('teléfono: diez dígitos son de EE. UU.', () => {
    expect(normalizePhone('(305) 555-0101')).toBe('13055550101');
    expect(normalizePhone('+1 305 555 0101')).toBe('13055550101');
    expect(normalizePhone('  ')).toBeNull();
  });
  it('fold quita tildes y mayúsculas', () => expect(fold(' María GONZÁLEZ ')).toBe('maria gonzalez'));
  it('addMonths ajusta al último día del mes', () => {
    expect(ymd(addMonths(toDate('2026-01-31')!, 1))).toBe('2026-02-28');
    expect(ymd(addMonths(toDate('2026-11-20')!, 12))).toBe('2027-11-20');
    expect(ymd(addMonths(toDate('2026-03-15')!, -6))).toBe('2025-09-15');
  });
});

describe('parseDate (importación)', () => {
  it.each([
    ['2025-10-01', '2025-10-01'],
    ['04/15/1980', '1980-04-15'],
    ['15-04-1980', '1980-04-15'],
    ['4/5/80', '1980-04-05'],
    [45000, '2023-03-15'],
    ['', null],
    ['31/02/2020', 'invalid'],
    ['mañana', 'invalid'],
  ])('%j → %j', (input, expected) => expect(parseDate(input)).toBe(expected));
});

describe('diff (registro de cambios)', () => {
  it('solo recoge lo que cambia', () => {
    const before = { a: 1, b: 'x', d: new Date('2026-01-01T00:00:00Z') };
    expect(diff(before, { a: 1, b: 'y', c: undefined, d: new Date('2026-01-01T00:00:00Z') })).toEqual({ b: { from: 'x', to: 'y' } });
  });
});
