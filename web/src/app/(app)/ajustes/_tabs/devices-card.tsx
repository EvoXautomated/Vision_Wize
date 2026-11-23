"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmButton } from "@/components/confirm-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useFormat, useT } from "@/i18n"
import { api } from "@/lib/api"
import type { Device } from "@/lib/types"

export function DevicesCard() {
  const qc = useQueryClient()
  const t = useT().settings.devices
  const fmt = useFormat()
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => api<Device[]>("/devices") })
  const code = useMutation({
    mutationFn: () => api<{ code: string; expiresAt: string }>("/devices/pairing-code", "POST"),
    onError: (e) => toast.error(e.message),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/devices/${id}`, "DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast.success(t.removed) },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>
          {t.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {devices.data?.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{d.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {d.lastSeenAt ? t.lastUsed(fmt.dateTime(d.lastSeenAt, "day"), fmt.time(d.lastSeenAt)) : t.unused}
                </span>
              </span>
              {d.current ? (
                <Badge variant="outline">{t.current}</Badge>
              ) : (
                <ConfirmButton
                  variant="ghost"
                  disabled={revoke.isPending}
                  title={t.removeTitle(d.name)}
                  description={t.removeBody}
                  confirmLabel={t.removeConfirm}
                  onConfirm={() => revoke.mutate(d.id)}
                >
                  {t.remove}
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
        {code.data && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite">
            {t.code} <b className="text-lg tracking-widest tabular-nums" translate="no">{code.data.code.slice(0, 4)} {code.data.code.slice(4)}</b>
            <span className="block text-muted-foreground">{t.codeHint(fmt.time(code.data.expiresAt))}</span>
          </p>
        )}
        <Button size="lg" variant="outline" className="justify-self-start" disabled={code.isPending} onClick={() => code.mutate()}>
          <PlusIcon /> {t.authorize}
        </Button>
      </CardContent>
    </Card>
  )
}
