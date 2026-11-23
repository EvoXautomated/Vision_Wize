"use client"

import { useState } from "react"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n"
import type { Settings } from "@/lib/types"
import { useSettings } from "./use-settings"

export function BusinessTab() {
  const { settings, save } = useSettings()
  return settings ? <BusinessForm key={JSON.stringify(settings.business)} initial={settings.business} save={save} /> : null
}

const FIELDS: (keyof Settings["business"])[] = ["name", "phone", "email", "address", "website", "googleReviewUrl"]

function BusinessForm({ initial, save }: { initial: Settings["business"]; save: ReturnType<typeof useSettings>["save"] }) {
  const [b, setB] = useState(initial)
  const { settings: { business: t }, common } = useT()
  return (
    <Card>
      <CardHeader><CardTitle>{t.title}</CardTitle><CardDescription>{t.description}</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((k) => (
          <FormField key={k} label={t.fields[k]}><Input value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} /></FormField>
        ))}
        <Button size="lg" className="justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ business: b })}>{common.save}</Button>
      </CardContent>
    </Card>
  )
}
