"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { TagBadge } from "@/components/badges"
import { QueryStatus } from "@/components/query-status"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFormat, useT } from "@/i18n"
import { api } from "@/lib/api"
import { useSession } from "@/lib/session"

interface Dashboard {
  date: string
  clients: { total: number; newThisMonth: number }
  visits: { thisMonth: number; deliveredThisMonth: number; weekly: { week: string; visits: number }[] }
  exams: { overdue: number; dueNextMonth: number }
  appointments: { next7Days: number; noShowRate30: number | null }
  messages: { sent30: number; delivered30: number; failed30: number; pending: number; pendingCalls: number; unsubscribed30: number }
  sellers: { id: string; fullName: string; deliveredThisMonth: number; newClientsThisMonth: number }[]
  tags: { name: string; color: string; clients: number }[]
}

export default function PanelPage() {
  const t = useT().panel
  const fmt = useFormat()
  const { can } = useSession()
  const d = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard"), enabled: can("settings.manage"), refetchInterval: 60_000 })
  if (!can("settings.manage")) return <p className="p-8 text-center text-muted-foreground">{t.ownerOnly}</p>
  const data = d.data
  if (!data) return <QueryStatus query={d} label={t.queryLabel} />
  const maxWeek = Math.max(1, ...data.visits.weekly.map((w) => w.visits))
  const maxSeller = Math.max(1, ...data.sellers.map((s) => s.deliveredThisMonth))

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground first-letter:uppercase">{fmt.day(data.date, "month")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.clients} value={data.clients.total} hint={t.newThisMonth(data.clients.newThisMonth)} />
        <Stat label={t.visitsThisMonth} value={data.visits.thisMonth} hint={t.glassesDelivered(data.visits.deliveredThisMonth)} />
        <Stat label={t.overdueExams} value={data.exams.overdue} hint={t.dueNextMonth(data.exams.dueNextMonth)} href="/clientes" tone={data.exams.overdue ? "warn" : undefined} />
        <Stat
          label={t.upcomingAppointments}
          value={data.appointments.next7Days}
          hint={data.appointments.noShowRate30 == null ? t.noNoShowData : t.noShowRate(Math.round(data.appointments.noShowRate30 * 100))}
          href="/agenda"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t.weeklyVisits}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2" role="img" aria-label={t.weeklyVisitsAria(data.visits.weekly.map((w) => w.visits).join(", "))}>
              {data.visits.weekly.map((w) => (
                <div key={w.week} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 flex-col justify-end">
                    <span className="text-center text-xs tabular-nums text-muted-foreground">{w.visits || ""}</span>
                    <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${(w.visits / maxWeek) * 85}%`, minHeight: w.visits ? 4 : 1 }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fmt.day(w.week, "dayMonth")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.sellersThisMonth}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {!data.sellers.length && <p className="text-sm text-muted-foreground">{t.noSellers}</p>}
            {data.sellers.map((s) => (
              <div key={s.id} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.fullName}</span>
                  <span className="text-muted-foreground">{t.deliveries(s.deliveredThisMonth)} · {t.newClients(s.newClientsThisMonth)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(s.deliveredThisMonth / maxSeller) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.messages30}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <Mini label={t.sent} value={data.messages.sent30} />
            <Mini label={t.delivered} value={data.messages.delivered30} />
            <Mini label={t.failed} value={data.messages.failed30} />
            <Mini label={t.queued} value={data.messages.pending} />
            <Mini label={t.toCall} value={data.messages.pendingCalls} href="/llamar" />
            <Mini label={t.unsubscribed} value={data.messages.unsubscribed30} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.tags}</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {!data.tags.length && <p className="text-sm text-muted-foreground">{t.noTags}</p>}
            {data.tags.map((tag) => (
              <div key={tag.name} className="flex items-center justify-between text-sm">
                <TagBadge tag={tag} />
                <span className="tabular-nums text-muted-foreground">{t.clientCount(tag.clients)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint, href, tone }: { label: string; value: number; hint: string; href?: string; tone?: "warn" }) {
  const body = (
    <Card className={tone === "warn" ? "border-warning" : undefined}>
      <CardContent className="grid gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href} className="transition hover:opacity-80">{body}</Link> : body
}

function Mini({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-lg bg-muted/60 p-2">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}
