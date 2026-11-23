"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useState } from "react"
import { toast } from "sonner"
import { ClientPicker } from "@/components/client-picker"
import { ConfirmButton } from "@/components/confirm-button"
import { NativeSelect } from "@/components/native-select"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useFormat, useT } from "@/i18n"
import { api } from "@/lib/api"
import type { Appointment, Settings, User } from "@/lib/types"

/** Agendar una cita nueva o mover/cancelar una existente. */
type Who = { id: string; fullName: string }

/** Agendar una cita (sin `appointment`) o ver y cambiar una que ya existe. */
export function AppointmentDialog({ open, onOpenChange, client, appointment, defaultDate }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  client?: Who
  appointment?: Appointment
  defaultDate?: string
}) {
  const close = () => onOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!open ? null : appointment ? (
        <ExistingAppointment key={appointment.id} appointment={appointment} onClose={close} />
      ) : (
        <NewAppointment key={`new-${defaultDate ?? ""}`} client={client} defaultDate={defaultDate} onClose={close} />
      )}
    </Dialog>
  )
}

// ───────────── Lo que comparten la cita nueva y la existente ─────────────

interface Draft {
  date: string
  time: string
  /** Sin elegir (null) vale la duración de los ajustes. */
  duration: number | null
  doctorId: string
  notes: string
}

/** Hora local del iPad (la tienda) → instante ISO, y el resto del cuerpo de la petición. */
const appointmentBody = (d: Draft, duration: number) => ({
  startsAt: new Date(`${d.date}T${d.time}:00`).toISOString(),
  durationMin: duration,
  doctorId: d.doctorId || null,
  notes: d.notes,
})

function useAppointmentDraft(initial: Draft) {
  const [draft, setDraft] = useState(initial)
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") })
  const duration = draft.duration ?? settings.data?.appointmentMinutes ?? 30
  return { draft, duration, change: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })) }
}

function useInvalidateAppointments(clientId?: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["appointments"] })
    qc.invalidateQueries({ queryKey: ["today"] })
    if (clientId) qc.invalidateQueries({ queryKey: ["client", clientId] })
  }
}

function AppointmentFields({ draft, duration, change, disabled }: {
  draft: Draft
  duration: number
  change: (patch: Partial<Draft>) => void
  disabled?: boolean
}) {
  const t = useT().appointments
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const doctors = users.data?.filter((u) => u.active && (u.role === "doctor" || u.role === "owner")) ?? []
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t.day}><Input name="date" type="date" disabled={disabled} value={draft.date} onChange={(e) => change({ date: e.target.value })} /></FormField>
        <FormField label={t.time}><Input name="time" type="time" step={900} disabled={disabled} value={draft.time} onChange={(e) => change({ time: e.target.value })} /></FormField>
        <FormField label={t.duration}>
          <NativeSelect name="duration" disabled={disabled} value={duration} onChange={(e) => change({ duration: Number(e.target.value) })}>
            {[...new Set([15, 20, 30, 45, 60, 90, duration])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{t.minutes(m)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t.doctor}>
          <NativeSelect name="doctorId" disabled={disabled} value={draft.doctorId} onChange={(e) => change({ doctorId: e.target.value })}>
            <option value="">{t.anyDoctor}</option>
            {doctors.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <FormField label={t.notes}><Textarea name="notes" autoComplete="off" rows={2} disabled={disabled} value={draft.notes} onChange={(e) => change({ notes: e.target.value })} /></FormField>
    </>
  )
}

function ClientLine({ label, children }: { label?: string; children: React.ReactNode }) {
  const t = useT().appointments
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label ?? t.client}</span>
      {children}
    </div>
  )
}

// ───────────── Cita nueva ─────────────

function NewAppointment({ client, defaultDate, onClose }: { client?: Who; defaultDate?: string; onClose: () => void }) {
  const t = useT().appointments
  const [who, setWho] = useState(client)
  const [picking, setPicking] = useState(false)
  const { draft, duration, change } = useAppointmentDraft({
    date: defaultDate ?? format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    duration: null,
    doctorId: "",
    notes: "",
  })
  const invalidate = useInvalidateAppointments(who?.id)
  const save = useMutation({
    mutationFn: () => api("/appointments", "POST", { ...appointmentBody(draft, duration), clientId: who!.id }),
    onSuccess: () => {
      invalidate()
      toast.success(t.scheduled)
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t.newTitle}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <ClientLine>
            {who ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <span className="min-w-0 truncate font-medium">{who.fullName}</span>
                {!client && <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>{t.change}</Button>}
              </div>
            ) : (
              <Button variant="outline" size="lg" className="w-full" onClick={() => setPicking(true)}>{t.chooseClient}</Button>
            )}
          </ClientLine>
          <AppointmentFields draft={draft} duration={duration} change={change} />
        </div>
        <DialogFooter>
          <Button size="lg" disabled={!who || !draft.date || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t.scheduling : t.schedule}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ClientPicker open={picking} onOpenChange={setPicking} title={t.pickerTitle} onPick={(c) => setWho(c)} />
    </>
  )
}

// ───────────── Cita existente ─────────────

function ExistingAppointment({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const all = useT()
  const t = all.appointments
  const fmt = useFormat()
  const start = new Date(appointment.startsAt)
  const { draft, duration, change } = useAppointmentDraft({
    date: format(start, "yyyy-MM-dd"),
    time: format(start, "HH:mm"),
    duration: appointment.durationMin,
    doctorId: appointment.doctor?.id ?? "",
    notes: appointment.notes ?? "",
  })
  const invalidate = useInvalidateAppointments(appointment.client.id)
  // Solo se cambia una cita pendiente; las demás (llegó, no vino, cancelada) se consultan.
  const open = appointment.status === "scheduled" || appointment.status === "confirmed"

  const save = useMutation({
    mutationFn: () => api(`/appointments/${appointment.id}`, "PATCH", appointmentBody(draft, duration)),
    onSuccess: () => {
      invalidate()
      toast.success(t.updated)
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })
  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/appointments/${appointment.id}/status`, "POST", { status }),
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{t.title}</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <ClientLine>
          <div className="rounded-lg border p-2.5"><span className="block truncate font-medium">{appointment.client.fullName}</span></div>
        </ClientLine>
        <AppointmentFields draft={draft} duration={duration} change={change} disabled={!open} />
        <p className="text-sm text-muted-foreground">{t.status(all.common.appointment[appointment.status])}</p>
      </div>
      {open && (
        <DialogFooter className="flex-wrap">
          <ConfirmButton
            variant="destructive"
            size="lg"
            disabled={setStatus.isPending}
            title={t.cancelTitle}
            description={t.cancelBody(appointment.client.fullName, fmt.dateTime(appointment.startsAt))}
            confirmLabel={t.cancel}
            onConfirm={() => setStatus.mutate("cancelled")}
          >
            {t.cancel}
          </ConfirmButton>
          {appointment.status === "scheduled" && (
            <Button variant="outline" size="lg" disabled={setStatus.isPending} onClick={() => setStatus.mutate("confirmed")}>{t.markConfirmed}</Button>
          )}
          <Button size="lg" disabled={!draft.date || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? all.common.saving : all.common.save}
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  )
}
