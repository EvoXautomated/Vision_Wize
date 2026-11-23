"use client"

import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { enUS, es as esLocale } from "date-fns/locale"
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react"
import { DEFAULT_LOCALE, type Locale, LOCALE_COOKIE, MESSAGES, type Messages } from "./dict"

export { LOCALE_NAME, LOCALES, type Locale, type Messages } from "./dict"

const DATE_LOCALE = { es: esLocale, en: enUS }

/** Patrones de fecha con nombre: cada idioma ordena el día y el mes a su manera. */
const PATTERNS = {
  es: { day: "d MMM yyyy", dayLong: "EEEE d 'de' MMMM", dayLongYear: "d 'de' MMMM 'de' yyyy", dateTimeYear: "d MMM yyyy, h:mm a", dayShort: "EEE d MMM", dayMonth: "d MMM", weekday: "EEE d", monthYear: "MMM yyyy", month: "MMMM yyyy", dateTime: "EEE d MMM, h:mm a", time: "h:mm a" },
  en: { day: "MMM d, yyyy", dayLong: "EEEE, MMMM d", dayLongYear: "MMMM d, yyyy", dateTimeYear: "MMM d, yyyy, h:mm a", dayShort: "EEE, MMM d", dayMonth: "MMM d", weekday: "EEE d", monthYear: "MMM yyyy", month: "MMMM yyyy", dateTime: "EEE, MMM d, h:mm a", time: "h:mm a" },
} satisfies Record<Locale, Record<string, string>>
export type DatePattern = keyof (typeof PATTERNS)["es"]

function formatters(locale: Locale) {
  const l = { locale: DATE_LOCALE[locale] }
  const p = PATTERNS[locale]
  return {
    /** "2026-11-22" (fecha de calendario, sin zona) → "22 nov 2026" */
    day: (ymd?: string | null, pattern: DatePattern = "day") => (ymd ? format(parseISO(ymd), p[pattern], l) : ""),
    dateTime: (iso: string, pattern: DatePattern = "dateTime") => format(new Date(iso), p[pattern], l),
    time: (iso: string) => format(new Date(iso), p.time, l),
    ago: (iso: string) => formatDistanceToNowStrict(new Date(iso), { ...l, addSuffix: true }),
    number: (n: number) => n.toLocaleString(locale === "es" ? "es-US" : "en-US"),
  }
}

interface I18nValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: Messages
  fmt: ReturnType<typeof formatters>
}

const I18nContext = createContext<I18nValue | null>(null)

// Textos para el código que vive fuera de React (errores de `api`).
let current: Messages = MESSAGES[DEFAULT_LOCALE]
export const currentMessages = () => current

/** El idioma se guarda en una cookie del dispositivo: el servidor ya pinta la página en ese idioma. */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale)
  useEffect(() => {
    current = MESSAGES[locale]
  }, [locale])

  const setLocale = useCallback((l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = l
    setLocaleState(l)
  }, [])

  const value = useMemo(() => ({ locale, setLocale, t: MESSAGES[locale], fmt: formatters(locale) }), [locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function useI18n() {
  const ctx = use(I18nContext)
  if (!ctx) throw new Error("useI18n fuera de I18nProvider")
  return ctx
}

/** Textos del idioma activo: `const t = useT()` y `t.clients.title`. */
export const useT = () => useI18n().t
/** Fechas y números en el idioma activo: `const fmt = useFormat()` y `fmt.day(ymd)`. */
export const useFormat = () => useI18n().fmt
export function useLocale() {
  const { locale, setLocale } = useI18n()
  return { locale, setLocale }
}
