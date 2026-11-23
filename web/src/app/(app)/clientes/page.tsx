"use client"

import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, PlusIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { NewClientDialog } from "@/components/client-form"
import { Avatar, nameInitials } from "@/components/avatar"
import { ExamBadge, TagBadge } from "@/components/badges"
import { NativeSelect } from "@/components/native-select"
import { QueryStatus } from "@/components/query-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n"
import { api, download } from "@/lib/api"
import { formatPhone } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Client, Tag, User } from "@/lib/types"

const PAGE = 50

export default function ClientsPage() {
  const router = useRouter()
  const { can } = useSession()
  const t = useT().clients.list
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
    const timer = setTimeout(() => setParams({ q: value, pagina: "" }), 250)
    return () => clearTimeout(timer)
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
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="flex gap-2">
          {can("clients.export") && (
            <Button variant="outline" size="lg" onClick={() => download("/clients/export.csv", t.exportFile).catch((e) => toast.error(e.message))}>
              <DownloadIcon /> {t.export}
            </Button>
          )}
          {can("clients.write") && <Button size="lg" onClick={() => setCreating(true)}><PlusIcon /> {t.newClient}</Button>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <SearchIcon aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" name="q" autoComplete="off" aria-label={t.searchLabel} className="pl-9" placeholder={t.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect value={tag} aria-label={t.tagFilter} onChange={filter("etiqueta")}>
          <option value="">{t.allTags}</option>
          {tags.data?.map((tg) => <option key={tg.id} value={tg.name}>{tg.name} ({tg.clients})</option>)}
        </NativeSelect>
        <NativeSelect value={exam} aria-label={t.examFilter} onChange={filter("revision")}>
          <option value="">{t.anyExam}</option>
          <option value="overdue">{t.examOverdue}</option>
          <option value="due_soon">{t.examDueSoon}</option>
        </NativeSelect>
        {can("clients.readAll") && sellers.length > 0 && (
          <NativeSelect value={sellerId} aria-label={t.sellerFilter} onChange={filter("vendedora")}>
            <option value="">{t.allSellers}</option>
            {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            <option value="none">{t.noSeller}</option>
          </NativeSelect>
        )}
      </div>

      <QueryStatus query={list} label={t.loadLabel} />

      <div className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_oklch(0.2_0.02_205/0.05)] ring-1 ring-foreground/8 dark:shadow-none dark:ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="p-3 font-medium">{t.colClient}</th>
              <th className="hidden p-3 font-medium md:table-cell">{t.colContact}</th>
              <th className="hidden p-3 font-medium lg:table-cell">{t.colSeller}</th>
              <th className="p-3 font-medium">{t.colExam}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.data?.items.map((c) => (
              <tr key={c.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => router.push(`/clientes/${c.id}`)}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar soft initials={nameInitials(c.fullName)} className="size-9" />
                    <div className="min-w-0">
                      <Link href={`/clientes/${c.id}`} className="font-medium">{c.fullName}</Link>
                      {c.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.tags.map((tg) => <TagBadge key={tg.id} tag={tg} />)}</div>}
                    </div>
                  </div>
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
          <p className="p-8 text-center text-muted-foreground">{debounced ? t.noMatch(debounced) : t.empty}</p>
        )}
      </div>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{t.range(page * PAGE + 1, Math.min(total, (page + 1) * PAGE), total)}</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => goTo(page - 1)}>{t.previous}</Button>
            <Button variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => goTo(page + 1)}>{t.next}</Button>
          </div>
        </div>
      )}

      <NewClientDialog open={creating} onOpenChange={setCreating} onSaved={(c) => router.push(`/clientes/${c.id}`)} />
    </div>
  )
}
