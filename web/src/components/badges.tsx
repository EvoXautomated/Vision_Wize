import { Badge } from "@/components/ui/badge"
import { examState, formatDay } from "@/lib/format"
import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

const TAG_COLORS: Record<string, string> = {
  slate: "bg-muted text-foreground",
  amber: "bg-amber-100 text-amber-900",
  sky: "bg-sky-100 text-sky-900",
  emerald: "bg-emerald-100 text-emerald-900",
  rose: "bg-rose-100 text-rose-900",
  violet: "bg-violet-100 text-violet-900",
}
export const TAG_COLOR_NAMES = Object.keys(TAG_COLORS)

export function TagBadge({ tag }: { tag: Pick<Tag, "name" | "color"> }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TAG_COLORS[tag.color] ?? TAG_COLORS.slate)}>{tag.name}</span>
}

export function ExamBadge({ nextExamDue }: { nextExamDue: string | null }) {
  const s = examState(nextExamDue)
  if (s === "none") return <span className="text-muted-foreground">Sin examen</span>
  return (
    <Badge variant={s === "overdue" ? "destructive" : s === "soon" ? "secondary" : "outline"}>
      {s === "overdue" ? "Vencida · " : ""}{formatDay(nextExamDue, "MMM yyyy")}
    </Badge>
  )
}
