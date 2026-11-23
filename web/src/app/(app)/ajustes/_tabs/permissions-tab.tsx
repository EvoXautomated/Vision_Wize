"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/i18n"
import type { Role } from "@/lib/types"
import { useSettings } from "./use-settings"

// El orden de estas claves es el de las filas de la tabla.
const DEFAULTS: Record<string, Role[]> = {
  "clients.read": ["reception", "doctor", "seller"],
  "clients.write": ["reception", "seller"],
  "clients.readAll": ["reception", "doctor"],
  "sales.read": ["reception", "seller"],
  "exam.write": ["doctor"],
  "appointments.write": ["reception"],
  "clients.merge": [],
  "clients.export": [],
  "campaigns.send": [],
}
const STAFF: Role[] = ["reception", "doctor", "seller"]

export function PermissionsTab() {
  const { settings, save } = useSettings()
  const { settings: { permissions: t }, common } = useT()
  if (!settings) return null
  const current = (p: string) => settings.permissions[p] ?? DEFAULTS[p]
  const toggle = (p: string, r: Role) => {
    const roles = current(p)
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]
    save.mutate({ permissions: { ...settings.permissions, [p]: next } })
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-2 font-medium">{t.column}</th>
              {STAFF.map((r) => <th key={r} className="p-2 text-center font-medium">{common.role[r]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.keys(DEFAULTS).map((p) => (
              <tr key={p}>
                <td className="p-2">{t.labels[p] ?? p}</td>
                {STAFF.map((r) => (
                  <td key={r} className="p-2 text-center">
                    <Switch checked={current(p).includes(r)} disabled={save.isPending} onCheckedChange={() => toggle(p, r)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
