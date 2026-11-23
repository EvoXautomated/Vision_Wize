"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRightIcon, CalendarCheckIcon, PhoneIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ClientPicker } from "@/components/client-picker"
import { nextStep, useVisitStatus, VisitDialog } from "@/components/visit-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { ago, APPT_LABEL, formatDay, formatPhone, formatTime, VISIT_LABEL } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Appointment, Client, Visit, VisitStatus } from "@/lib/types"

interface Today {
  date: string
  visits: Visit[]
  appointments: Appointment[]
  pendingCalls: number
}

const COLUMNS: VisitStatus[] = ["reception", "exam", "sale", "ready"]

export default function TodayPage() {
  const qc = useQueryClient()
  const { user, can } = useSession()
  const today = useQuery({ queryKey: ["today"], queryFn: () => api<Today>("/today"), refetchInterval: 20_000 })
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState<Visit | null>(null)
  const status = useVisitStatus()

  const startVisit = useMutation({
    mutationFn: (body: { clientId: string; appointmentId?: string }) => api<Visit>("/visits", "POST", body),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["today"] })
      toast.success(`${v.client.fullName} está en recepción`)
    },
    onError: (e) => toast.error(e.message),
  })

  const apptStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/appointments/${id}/status`, "POST", { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["today"] }),
    onError: (e) => toast.error(e.message),
  })

  if (!user) return null
  const data = today.data
  const delivered = data?.visits.filter((v) => v.status === "delivered") ?? []

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hoy</h1>
          <p className="text-muted-foreground first-letter:uppercase">{data && formatDay(data.date, "EEEE d 'de' MMMM")}</p>
        </div>
        <div className="flex gap-2">
          {!!data?.pendingCalls && (
            <Button variant="outline" size="lg" render={<Link href="/llamar" />}>
              <PhoneIcon /> {data.pendingCalls} por llamar
            </Button>
          )}
          <Button size="lg" onClick={() => setPicking(true)}><PlusIcon /> Llegó un cliente</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = data?.visits.filter((v) => v.status === col) ?? []
          return (
            <section key={col} className="flex min-h-40 flex-col gap-2 rounded-xl bg-muted/60 p-3">
              <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                {VISIT_LABEL[col]} <span className="text-muted-foreground">{items.length}</span>
              </h2>
              {items.map((v) => {
                const next = nextStep(v, user.role)
                return (
                  <Card key={v.id} size="sm" className="cursor-pointer" onClick={() => setOpen(v)}>
                    <CardContent className="grid gap-2">
                      <div>
                        <p className="font-medium">{v.client.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {ago(v.statusAt)}{v.seller ? ` · ${v.seller.fullName}` : ""}
                        </p>
                      </div>
                      {next && (
                        <Button
                          variant="secondary"
                          size="lg"
                          disabled={status.isPending}
                          onClick={(e) => { e.stopPropagation(); status.mutate({ id: v.id, status: next }) }}
                        >
                          {VISIT_LABEL[next]} <ArrowRightIcon />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </section>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheckIcon className="size-4" /> Citas de hoy</CardTitle></CardHeader>
          <CardContent>
            {!data?.appointments.length && <p className="text-sm text-muted-foreground">No hay citas para hoy.</p>}
            <ul className="divide-y">
              {data?.appointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-20 font-medium tabular-nums">{formatTime(a.startsAt)}</span>
                  <Link href={`/clientes/${a.client.id}`} className="flex-1 hover:underline">
                    {a.client.fullName}
                    <span className="block text-xs text-muted-foreground">{formatPhone(a.client.phone)}{a.notes ? ` · ${a.notes}` : ""}</span>
                  </Link>
                  <Badge variant={a.status === "confirmed" ? "default" : "outline"}>{APPT_LABEL[a.status]}</Badge>
                  {(a.status === "scheduled" || a.status === "confirmed") && (
                    <div className="flex gap-2">
                      <Button size="lg" onClick={() => startVisit.mutate({ clientId: a.client.id, appointmentId: a.id })}>Llegó</Button>
                      {can("appointments.write") && (
                        <Button size="lg" variant="ghost" onClick={() => apptStatus.mutate({ id: a.id, status: "no_show" })}>No vino</Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Entregados hoy</CardTitle></CardHeader>
          <CardContent>
            {!delivered.length && <p className="text-sm text-muted-foreground">Todavía ninguno.</p>}
            <ul className="grid gap-2">
              {delivered.map((v) => (
                <li key={v.id}><Link href={`/clientes/${v.client.id}`} className="hover:underline">{v.client.fullName}</Link></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <ClientPicker
        open={picking}
        onOpenChange={setPicking}
        title="¿Quién llegó?"
        onPick={(c: Client) => startVisit.mutate({ clientId: c.id })}
      />
      <VisitDialog visit={open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  )
}
