"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarPlusIcon,
  CombineIcon,
  DoorOpenIcon,
  MailIcon,
  MessageSquareIcon,
  PencilIcon,
  PhoneIcon,
  Trash2Icon,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AppointmentDialog } from "@/components/appointment-dialog"
import { ExamBadge, TagBadge } from "@/components/badges"
import { ClientFormDialog } from "@/components/client-form"
import { ClientPicker } from "@/components/client-picker"
import { VisitDialog } from "@/components/visit-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import { APPT_LABEL, CONTACT_LABEL, formatDateTime, formatDay, formatPhone, VISIT_LABEL } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Appointment, Client, TimelineItem, Visit } from "@/lib/types"

export default function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { can } = useSession()
  const [editing, setEditing] = useState(false)
  const [booking, setBooking] = useState(false)
  const [appt, setAppt] = useState<Appointment | undefined>()
  const [visit, setVisit] = useState<Visit | null>(null)
  const [mergePick, setMergePick] = useState(false)
  const [mergeSource, setMergeSource] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [note, setNote] = useState("")

  const client = useQuery({ queryKey: ["client", id], queryFn: () => api<Client>(`/clients/${id}`), retry: false })
  const timeline = useQuery({ queryKey: ["client", id, "timeline"], queryFn: () => api<TimelineItem[]>(`/clients/${id}/timeline`) })
  const visits = useQuery({ queryKey: ["client", id, "visits"], queryFn: () => api<Visit[]>(`/clients/${id}/visits`) })
  const appts = useQuery({ queryKey: ["client", id, "appointments"], queryFn: () => api<Appointment[]>(`/clients/${id}/appointments`) })

  // Ficha unida a otra: redirige a la que quedó.
  useEffect(() => {
    const e = client.error
    if (e instanceof ApiError && e.status === 409 && typeof e.body.mergedIntoId === "string") {
      router.replace(`/clientes/${e.body.mergedIntoId}`)
    }
  }, [client.error, router])

  const refresh = () => qc.invalidateQueries({ queryKey: ["client", id] })

  const addNote = useMutation({
    mutationFn: () => api(`/clients/${id}/notes`, "POST", { body: note }),
    onSuccess: () => { setNote(""); refresh() },
    onError: (e) => toast.error(e.message),
  })
  const startVisit = useMutation({
    mutationFn: () => api<Visit>("/visits", "POST", { clientId: id }),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["today"] }); toast.success("Visita abierta: está en recepción") },
    onError: (e) => toast.error(e.message),
  })
  const merge = useMutation({
    mutationFn: (sourceId: string) => api<Client>(`/clients/${id}/merge`, "POST", { sourceId }),
    onSuccess: () => { setMergeSource(null); refresh(); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Fichas unidas") },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api(`/clients/${id}`, "DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); router.replace("/clientes"); toast.success("Ficha eliminada") },
    onError: (e) => toast.error(e.message),
  })

  if (client.isError && !(client.error instanceof ApiError && client.error.status === 409)) {
    return <p className="p-8 text-center text-muted-foreground">{client.error.message}</p>
  }
  const c = client.data
  if (!c) return null

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {c.tags.map((t) => <TagBadge key={t.id} tag={t} />)}
            {c.unsubscribedAt && <Badge variant="destructive">Dado de baja de mensajes</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => startVisit.mutate()} disabled={startVisit.isPending}><DoorOpenIcon /> Llegó</Button>
          {can("appointments.write") && (
            <Button size="lg" variant="outline" onClick={() => { setAppt(undefined); setBooking(true) }}><CalendarPlusIcon /> Agendar</Button>
          )}
          {can("clients.write") && <Button size="lg" variant="outline" onClick={() => setEditing(true)}><PencilIcon /> Editar</Button>}
          {can("clients.merge") && <Button size="lg" variant="outline" onClick={() => setMergePick(true)}><CombineIcon /> Unir duplicado</Button>}
          {can("clients.delete") && <Button size="lg" variant="ghost" onClick={() => setDeleting(true)}><Trash2Icon /></Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>Contacto</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {c.phone && <a href={`tel:+${c.phone}`} className="flex items-center gap-2 text-primary"><PhoneIcon className="size-4" /> {formatPhone(c.phone)}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-primary"><MailIcon className="size-4" /> {c.email}</a>}
              <Row label="Cumpleaños" value={formatDay(c.birthDate, "d 'de' MMMM yyyy")} />
              <Row label="Dirección" value={c.address} />
              <Row label="Prefiere aviso por" value={CONTACT_LABEL[c.contactPref]} />
              <Row label="SMS" value={c.smsConsentAt ? `Aceptó el ${formatDay(c.smsConsentAt.slice(0, 10))}` : "Sin consentimiento"} />
              <Row label="Correo" value={c.emailConsentAt ? `Aceptó el ${formatDay(c.emailConsentAt.slice(0, 10))}` : "Sin consentimiento"} />
              <Row label="Vendedora" value={c.seller?.fullName ?? "Sin asignar"} />
              <Row label="Cómo nos conoció" value={c.source} />
              <Row label="Cliente desde" value={formatDay(c.createdAt.slice(0, 10))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Examen de la vista</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Row label="Último examen" value={c.lastExamAt ? formatDay(c.lastExamAt) : "Sin examen registrado"} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Próxima revisión</span>
                <ExamBadge nextExamDue={c.nextExamDue} />
              </div>
              <p className="text-xs text-muted-foreground">Se calcula sola desde el último examen. Si se corrige la fecha, el aviso se mueve con ella.</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Historial</TabsTrigger>
            <TabsTrigger value="visits">Visitas ({visits.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="appointments">Citas ({appts.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="grid content-start gap-3">
            <form className="flex items-start gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate() }}>
              <Textarea rows={2} placeholder="Añadir una nota…" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" size="lg" disabled={!note.trim() || addNote.isPending}>Guardar</Button>
            </form>
            <ol className="grid gap-1">
              {timeline.data?.map((i, n) => (
                <li key={n} className="flex gap-3 rounded-lg p-2 hover:bg-muted/40">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {i.type === "note" && <MessageSquareIcon className="mr-1 inline size-3.5" />}
                      <span className={i.type === "note" ? "font-medium" : ""}>{i.title}</span>
                      {i.by && <span className="text-muted-foreground"> · {i.by}</span>}
                    </p>
                    {i.detail && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{i.detail}</p>}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(i.at, "d MMM yy, h:mm a")}</time>
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="visits">
            <ul className="divide-y rounded-xl border bg-card">
              {visits.data?.map((v) => (
                <li key={v.id}>
                  <button className="flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-muted/40" onClick={() => setVisit(v)}>
                    <span className="w-28 text-sm">{formatDay(v.createdAt.slice(0, 10))}</span>
                    <Badge variant={v.status === "delivered" ? "outline" : "default"}>{VISIT_LABEL[v.status]}</Badge>
                    <span className="flex-1 text-sm text-muted-foreground">
                      {[v.examDate && `Examen ${formatDay(v.examDate)}`, v.frame, v.seller?.fullName].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
              {!visits.data?.length && <li className="p-6 text-center text-sm text-muted-foreground">Sin visitas todavía.</li>}
            </ul>
          </TabsContent>

          <TabsContent value="appointments">
            <ul className="divide-y rounded-xl border bg-card">
              {appts.data?.map((a) => (
                <li key={a.id}>
                  <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40" onClick={() => { setAppt(a); setBooking(true) }}>
                    <span className="flex-1 text-sm first-letter:uppercase">{formatDateTime(a.startsAt)}</span>
                    <Badge variant="outline">{APPT_LABEL[a.status]}</Badge>
                  </button>
                </li>
              ))}
              {!appts.data?.length && <li className="p-6 text-center text-sm text-muted-foreground">Sin citas.</li>}
            </ul>
          </TabsContent>
        </Tabs>
      </div>

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={c} onSaved={refresh} />
      <AppointmentDialog open={booking} onOpenChange={setBooking} client={c} appointment={appt} />
      <VisitDialog visit={visit} onOpenChange={(o) => { if (!o) { setVisit(null); refresh() } }} />
      <ClientPicker
        open={mergePick}
        onOpenChange={setMergePick}
        title="¿Qué ficha duplicada unimos a esta?"
        onPick={(s) => (s.id === c.id ? toast.error("Elige otra ficha") : setMergeSource(s))}
      />

      <AlertDialog open={!!mergeSource} onOpenChange={(o) => !o && setMergeSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Unir la ficha de {mergeSource?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todo su historial (visitas, citas, notas y mensajes) pasa a la ficha de {c.fullName}. Los datos que falten aquí se completan con los suyos.
              La ficha de {mergeSource?.fullName} deja de aparecer. Queda registrado quién hizo la unión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mergeSource && merge.mutate(mergeSource.id)}>Unir fichas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la ficha de {c.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en listas y búsquedas y no recibirá más mensajes. Nada se borra del todo: se puede recuperar desde la base de datos si fue un error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  )
}
