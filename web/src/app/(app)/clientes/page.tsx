"use client"

import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, PlusIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { NewClientDialog } from "@/components/client-form"
import { ExamBadge, TagBadge } from "@/components/badges"
import { NativeSelect } from "@/components/native-select"
import { QueryStatus } from "@/components/query-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, download } from "@/lib/api"
import { formatPhone } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Client, Tag, User } from "@/lib/types"

const PAGE = 50

export default function ClientsPage() {
  const router = useRouter()
  const { can } = useSession()
  // La búsqueda, los filtros y la página viven en la URL: al volver de una
  // ficha se conservan, y se pueden guardar o compartir.
  const pathname = usePathname()
  const search = useSearchParams()
  const urlQ = search.get("q") ?? ""
  const tag = search.get("etiqueta") ?? ""
  const exam = search.get("revision") ?? ""
  const sellerId = search.get("vendedora") ?? ""
  const page = Math.max(0, (Number(search.get("pagina")) || 1) - 1)
  const [q, setQ] = useState(urlQ)
  const [creating, setCreating] = useState(false)

  const setParams = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(search)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [search, pathname, router])

  useEffect(() => {
    const value = q.trim()
    if (value === urlQ) return
    const t = setTimeout(() => setParams({ q: value, pagina: "" }), 250)
    return () => clearTimeout(t)
  }, [q, urlQ, setParams])
  // Cambiar un filtro vuelve a la primera página.
  const filter = (key: string) => (e: React.ChangeEvent<HTMLSelectElement>) => setParams({ [key]: e.target.value, pagina: "" })
  const goTo = (n: number) => setParams({ pagina: n ? String(n + 1) : "" })
  const debounced = urlQ

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
  if (debounced) params.set("q", debounced)
  if (tag) params.set("tag", tag)
  if (exam) params.set("exam", exam)
  if (sellerId) params.set("sellerId", sellerId)

  const list = useQuery({
    queryKey: ["clients", params.toString()],
    queryFn: () => api<{ items: Client[]; total: number }>(`/clients?${params}`),
    placeholderData: (prev) => prev,
  })
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => api<Tag[]>("/tags") })
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const sellers = users.data?.filter((u) => u.role === "seller") ?? []
  const total = list.data?.total ?? 0

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <div className="flex gap-2">
          {can("clients.export") && (
            <Button variant="outline" size="lg" onClick={() => download("/clients/export.csv", "clientes.csv").catch((e) => toast.error(e.message))}>
              <DownloadIcon /> Exportar a Excel
            </Button>
          )}
          {can("clients.write") && <Button size="lg" onClick={() => setCreating(true)}><PlusIcon /> Nuevo cliente</Button>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <SearchIcon aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" name="q" autoComplete="off" aria-label="Buscar clientes" className="pl-9" placeholder="Buscar por nombre, teléfono, correo o etiqueta…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect value={tag} aria-label="Etiqueta" onChange={filter("etiqueta")}>
          <option value="">Todas las etiquetas</option>
          {tags.data?.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.clients})</option>)}
        </NativeSelect>
        <NativeSelect value={exam} aria-label="Revisión" onChange={filter("revision")}>
          <option value="">Cualquier revisión</option>
          <option value="overdue">Revisión vencida</option>
          <option value="due_soon">Vence este mes</option>
        </NativeSelect>
        {can("clients.readAll") && sellers.length > 0 && (
          <NativeSelect value={sellerId} aria-label="Vendedora" onChange={filter("vendedora")}>
            <option value="">Todas las vendedoras</option>
            {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            <option value="none">Sin vendedora</option>
          </NativeSelect>
        )}
      </div>

      <QueryStatus query={list} label="los clientes" />

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Cliente</th>
              <th className="hidden p-3 font-medium md:table-cell">Contacto</th>
              <th className="hidden p-3 font-medium lg:table-cell">Vendedora</th>
              <th className="p-3 font-medium">Revisión</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.data?.items.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => router.push(`/clientes/${c.id}`)}>
                <td className="p-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium">{c.fullName}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">{c.tags.map((t) => <TagBadge key={t.id} tag={t} />)}</div>
                </td>
                <td className="hidden p-3 text-muted-foreground md:table-cell">
                  <div>{formatPhone(c.phone)}</div>
                  <div>{c.email}</div>
                </td>
                <td className="hidden p-3 lg:table-cell">{c.seller?.fullName ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="p-3"><ExamBadge nextExamDue={c.nextExamDue} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.data && !list.data.items.length && (
          <p className="p-8 text-center text-muted-foreground">{debounced ? `No hay nadie con «${debounced}».` : "Todavía no hay clientes."}</p>
        )}
      </div>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => goTo(page - 1)}>Anterior</Button>
            <Button variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => goTo(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      <NewClientDialog open={creating} onOpenChange={setCreating} onSaved={(c) => router.push(`/clientes/${c.id}`)} />
    </div>
  )
}
