"use client"

import { useQuery } from "@tanstack/react-query"
import { PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { ClientFormDialog } from "@/components/client-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
    setQ("")
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus className="pl-9" placeholder="Nombre, teléfono o correo" value={q} onChange={(e) => setQ(e.target.value)} />
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
            {results.data?.items.length === 0 && <li className="p-3 text-sm text-muted-foreground">No hay nadie con «{q}».</li>}
          </ul>
          {can("clients.write") && (
            <Button variant="outline" size="lg" onClick={() => setCreating(true)}>
              <PlusIcon /> Registrar cliente nuevo
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <ClientFormDialog open={creating} onOpenChange={setCreating} onSaved={pick} />
    </>
  )
}
