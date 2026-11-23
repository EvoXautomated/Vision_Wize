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
import { useT } from "@/i18n"
import { api } from "@/lib/api"
import type { Tag } from "@/lib/types"

export function TagsTab() {
  const qc = useQueryClient()
  const { settings: { tags: t }, common } = useT()
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => api<Tag[]>("/tags") })
  const [name, setName] = useState("")
  const [color, setColor] = useState("slate")
  const refresh = () => qc.invalidateQueries({ queryKey: ["tags"] })
  const create = useMutation({ mutationFn: () => api("/tags", "POST", { name, color }), onSuccess: () => { setName(""); refresh() }, onError: (e) => toast.error(e.message) })
  const update = useMutation({ mutationFn: ({ id, color }: { id: string; color: string }) => api(`/tags/${id}`, "PATCH", { color }), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: string) => api(`/tags/${id}`, "DELETE"), onSuccess: () => { refresh(); toast.success(t.removed) }, onError: (e) => toast.error(e.message) })
  return (
    <Card>
      <CardHeader><CardTitle>{t.title}</CardTitle><CardDescription>{t.description}</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {tags.data?.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 p-3">
              <span className="flex-1"><TagBadge tag={tag} /> <span className="ml-2 text-sm text-muted-foreground">{t.clients(tag.clients ?? 0)}</span></span>
              <NativeSelect className="w-32" value={tag.color} onChange={(e) => update.mutate({ id: tag.id, color: e.target.value })}>
                {TAG_COLOR_NAMES.map((c) => <option key={c} value={c}>{t.colors[c] ?? c}</option>)}
              </NativeSelect>
              <ConfirmButton
                variant="ghost"
                disabled={remove.isPending}
                title={t.removeTitle(tag.name)}
                description={tag.clients ? t.removeBody(tag.clients) : t.removeUnused}
                confirmLabel={t.removeConfirm}
                onConfirm={() => remove.mutate(tag.id)}
              >
                {common.delete}
              </ConfirmButton>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate() }}>
          <Input placeholder={t.newPlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
          <NativeSelect className="w-32" value={color} onChange={(e) => setColor(e.target.value)}>
            {TAG_COLOR_NAMES.map((c) => <option key={c} value={c}>{t.colors[c] ?? c}</option>)}
          </NativeSelect>
          <Button type="submit" size="lg" disabled={!name.trim()}>{common.add}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
