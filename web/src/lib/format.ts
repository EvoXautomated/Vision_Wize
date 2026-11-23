import { format } from "date-fns"
import type { Role, VisitStatus } from "./types"

// Los textos (roles, estados…) están en `@/i18n` (`t.common`), y las fechas en `useFormat()`.

export const VISIT_FLOW: VisitStatus[] = ["reception", "exam", "sale", "ready", "delivered"]

/** Estados a los que puede mover cada rol (igual que en la API). */
export const VISIT_TARGETS: Record<Role, VisitStatus[]> = {
  owner: ["reception", "exam", "sale", "ready", "delivered", "cancelled"],
  reception: ["exam", "sale", "delivered", "cancelled"],
  doctor: ["exam", "sale"],
  seller: ["sale", "ready", "delivered", "cancelled"],
}

/** 13055550101 → (305) 555-0101 */
export function formatPhone(p?: string | null) {
  if (!p) return ""
  const m = p.match(/^1?(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${p}`
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
