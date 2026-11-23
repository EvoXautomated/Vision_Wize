"use client"

import { Badge } from "@/components/ui/badge"
import { useFormat, useT } from "@/i18n"
import { examState } from "@/lib/format"
import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

// Cada color tiene su pareja para el tema oscuro: fondo apagado y texto claro.
const TAG_COLORS: Record<string, string> = {
  slate: "bg-muted text-foreground",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  sky: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200",
  emerald: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
  rose: "bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200",
  violet: "bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200",
}
export const TAG_COLOR_NAMES = Object.keys(TAG_COLORS)

export function TagBadge({ tag }: { tag: Pick<Tag, "name" | "color"> }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TAG_COLORS[tag.color] ?? TAG_COLORS.slate)}>{tag.name}</span>
}

export function ExamBadge({ nextExamDue }: { nextExamDue: string | null }) {
  const t = useT().common.exam
  const fmt = useFormat()
  const s = examState(nextExamDue)
  if (s === "none") return <span className="text-muted-foreground">{t.none}</span>
  return (
    <Badge variant={s === "overdue" ? "destructive" : s === "soon" ? "secondary" : "outline"}>
      {s === "overdue" ? `${t.overdue} · ` : ""}{fmt.day(nextExamDue, "monthYear")}
    </Badge>
  )
}
