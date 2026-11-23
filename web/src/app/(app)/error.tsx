"use client"

import { Button } from "@/components/ui/button"
import { useT } from "@/i18n"

/** Un fallo inesperado en una pantalla no deja la app en blanco: se puede reintentar. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const t = useT().common
  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-balance">{t.errorScreen.title}</h1>
      <p className="text-muted-foreground text-pretty">{t.errorScreen.body}</p>
      <Button size="lg" onClick={reset}>{t.retry}</Button>
    </div>
  )
}
