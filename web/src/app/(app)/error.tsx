"use client"

import { Button } from "@/components/ui/button"

/** Un fallo inesperado en una pantalla no deja la app en blanco: se puede reintentar. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-balance">Algo salió mal en esta pantalla</h1>
      <p className="text-muted-foreground text-pretty">Vuelve a intentarlo. Si sigue pasando, cierra la app y ábrela de nuevo.</p>
      <Button size="lg" onClick={reset}>Reintentar</Button>
    </div>
  )
}
