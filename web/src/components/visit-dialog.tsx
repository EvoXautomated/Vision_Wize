"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/native-select"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { localYmd, VISIT_FLOW, VISIT_LABEL, VISIT_TARGETS } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { User, Visit, VisitStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Siguiente paso natural de la visita que este rol puede dar. */
export function nextStep(v: Visit, role: User["role"]): VisitStatus | null {
  const i = VISIT_FLOW.indexOf(v.status)
  if (i < 0) return null
  const allowed = VISIT_TARGETS[role]
  return VISIT_FLOW.slice(i + 1).find((s) => allowed.includes(s)) ?? null
}

export function useVisitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VisitStatus }) => api<Visit>(`/visits/${id}/status`, "POST", { status }),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["today"] })
      qc.invalidateQueries({ queryKey: ["client", v.client.id] })
      toast.success(`${v.client.fullName}: ${VISIT_LABEL[v.status]}`)
    },
    onError: (e) => toast.error(e.message),
  })
}

/** Detalle de la visita: fecha del examen (médico), montura (venta), vendedora y notas. */
export function VisitDialog({ visit, onOpenChange }: { visit: Visit | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!visit} onOpenChange={onOpenChange}>
      {visit && <VisitForm key={visit.id} visit={visit} onOpenChange={onOpenChange} />}
    </Dialog>
  )
}

function VisitForm({ visit, onOpenChange }: { visit: Visit; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const { user, can } = useSession()
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const [examDate, setExamDate] = useState(visit.examDate ?? "")
  const [frame, setFrame] = useState(visit.frame ?? "")
  const [sellerId, setSellerId] = useState(visit.seller?.id ?? "")
  const [notes, setNotes] = useState(visit.notes ?? "")
  const status = useVisitStatus()

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { sellerId: sellerId || null, notes }
      if (can("exam.write")) body.examDate = examDate || null
      if (can("sales.read")) body.frame = frame
      return api<Visit>(`/visits/${visit.id}`, "PATCH", body)
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["today"] })
      qc.invalidateQueries({ queryKey: ["client", v.client.id] })
      toast.success("Visita guardada")
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  if (!user) return null
  const sellers = users.data?.filter((u) => u.active && (u.role === "seller" || u.role === "owner")) ?? []
  const targets = VISIT_TARGETS[user.role]

  return (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Link href={`/clientes/${visit.client.id}`} className="hover:underline">{visit.client.fullName}</Link>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {[...VISIT_FLOW, "cancelled" as const].map((s) => {
            const current = visit.status === s
            const enabled = !current && targets.includes(s)
            return (
              <button
                key={s}
                disabled={!enabled || status.isPending}
                onClick={() => status.mutate({ id: visit.id, status: s }, { onSuccess: () => onOpenChange(false) })}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm transition",
                  current && "border-primary bg-primary text-primary-foreground",
                  !current && enabled && "hover:bg-muted",
                  !current && !enabled && "opacity-40",
                  s === "cancelled" && !current && enabled && "text-destructive",
                )}
              >
                {VISIT_LABEL[s]}
              </button>
            )
          })}
        </div>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="visit-exam-date" className="text-muted-foreground">Fecha del examen</Label>
            {can("exam.write") ? (
              <div className="flex gap-2">
                <Input id="visit-exam-date" type="date" max={localYmd()} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                <Button variant="outline" onClick={() => setExamDate(localYmd())}>Hoy</Button>
              </div>
            ) : (
              <p className="text-sm">{visit.examDate ?? "Sin examen todavía"}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Solo la fecha. El sistema no guarda graduaciones ni diagnósticos.</p>
          </div>
          {can("sales.read") && (
            <FormField label="Montura elegida o comprada"><Input placeholder="Marca, modelo y color" value={frame} onChange={(e) => setFrame(e.target.value)} /></FormField>
          )}
          <FormField label="Vendedora"><NativeSelect value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
              <option value="">Sin asignar</option>
              {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </NativeSelect></FormField>
          <FormField label="Notas de la visita"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button size="lg" disabled={save.isPending} onClick={() => save.mutate()}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
  )
}
