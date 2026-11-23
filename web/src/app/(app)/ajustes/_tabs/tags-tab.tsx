"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { TAG_COLOR_NAMES, TagBadge } from "@/components/badges"
import { ConfirmButton } from "@/components/confirm-button"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { plural } from "@/lib/format"
import type { Tag } from "@/lib/types"

export function TagsTab() {
  const qc = useQueryClient()
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => api<Tag[]>("/tags") })
  const [name, setName] = useState("")
  const [color, setColor] = useState("slate")
  const refresh = () => qc.invalidateQueries({ queryKey: ["tags"] })
  const create = useMutation({ mutationFn: () => api("/tags", "POST", { name, color }), onSuccess: () => { setName(""); refresh() }, onError: (e) => toast.error(e.message) })
  const update = useMutation({ mutationFn: ({ id, color }: { id: string; color: string }) => api(`/tags/${id}`, "PATCH", { color }), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: string) => api(`/tags/${id}`, "DELETE"), onSuccess: () => { refresh(); toast.success("Etiqueta eliminada") }, onError: (e) => toast.error(e.message) })
  return (
    <Card>
      <CardHeader><CardTitle>Etiquetas</CardTitle><CardDescription>Para clasificar clientes y elegir a quién escribir.</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {tags.data?.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3">
              <span className="flex-1"><TagBadge tag={t} /> <span className="ml-2 text-sm text-muted-foreground">{plural(t.clients ?? 0, "cliente", "clientes")}</span></span>
              <NativeSelect className="w-32" value={t.color} onChange={(e) => update.mutate({ id: t.id, color: e.target.value })}>
                {TAG_COLOR_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
              <ConfirmButton
                variant="ghost"
                disabled={remove.isPending}
                title={`¿Eliminar la etiqueta «${t.name}»?`}
                description={t.clients ? `Se quita de ${plural(t.clients, "cliente", "clientes")}. No se puede deshacer.` : "No la tiene ningún cliente."}
                confirmLabel="Eliminar etiqueta"
                onConfirm={() => remove.mutate(t.id)}
              >
                Eliminar
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate() }}>
          <Input placeholder="Nueva etiqueta" value={name} onChange={(e) => setName(e.target.value)} />
          <NativeSelect className="w-32" value={color} onChange={(e) => setColor(e.target.value)}>
            {TAG_COLOR_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
          <Button type="submit" size="lg" disabled={!name.trim()}>Añadir</Button>
        </form>
      </CardContent>
    </Card>
  )
}
