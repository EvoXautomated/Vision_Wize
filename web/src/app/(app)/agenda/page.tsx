"use client"

import { useQuery } from "@tanstack/react-query"
import { addDays, format, isToday, startOfWeek } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { AppointmentDialog } from "@/components/appointment-dialog"
import { QueryStatus } from "@/components/query-status"
import { Button } from "@/components/ui/button"
import { useFormat, useT } from "@/i18n"
import { api } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

const ymd = (d: Date) => format(d, "yyyy-MM-dd")

export default function AgendaPage() {
  const t = useT()
  const fmt = useFormat()
  const { can } = useSession()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Appointment | undefined>()
  const [day, setDay] = useState<string | undefined>()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const from = ymd(days[0])
  const to = ymd(days[6])
  const appts = useQuery({
    queryKey: ["appointments", from, to],
    queryFn: () => api<Appointment[]>(`/appointments?from=${from}&to=${to}`),
    refetchInterval: 30_000,
  })

  const byDay = (d: Date) =>
    (appts.data ?? []).filter((a) => ymd(new Date(a.startsAt)) === ymd(d) && a.status !== "cancelled")

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="mr-2 text-2xl font-semibold">{t.agenda.title}</h1>
          <Button variant="outline" size="icon-lg" aria-label={t.agenda.previousWeek} onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeftIcon /></Button>
          <Button variant="outline" size="lg" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>{t.agenda.today}</Button>
          <Button variant="outline" size="icon-lg" aria-label={t.agenda.nextWeek} onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRightIcon /></Button>
          <span className="text-muted-foreground">
            {t.agenda.range(fmt.day(from, "dayMonth"), fmt.day(to))}
          </span>
        </div>
        {can("appointments.write") && (
          <Button size="lg" onClick={() => { setSelected(undefined); setDay(undefined); setOpen(true) }}><PlusIcon /> {t.agenda.newAppointment}</Button>
        )}
      </div>

      <QueryStatus query={appts} label={t.agenda.queryLabel} />

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const items = byDay(d)
          return (
            <section key={d.toISOString()} className={cn("flex min-h-48 flex-col gap-2 rounded-xl border bg-card p-2", isToday(d) && "border-primary")}>
              <button
                className="flex items-baseline justify-between rounded-md px-1 py-1 text-left hover:bg-muted disabled:hover:bg-transparent"
                disabled={!can("appointments.write")}
                onClick={() => { setSelected(undefined); setDay(ymd(d)); setOpen(true) }}
              >
                <span className="text-sm font-semibold capitalize">{fmt.day(ymd(d), "weekday")}</span>
                <span className="text-xs text-muted-foreground">{items.length || ""}</span>
              </button>
              {items.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelected(a); setOpen(true) }}
                  className={cn(
                    "rounded-lg border-l-4 bg-muted/50 p-2 text-left text-sm hover:bg-muted",
                    a.status === "confirmed" ? "border-l-primary" : a.status === "arrived" ? "border-l-success" : a.status === "no_show" ? "border-l-destructive" : "border-l-muted-foreground/40",
                  )}
                >
                  <span className="block font-medium tabular-nums">{fmt.time(a.startsAt)}</span>
                  <span className="block truncate">{a.client.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{t.common.appointment[a.status]}{a.doctor ? ` · ${a.doctor.initials}` : ""}</span>
                </button>
              ))}
            </section>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t.agenda.hint}
      </p>

      <AppointmentDialog open={open} onOpenChange={setOpen} appointment={selected} defaultDate={day} />
    </div>
  )
}

