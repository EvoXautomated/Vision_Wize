"use client"

import { useState } from "react"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Settings } from "@/lib/types"
import { useSettings } from "./use-settings"

export function BusinessTab() {
  const { settings, save } = useSettings()
  return settings ? <BusinessForm key={JSON.stringify(settings.business)} initial={settings.business} save={save} /> : null
}

function BusinessForm({ initial, save }: { initial: Settings["business"]; save: ReturnType<typeof useSettings>["save"] }) {
  const [b, setB] = useState(initial)
  const fields: [keyof Settings["business"], string][] = [
    ["name", "Nombre de la óptica"], ["phone", "Teléfono"], ["email", "Correo"],
    ["address", "Dirección"], ["website", "Página web"], ["googleReviewUrl", "Enlace para dejar reseña en Google"],
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Datos de la óptica</CardTitle><CardDescription>Se usan en los mensajes a los clientes.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <FormField key={k} label={label}><Input value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} /></FormField>
        ))}
        <Button size="lg" className="justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ business: b })}>Guardar</Button>
      </CardContent>
    </Card>
  )
}
