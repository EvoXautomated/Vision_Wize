"use client"

import { LanguageSwitch, ThemeSwitch } from "@/components/appearance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/i18n"

export function AppearanceTab() {
  const t = useT().shell.appearance
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">{t.theme}</h3>
          <ThemeSwitch />
          <p className="text-sm text-muted-foreground">{t.systemHint}</p>
        </section>
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">{t.language}</h3>
          <LanguageSwitch />
          <p className="text-sm text-muted-foreground text-pretty">{t.languageHint}</p>
        </section>
      </CardContent>
    </Card>
  )
}
