"use client"

import { useQuery } from "@tanstack/react-query"
import { PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { NewClientDialog } from "@/components/client-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n"
import { api } from "@/lib/api"
import { formatPhone } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Client } from "@/lib/types"

/** Busca un cliente (o lo registra) y lo devuelve. */
export function ClientPicker({ open, onOpenChange, title, onPick }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  onPick: (c: Client) => void
}) {
  const { can } = useSession()
  const t = useT().clients.picker
  const [q, setQ] = useState("")
  const [creating, setCreating] = useState(false)
  const results = useQuery({
    queryKey: ["clients", "pick", q],
    queryFn: () => api<{ items: Client[] }>(`/clients?limit=8&q=${encodeURIComponent(q)}`),
    enabled: open && q.trim().length >= 2,
  })

  const pick = (c: Client) => {
    onPick(c)
    onOpenChange(false)
  }
  const change = (o: boolean) => {
    if (o) setQ("")
    onOpenChange(o)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={change}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="relative">
            <SearchIcon aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            {/* Único campo del diálogo, que se abre para buscar: el foco inicial es intencionado. */}
            <Input autoFocus type="search" name="q" autoComplete="off" aria-label={t.searchLabel} className="pl-9" placeholder={t.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="grid max-h-80 gap-1 overflow-y-auto">
            {results.data?.items.map((c) => (
              <li key={c.id}>
                <button onClick={() => pick(c)} className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-muted">
                  <span className="font-medium">{c.fullName}</span>
                  <span className="text-sm text-muted-foreground">{formatPhone(c.phone) || c.email}</span>
                </button>
              </li>
            ))}
            {results.data?.items.length === 0 && <li className="p-3 text-sm text-muted-foreground">{t.noMatch(q)}</li>}
          </ul>
          {can("clients.write") && (
            <Button variant="outline" size="lg" onClick={() => setCreating(true)}>
              <PlusIcon /> {t.registerNew}
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <NewClientDialog open={creating} onOpenChange={setCreating} onSaved={pick} />
    </>
  )
}
