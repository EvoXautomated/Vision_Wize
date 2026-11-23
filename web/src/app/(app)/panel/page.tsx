"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { TagBadge } from "@/components/badges"
import { QueryStatus } from "@/components/query-status"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { formatDay, plural } from "@/lib/format"
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
  const { can } = useSession()
  const d = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard"), enabled: can("settings.manage"), refetchInterval: 60_000 })
  if (!can("settings.manage")) return <p className="p-8 text-center text-muted-foreground">Solo el dueño puede ver el panel.</p>
  const data = d.data
  if (!data) return <QueryStatus query={d} label="los datos del panel" />
  const maxWeek = Math.max(1, ...data.visits.weekly.map((w) => w.visits))
  const maxSeller = Math.max(1, ...data.sellers.map((s) => s.deliveredThisMonth))

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="text-muted-foreground first-letter:uppercase">{formatDay(data.date, "MMMM yyyy")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clientes" value={data.clients.total} hint={`${plural(data.clients.newThisMonth, "nuevo", "nuevos")} este mes`} />
        <Stat label="Visitas este mes" value={data.visits.thisMonth} hint={`${plural(data.visits.deliveredThisMonth, "entrega", "entregas")} de lentes`} />
        <Stat label="Revisiones vencidas" value={data.exams.overdue} hint={`${data.exams.dueNextMonth} ${data.exams.dueNextMonth === 1 ? "vence" : "vencen"} el próximo mes`} href="/clientes" tone={data.exams.overdue ? "warn" : undefined} />
        <Stat
          label="Citas próximos 7 días"
          value={data.appointments.next7Days}
          hint={data.appointments.noShowRate30 == null ? "Sin datos de inasistencia" : `${Math.round(data.appointments.noShowRate30 * 100)} % no vino (30 días)`}
          href="/agenda"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Visitas por semana</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2" role="img" aria-label={`Visitas por semana: ${data.visits.weekly.map((w) => w.visits).join(", ")}`}>
              {data.visits.weekly.map((w) => (
                <div key={w.week} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 flex-col justify-end">
                    <span className="text-center text-xs tabular-nums text-muted-foreground">{w.visits || ""}</span>
                    <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${(w.visits / maxWeek) * 85}%`, minHeight: w.visits ? 4 : 1 }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDay(w.week, "d MMM")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vendedoras este mes</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {!data.sellers.length && <p className="text-sm text-muted-foreground">No hay vendedoras en el equipo.</p>}
            {data.sellers.map((s) => (
              <div key={s.id} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.fullName}</span>
                  <span className="text-muted-foreground">{plural(s.deliveredThisMonth, "entrega", "entregas")} · {plural(s.newClientsThisMonth, "cliente nuevo", "clientes nuevos")}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(s.deliveredThisMonth / maxSeller) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mensajes (últimos 30 días)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Enviados" value={data.messages.sent30} />
            <Mini label="Entregados (SMS)" value={data.messages.delivered30} />
            <Mini label="Fallidos" value={data.messages.failed30} />
            <Mini label="En cola" value={data.messages.pending} />
            <Mini label="Por llamar" value={data.messages.pendingCalls} href="/llamar" />
            <Mini label="Bajas" value={data.messages.unsubscribed30} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Etiquetas</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {!data.tags.length && <p className="text-sm text-muted-foreground">Sin etiquetas todavía.</p>}
            {data.tags.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <TagBadge tag={t} />
                <span className="tabular-nums text-muted-foreground">{plural(t.clients, "cliente", "clientes")}</span>
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
