/** Zona horaria de la tienda. */
export const SHOP_TZ = process.env.SHOP_TZ ?? 'America/New_York';

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha local de la tienda `yyyy-MM-dd`. */
export const shopDate = (d = new Date()) => parts.format(d);

/** Desfase (ms) de la zona de la tienda respecto a UTC en el instante `d`. */
function offsetMs(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SHOP_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second,
  );
  return asUtc - d.getTime();
}

/** Instante en que empieza (00:00 local) el día `ymd` en la tienda. */
export function shopDayStart(ymd: string): Date {
  const guess = new Date(`${ymd}T00:00:00.000Z`);
  return new Date(guess.getTime() - offsetMs(guess));
}

/** [inicio, fin) del día local `ymd`. */
export function shopDayRange(ymd: string): [Date, Date] {
  const start = shopDayStart(ymd);
  const next = new Date(`${ymd}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return [start, shopDayStart(next.toISOString().slice(0, 10))];
}
