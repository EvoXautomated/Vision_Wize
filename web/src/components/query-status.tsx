import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"

/** Aviso de carga o de error de una consulta, con botón para reintentar. No pinta nada si todo va bien. */
export function QueryStatus({ query, label }: {
  query: { isPending: boolean; isError: boolean; error: Error | null; refetch: () => unknown }
  /** Qué se está cargando, con artículo: «los clientes», «la agenda». */
  label: string
}) {
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p>
          <b>No se pudieron cargar {label}.</b>{" "}
          {query.error instanceof ApiError ? query.error.message : "Revisa la conexión del iPad e inténtalo de nuevo."}
        </p>
        <Button variant="outline" size="lg" onClick={() => query.refetch()}>Reintentar</Button>
      </div>
    )
  }
  if (query.isPending) return <p aria-live="polite" className="p-4 text-center text-sm text-muted-foreground">Cargando {label}…</p>
  return null
}
