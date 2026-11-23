import * as agenda from "./messages/agenda"
import * as appointments from "./messages/appointments"
import * as calls from "./messages/calls"
import * as campaigns from "./messages/campaigns"
import * as clients from "./messages/clients"
import * as common from "./messages/common"
import * as login from "./messages/login"
import * as panel from "./messages/panel"
import * as settings from "./messages/settings"
import * as shell from "./messages/shell"
import * as today from "./messages/today"
import * as visits from "./messages/visits"

export const LOCALES = ["es", "en"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "es"
export const LOCALE_COOKIE = "optica.locale"

/** Nombre de cada idioma en su propio idioma (así se reconoce sin entender el actual). */
export const LOCALE_NAME: Record<Locale, string> = { es: "Español", en: "English" }

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)

const es = {
  common: common.es, shell: shell.es, login: login.es, today: today.es, clients: clients.es, agenda: agenda.es,
  calls: calls.es, panel: panel.es, visits: visits.es, appointments: appointments.es, campaigns: campaigns.es, settings: settings.es,
}
export type Messages = typeof es

const en: Messages = {
  common: common.en, shell: shell.en, login: login.en, today: today.en, clients: clients.en, agenda: agenda.en,
  calls: calls.en, panel: panel.en, visits: visits.en, appointments: appointments.en, campaigns: campaigns.en, settings: settings.en,
}

export const MESSAGES: Record<Locale, Messages> = { es, en }
