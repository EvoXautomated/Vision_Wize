import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import type { AppointmentStatus, ContactPref, Role, VisitStatus } from "./types"

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  reception: "Recepción",
  doctor: "Médico",
  seller: "Vendedora",
}

export const VISIT_FLOW: VisitStatus[] = ["reception", "exam", "sale", "ready", "delivered"]

export const VISIT_LABEL: Record<VisitStatus, string> = {
  reception: "Recepción",
  exam: "Examen",
  sale: "Venta",
  ready: "Lentes listos",
  delivered: "Entregado",
  cancelled: "Cancelada",
}

/** Estados a los que puede mover cada rol (igual que en la API). */
export const VISIT_TARGETS: Record<Role, VisitStatus[]> = {
  owner: ["reception", "exam", "sale", "ready", "delivered", "cancelled"],
  reception: ["exam", "sale", "delivered", "cancelled"],
  doctor: ["exam", "sale"],
  seller: ["sale", "ready", "delivered", "cancelled"],
}

export const CONTACT_LABEL: Record<ContactPref, string> = {
  sms: "SMS",
  email: "Correo",
  call: "Llamada",
  none: "No quiere avisos",
}

export const APPT_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  arrived: "Llegó",
  no_show: "No vino",
  cancelled: "Cancelada",
}

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  exam_reminder: "Recordatorio de revisión",
  exam_reminder_2: "Segundo recordatorio",
  appt_confirmation: "Confirmación de cita",
  appt_reminder: "Recordatorio de cita (24 h)",
  ready: "Lentes listos",
  welcome: "Bienvenida",
  birthday: "Cumpleaños",
  campaign: "Campaña",
}

/** 13055550101 → (305) 555-0101 */
export function formatPhone(p?: string | null) {
  if (!p) return ""
  const m = p.match(/^1?(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${p}`
}

/** "2026-11-22" (fecha de calendario, sin zona) → "22 nov 2026" */
export function formatDay(ymd?: string | null, pattern = "d MMM yyyy") {
  if (!ymd) return ""
  return format(parseISO(ymd), pattern, { locale: es })
}

export function formatDateTime(iso: string, pattern = "EEE d MMM, h:mm a") {
  return format(new Date(iso), pattern, { locale: es })
}

export function formatTime(iso: string) {
  return format(new Date(iso), "h:mm a", { locale: es })
}

export function ago(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { locale: es, addSuffix: true })
}

/** Fecha local yyyy-MM-dd */
export function localYmd(d = new Date()) {
  return format(d, "yyyy-MM-dd")
}

export function examState(nextExamDue?: string | null): "overdue" | "soon" | "ok" | "none" {
  if (!nextExamDue) return "none"
  const today = localYmd()
  if (nextExamDue <= today) return "overdue"
  const soon = localYmd(new Date(Date.now() + 30 * 86_400_000))
  return nextExamDue <= soon ? "soon" : "ok"
}
