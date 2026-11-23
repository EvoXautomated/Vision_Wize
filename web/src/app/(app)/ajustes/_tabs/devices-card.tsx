"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmButton } from "@/components/confirm-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import type { Device } from "@/lib/types"

export function DevicesCard() {
  const qc = useQueryClient()
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => api<Device[]>("/devices") })
  const code = useMutation({
    mutationFn: () => api<{ code: string; expiresAt: string }>("/devices/pairing-code", "POST"),
    onError: (e) => toast.error(e.message),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/devices/${id}`, "DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast.success("Dispositivo quitado") },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispositivos autorizados</CardTitle>
        <CardDescription>
          Solo desde estos dispositivos se puede entrar con PIN. Para autorizar otro, genera un código y escríbelo en ese dispositivo al abrir la app.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {devices.data?.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {d.lastSeenAt ? `Último uso: ${formatDateTime(d.lastSeenAt, "d MMM yyyy, h:mm a")}` : "Sin usar todavía"}
                </span>
              </span>
              {d.current ? (
                <Badge variant="outline">Este dispositivo</Badge>
              ) : (
                <ConfirmButton
                  variant="ghost"
                  disabled={revoke.isPending}
                  title={`¿Quitar «${d.name}»?`}
                  description="Se cierran sus sesiones y ya no se podrá entrar desde él hasta autorizarlo otra vez con un código."
                  confirmLabel="Quitar dispositivo"
                  onConfirm={() => revoke.mutate(d.id)}
                >
                  Quitar
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
        {code.data && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite">
            Código: <b className="text-lg tracking-widest tabular-nums" translate="no">{code.data.code.slice(0, 4)} {code.data.code.slice(4)}</b>
            <span className="block text-muted-foreground">Sirve una sola vez y caduca a las {formatDateTime(code.data.expiresAt, "h:mm a")}.</span>
          </p>
        )}
        <Button size="lg" variant="outline" className="justify-self-start" disabled={code.isPending} onClick={() => code.mutate()}>
          <PlusIcon /> Autorizar otro dispositivo
        </Button>
      </CardContent>
    </Card>
  )
}
