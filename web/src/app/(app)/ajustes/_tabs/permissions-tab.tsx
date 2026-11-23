"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ROLE_LABEL } from "@/lib/format"
import type { Role } from "@/lib/types"
import { useSettings } from "./use-settings"

const PERMISSION_LABEL: Record<string, string> = {
  "clients.read": "Ver fichas de clientes",
  "clients.write": "Registrar y editar clientes",
  "clients.readAll": "Ver clientes de otras vendedoras",
  "sales.read": "Ver la montura y las compras",
  "exam.write": "Poner o corregir la fecha del examen",
  "appointments.write": "Agendar, mover y cancelar citas",
  "clients.merge": "Unir fichas duplicadas",
  "clients.export": "Exportar clientes a Excel",
  "campaigns.send": "Enviar campañas",
}
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
        <CardTitle>Qué puede hacer cada rol</CardTitle>
        <CardDescription>El dueño siempre puede todo. El equipo, los ajustes, borrar fichas e importar son solo del dueño.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-2 font-medium">Permiso</th>
              {STAFF.map((r) => <th key={r} className="p-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.keys(PERMISSION_LABEL).map((p) => (
              <tr key={p}>
                <td className="p-2">{PERMISSION_LABEL[p]}</td>
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
