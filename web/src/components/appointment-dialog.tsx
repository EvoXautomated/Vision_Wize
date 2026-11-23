"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useState } from "react"
import { toast } from "sonner"
import { ClientPicker } from "@/components/client-picker"
import { NativeSelect } from "@/components/native-select"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { APPT_LABEL } from "@/lib/format"
import type { Appointment, Settings, User } from "@/lib/types"

/** Agendar una cita nueva o mover/cancelar una existente. */
export function AppointmentDialog({ open, onOpenChange, client, appointment, defaultDate }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  client?: { id: string; fullName: string }
  appointment?: Appointment
  defaultDate?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AppointmentForm
          key={appointment?.id ?? `new-${defaultDate ?? ""}`}
          onOpenChange={onOpenChange}
          client={client}
          appointment={appointment}
          defaultDate={defaultDate}
        />
      )}
    </Dialog>
  )
}

function AppointmentForm({ onOpenChange, client, appointment, defaultDate }: {
  onOpenChange: (o: boolean) => void
  client?: { id: string; fullName: string }
  appointment?: Appointment
  defaultDate?: string
}) {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") })
  const start = appointment ? new Date(appointment.startsAt) : null
  const [who, setWho] = useState(appointment?.client ?? client)
  const [picking, setPicking] = useState(false)
  const [date, setDate] = useState(start ? format(start, "yyyy-MM-dd") : (defaultDate ?? format(new Date(), "yyyy-MM-dd")))
  const [time, setTime] = useState(start ? format(start, "HH:mm") : "10:00")
  const [duration, setDuration] = useState(appointment?.durationMin ?? settings.data?.appointmentMinutes ?? 30)
  const [doctorId, setDoctorId] = useState(appointment?.doctor?.id ?? "")
  const [notes, setNotes] = useState(appointment?.notes ?? "")

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["appointments"] })
    qc.invalidateQueries({ queryKey: ["today"] })
    if (who) qc.invalidateQueries({ queryKey: ["client", who.id] })
  }

  const save = useMutation({
    mutationFn: () => {
      // Hora local del iPad (la tienda) → instante ISO.
      const startsAt = new Date(`${date}T${time}:00`).toISOString()
      const body = { startsAt, durationMin: duration, doctorId: doctorId || null, notes }
      return appointment
        ? api(`/appointments/${appointment.id}`, "PATCH", body)
        : api("/appointments", "POST", { ...body, clientId: who!.id })
    },
    onSuccess: () => {
      invalidate()
      toast.success(appointment ? "Cita actualizada" : "Cita agendada. Se envió la confirmación.")
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/appointments/${appointment!.id}/status`, "POST", { status }),
    onSuccess: () => {
      invalidate()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const doctors = users.data?.filter((u) => u.active && (u.role === "doctor" || u.role === "owner")) ?? []
  const editable = !appointment || appointment.status === "scheduled" || appointment.status === "confirmed"

  return (
    <>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{appointment ? "Cita" : "Agendar cita"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Cliente</span>
              {who ? (
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="font-medium">{who.fullName}</span>
                  {!client && !appointment && <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>Cambiar</Button>}
                </div>
              ) : (
                <Button variant="outline" size="lg" className="w-full" onClick={() => setPicking(true)}>Elegir cliente</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Día"><Input type="date" disabled={!editable} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
              <FormField label="Hora"><Input type="time" step={900} disabled={!editable} value={time} onChange={(e) => setTime(e.target.value)} /></FormField>
              <FormField label="Duración"><NativeSelect disabled={!editable} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                </NativeSelect></FormField>
              <FormField label="Médico"><NativeSelect disabled={!editable} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  <option value="">Cualquiera</option>
                  {doctors.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </NativeSelect></FormField>
            </div>
            <FormField label="Notas"><Textarea rows={2} disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
            {appointment && <p className="text-sm text-muted-foreground">Estado: {APPT_LABEL[appointment.status]}</p>}
          </div>
          <DialogFooter className="flex-wrap">
            {appointment && editable && (
              <>
                <Button variant="destructive" size="lg" onClick={() => setStatus.mutate("cancelled")}>Cancelar cita</Button>
                {appointment.status === "scheduled" && (
                  <Button variant="outline" size="lg" onClick={() => setStatus.mutate("confirmed")}>Marcar confirmada</Button>
                )}
              </>
            )}
            {editable && (
              <Button size="lg" disabled={!who || !date || save.isPending} onClick={() => save.mutate()}>
                {appointment ? "Guardar" : "Agendar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      <ClientPicker open={picking} onOpenChange={setPicking} title="¿Para quién es la cita?" onPick={(c) => setWho(c)} />
    </>
  )
}
