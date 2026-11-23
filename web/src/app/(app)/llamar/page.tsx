"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PhoneIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { QueryStatus } from "@/components/query-status"
import { Button } from "@/components/ui/button"
import { useFormat, useT } from "@/i18n"
import { api } from "@/lib/api"
import { formatPhone } from "@/lib/format"
import type { CallItem } from "@/lib/types"

const OUTCOMES = ["booked", "leftMessage", "willCall", "notInterested"] as const

/** Avisos para clientes sin SMS ni correo con permiso: se les llama. */
export default function CallsPage() {
  const qc = useQueryClient()
  const t = useT()
  const fmt = useFormat()
  const calls = useQuery({ queryKey: ["calls"], queryFn: () => api<CallItem[]>("/calls") })
  const done = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: string }) => api(`/calls/${id}/done`, "POST", { outcome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calls"] })
      qc.invalidateQueries({ queryKey: ["today"] })
      toast.success(t.calls.recorded)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.calls.title}</h1>
        <p className="text-muted-foreground">{t.calls.subtitle}</p>
      </div>
      <QueryStatus query={calls} label={t.calls.queryLabel} />
      {calls.data && !calls.data.length && (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">{t.calls.empty}</p>
      )}
      <ul className="grid gap-3">
        {calls.data?.map((c) => (
          <li key={c.id} className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/clientes/${c.client.id}`} className="font-medium hover:underline">{c.client.firstName} {c.client.lastName}</Link>
                <p className="text-sm text-muted-foreground">
                  {t.common.messageKind[c.kind] ?? c.kind} · {fmt.ago(c.createdAt)}
                  {c.client.lastExamAt && ` · ${t.calls.lastExam(fmt.day(c.client.lastExamAt))}`}
                </p>
              </div>
              {c.client.phone && (
                <Button size="lg" render={<a href={`tel:+${c.client.phone}`} />}><PhoneIcon /> {formatPhone(c.client.phone)}</Button>
              )}
            </div>
            <p className="rounded-lg bg-muted/60 p-3 text-sm">{t.calls.whatToSay(c.body)}</p>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                // Se guarda el texto del botón, en el idioma de quien llama.
                <Button key={o} variant="outline" size="lg" disabled={done.isPending} onClick={() => done.mutate({ id: c.id, outcome: t.calls.outcomes[o] })}>{t.calls.outcomes[o]}</Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
