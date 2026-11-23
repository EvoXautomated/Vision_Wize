"use client"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/i18n"
import { ApiError } from "@/lib/api"

/** Aviso de carga o de error de una consulta, con botón para reintentar. No pinta nada si todo va bien. */
export function QueryStatus({ query, label }: {
  query: { isPending: boolean; isError: boolean; error: Error | null; refetch: () => unknown }
  /** Qué se está cargando, ya traducido y con artículo: «los clientes», «the clients». */
  label: string
}) {
  const t = useT().common
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p>
          <b>{t.loadError(label)}</b>{" "}
          {query.error instanceof ApiError ? query.error.message : t.loadErrorHint}
        </p>
        <Button variant="outline" size="lg" onClick={() => query.refetch()}>{t.retry}</Button>
      </div>
    )
  }
  if (query.isPending) {
    return (
      <div aria-live="polite" className="grid gap-3 py-2">
        <span className="sr-only">{t.loading(label)}</span>
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl opacity-70" />
        <Skeleton className="h-14 rounded-xl opacity-40" />
      </div>
    )
  }
  return null
}
