/** Teléfono a dígitos E.164 sin '+'. Diez dígitos se toman como EE. UU. (+1). */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

export function normalizeEmail(raw?: string | null): string | null {
  const v = raw?.trim().toLowerCase();
  return v ? v : null;
}

/** Texto sin acentos y en minúsculas, para comparar nombres. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** `yyyy-MM-dd` a Date (medianoche UTC), el formato de las columnas @db.Date. */
export const toDate = (ymd?: string | null) =>
  ymd ? new Date(`${ymd}T00:00:00.000Z`) : null;

export const ymd = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Suma meses a una fecha de calendario, ajustando al último día del mes. */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1),
  );
  const last = new Date(
    Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0),
  ).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), last));
  return r;
}
