"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DownloadIcon, PlusIcon, UploadIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { TAG_COLOR_NAMES, TagBadge } from "@/components/badges"
import { NativeSelect } from "@/components/native-select"
import { Badge } from "@/components/ui/badge"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, download } from "@/lib/api"
import { MESSAGE_KIND_LABEL, ROLE_LABEL } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Role, Settings, Tag, User } from "@/lib/types"

export default function SettingsPage() {
  const { can } = useSession()
  if (!can("settings.manage")) return <p className="p-8 text-center text-muted-foreground">Solo el dueño puede ver los ajustes.</p>
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <Tabs defaultValue="team">
        <TabsList className="flex-wrap">
          <TabsTrigger value="team">Equipo</TabsTrigger>
          <TabsTrigger value="permissions">Permisos</TabsTrigger>
          <TabsTrigger value="messages">Mensajes</TabsTrigger>
          <TabsTrigger value="business">La óptica</TabsTrigger>
          <TabsTrigger value="tags">Etiquetas</TabsTrigger>
          <TabsTrigger value="data">Importar y exportar</TabsTrigger>
        </TabsList>
        <TabsContent value="team"><TeamTab /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="messages"><MessagesTab /></TabsContent>
        <TabsContent value="business"><BusinessTab /></TabsContent>
        <TabsContent value="tags"><TagsTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function useSettings() {
  const qc = useQueryClient()
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") })
  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => api<Settings>("/settings", "PUT", patch),
    onSuccess: (s) => {
      qc.setQueryData(["settings"], s)
      toast.success("Guardado")
    },
    onError: (e) => toast.error(e.message),
  })
  return { settings: settings.data, save }
}

// ───────────────────────── Equipo ─────────────────────────

function TeamTab() {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const [editing, setEditing] = useState<User | "new" | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipo</CardTitle>
        <CardDescription>Cada persona entra en el iPad con su PIN de 4 dígitos. Al cambiar un PIN o un rol se cierran sus sesiones.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {users.data?.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{u.initials}</span>
              <span className="flex-1">
                <span className="block font-medium">{u.fullName}</span>
                <span className="block text-sm text-muted-foreground">{ROLE_LABEL[u.role]}{u.email ? ` · ${u.email}` : ""}</span>
              </span>
              {!u.active && <Badge variant="outline">Inactivo</Badge>}
              <Button variant="outline" onClick={() => setEditing(u)}>Editar</Button>
            </li>
          ))}
        </ul>
        <Button size="lg" className="justify-self-start" onClick={() => setEditing("new")}><PlusIcon /> Añadir persona</Button>
      </CardContent>
      <UserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["team"] }) }}
      />
    </Card>
  )
}

function UserDialog({ user, onClose, onSaved }: { user: User | "new" | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      {user && <UserForm key={user === "new" ? "new" : user.id} user={user} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  )
}

function UserForm({ user, onClose, onSaved }: { user: User | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = user === "new"
  const existing = isNew ? null : user
  const [fullName, setFullName] = useState(existing?.fullName ?? "")
  const [role, setRole] = useState<Role>(existing?.role ?? "seller")
  const [email, setEmail] = useState(existing?.email ?? "")
  const [pin, setPin] = useState("")
  const [active, setActive] = useState(existing?.active ?? true)

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { fullName, role, ...(email ? { email } : {}), ...(pin ? { pin } : {}) }
      if (isNew) return api("/users", "POST", body)
      return api(`/users/${(user as User).id}`, "PATCH", { ...body, active })
    },
    onSuccess: () => { onSaved(); onClose(); toast.success("Guardado") },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api(`/users/${(user as User).id}`, "DELETE"),
    onSuccess: () => { onSaved(); onClose(); toast.success("Persona dada de baja") },
    onError: (e) => toast.error(e.message),
  })

  const pinOk = isNew ? /^\d{4}$/.test(pin) : pin === "" || /^\d{4}$/.test(pin)
  return (
      <DialogContent>
        <DialogHeader><DialogTitle>{isNew ? "Añadir persona" : "Editar persona"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <FormField label="Nombre"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></FormField>
          <FormField label="Rol"><NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </NativeSelect></FormField>
          <FormField label="Correo (opcional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
          <FormField label={isNew ? "PIN de 4 dígitos" : "Nuevo PIN (déjalo vacío para no cambiarlo)"}><Input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></FormField>
          {!isNew && (
            <label className="flex items-center justify-between"><span className="text-sm">Activo (puede entrar)</span><Switch checked={active} onCheckedChange={setActive} /></label>
          )}
        </div>
        <DialogFooter>
          {!isNew && <Button variant="destructive" size="lg" onClick={() => remove.mutate()}>Dar de baja</Button>}
          <Button size="lg" disabled={fullName.trim().length < 2 || !pinOk || save.isPending} onClick={() => save.mutate()}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
  )
}

// ───────────────────────── Permisos ─────────────────────────

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

function PermissionsTab() {
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

// ───────────────────────── Mensajes ─────────────────────────

const AUTO_KINDS = ["exam_reminder", "appt_confirmation", "appt_reminder", "ready", "welcome", "birthday"]
const TEMPLATE_KINDS = ["exam_reminder", "exam_reminder_2", "appt_confirmation", "appt_reminder", "ready", "welcome", "birthday"]

function MessagesTab() {
  const { settings, save } = useSettings()
  return settings ? <MessagesForm key={JSON.stringify(settings.messages)} settings={settings} save={save} /> : null
}

function MessagesForm({ settings, save }: { settings: Settings; save: ReturnType<typeof useSettings>["save"] }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings))
  const recent = useQuery({
    queryKey: ["messages"],
    queryFn: () => api<{ id: string; kind: string; channel: string; status: string; error: string | null; createdAt: string; client: { firstName: string; lastName: string } | null }[]>("/messages"),
  })
  const run = useMutation({
    mutationFn: () => api<{ created: number; reminders: number; sent: number }>("/messages/run", "POST"),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["messages"] }); qc.invalidateQueries({ queryKey: ["calls"] }); toast.success(`${r.created + r.reminders} avisos nuevos, ${r.sent} enviados`) },
    onError: (e) => toast.error(e.message),
  })
  const m = draft.messages
  const setM = (patch: Partial<Settings["messages"]>) => setDraft({ ...draft, messages: { ...m, ...patch } })

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Seguimiento automático</CardTitle>
          <CardDescription>
            Los avisos salen solos dentro del horario de envío. Quien se dio de baja no recibe recordatorios, bienvenida ni cumpleaños.
            Si un cliente no tiene SMS ni correo con permiso, el recordatorio va a la lista «Por llamar».
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {AUTO_KINDS.map((k) => (
              <label key={k} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{MESSAGE_KIND_LABEL[k]}</span>
                <Switch checked={m.enabled[k] !== false} onCheckedChange={(v) => setM({ enabled: { ...m.enabled, [k]: v } })} />
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <NumberField label="Revisión a los (meses)" value={draft.examReminderMonths} onChange={(v) => setDraft({ ...draft, examReminderMonths: v })} />
            <NumberField label="Segundo aviso tras (días, 0 = no)" value={draft.secondReminderDays} onChange={(v) => setDraft({ ...draft, secondReminderDays: v })} />
            <NumberField label="Enviar desde (hora)" value={m.sendFromHour} onChange={(v) => setM({ sendFromHour: v })} />
            <NumberField label="Enviar hasta (hora)" value={m.sendToHour} onChange={(v) => setM({ sendToHour: v })} />
          </div>
          <FormField label="Firma de los mensajes"><Input value={m.signature} onChange={(e) => setM({ signature: e.target.value })} /></FormField>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Textos. Puedes usar {"{nombre}"}, {"{optica}"}, {"{telefono}"}, {"{fecha}"}, {"{hora}"} y {"{resena}"}.</p>
            {TEMPLATE_KINDS.map((k) => (
              <FormField key={k} label={MESSAGE_KIND_LABEL[k]}><Textarea rows={2} value={m.templates[k] ?? ""} onChange={(e) => setM({ templates: { ...m.templates, [k]: e.target.value } })} /></FormField>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={save.isPending} onClick={() => save.mutate({
              messages: draft.messages,
              examReminderMonths: draft.examReminderMonths,
              secondReminderDays: draft.secondReminderDays,
            })}>Guardar</Button>
            <Button size="lg" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>Revisar y enviar ahora</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Últimos mensajes</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {recent.data?.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-36 text-muted-foreground">{new Date(x.createdAt).toLocaleString("es-US", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="flex-1">{x.client ? `${x.client.firstName} ${x.client.lastName}` : "—"} · {MESSAGE_KIND_LABEL[x.kind] ?? x.kind}</span>
                <Badge variant="outline">{x.channel === "call" ? "llamada" : x.channel}</Badge>
                <Badge variant={x.status === "failed" ? "destructive" : x.status === "skipped" ? "secondary" : "default"}>
                  {({ queued: "pendiente", sent: "enviado", delivered: "entregado", failed: "falló", skipped: "no enviado", done: "hecho" } as Record<string, string>)[x.status]}
                </Badge>
                {x.error && <span className="w-full text-xs text-muted-foreground">{x.error}</span>}
              </li>
            ))}
            {!recent.data?.length && <li className="py-4 text-muted-foreground">Todavía no se ha enviado nada.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <FormField label={label}><Input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} /></FormField>
  )
}

// ───────────────────────── La óptica ─────────────────────────

function BusinessTab() {
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

// ───────────────────────── Etiquetas ─────────────────────────

function TagsTab() {
  const qc = useQueryClient()
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => api<Tag[]>("/tags") })
  const [name, setName] = useState("")
  const [color, setColor] = useState("slate")
  const refresh = () => qc.invalidateQueries({ queryKey: ["tags"] })
  const create = useMutation({ mutationFn: () => api("/tags", "POST", { name, color }), onSuccess: () => { setName(""); refresh() }, onError: (e) => toast.error(e.message) })
  const update = useMutation({ mutationFn: ({ id, color }: { id: string; color: string }) => api(`/tags/${id}`, "PATCH", { color }), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: string) => api(`/tags/${id}`, "DELETE"), onSuccess: () => { refresh(); toast.success("Etiqueta eliminada") } })
  return (
    <Card>
      <CardHeader><CardTitle>Etiquetas</CardTitle><CardDescription>Para clasificar clientes y elegir a quién escribir.</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {tags.data?.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3">
              <span className="flex-1"><TagBadge tag={t} /> <span className="ml-2 text-sm text-muted-foreground">{t.clients} clientes</span></span>
              <NativeSelect className="w-32" value={t.color} onChange={(e) => update.mutate({ id: t.id, color: e.target.value })}>
                {TAG_COLOR_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
              <Button variant="ghost" onClick={() => remove.mutate(t.id)}>Eliminar</Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate() }}>
          <Input placeholder="Nueva etiqueta" value={name} onChange={(e) => setName(e.target.value)} />
          <NativeSelect className="w-32" value={color} onChange={(e) => setColor(e.target.value)}>
            {TAG_COLOR_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
          <Button type="submit" size="lg" disabled={!name.trim()}>Añadir</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ───────────────────────── Importar y exportar ─────────────────────────

interface ImportReport {
  dryRun: boolean
  summary: { total: number; new: number; duplicates: number; errors: number }
  unknownColumns: string[]
  rows: { row: number; name: string; status: "new" | "duplicate" | "error"; errors: string[]; duplicateOf?: string }[]
}

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  let table: unknown[][]
  if (/\.csv$/i.test(file.name)) {
    table = parseCsv(await file.text())
  } else {
    const { readSheet } = await import("read-excel-file/browser")
    table = (await readSheet(file)) as unknown[][]
  }
  const [head, ...body] = table
  if (!head) return []
  const headers = head.map((h) => String(h ?? "").trim())
  return body
    .filter((r) => r.some((c) => c !== null && c !== ""))
    .map((r) =>
      Object.fromEntries(
        headers.map((h, i) => {
          const v = r[i]
          return [h, v instanceof Date ? v.toISOString().slice(0, 10) : v ?? ""]
        }),
      ),
    )
}

/** CSV con comillas; detecta ';' (Excel en español) o ','. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const first = src.split(/\r?\n/, 1)[0] ?? ""
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function DataTab() {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [report, setReport] = useState<ImportReport | null>(null)

  const check = useMutation({
    mutationFn: (dryRun: boolean) => api<ImportReport>("/clients/import", "POST", { rows, dryRun }),
    onSuccess: (r) => {
      setReport(r)
      if (!r.dryRun) {
        qc.invalidateQueries({ queryKey: ["clients"] })
        toast.success(`${r.summary.new} clientes importados`)
        setRows(null)
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const data = await readRows(f)
      setFileName(f.name)
      setRows(data)
      setReport(null)
    } catch {
      toast.error("No se pudo leer el archivo. Guárdalo como Excel (.xlsx) o CSV.")
    }
  }

  // El informe se pide en cuanto se leen las filas del archivo.
  const { mutate } = check
  useEffect(() => {
    if (rows) mutate(true)
  }, [rows, mutate])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Importar clientes desde Excel</CardTitle>
          <CardDescription>
            Columnas que se reconocen: Nombre, Apellidos (o Nombre completo), Teléfono, Correo, Fecha de nacimiento, Dirección, Último examen, Etiquetas y Notas.
            Primero verás un informe; nada se guarda hasta que confirmes. Los importados no reciben mensajes de marketing hasta que den su consentimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = "" }} />
          <Button size="lg" variant="outline" className="justify-self-start" onClick={() => input.current?.click()}><UploadIcon /> Elegir archivo</Button>
          {report && (
            <div className="grid gap-3">
              <p className="text-sm">
                <b>{fileName}</b>: {report.summary.total} filas · <span className="text-success">{report.summary.new} nuevos</span> ·{" "}
                {report.summary.duplicates} ya existen · <span className="text-destructive">{report.summary.errors} con errores</span>
              </p>
              {report.unknownColumns.length > 0 && (
                <p className="text-sm text-muted-foreground">Columnas que no se importan: {report.unknownColumns.join(", ")}</p>
              )}
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {report.rows.filter((r) => r.status !== "new").map((r) => (
                      <tr key={r.row}>
                        <td className="w-16 p-2 text-muted-foreground">Fila {r.row}</td>
                        <td className="p-2">{r.name || "—"}</td>
                        <td className="p-2">{r.status === "error" ? <span className="text-destructive">{r.errors.join("; ")}</span> : `Ya existe (${r.duplicateOf})`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.dryRun && report.summary.new > 0 && (
                <Button size="lg" className="justify-self-start" disabled={check.isPending} onClick={() => check.mutate(false)}>
                  Importar {report.summary.new} clientes nuevos
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Exportar</CardTitle><CardDescription>Toda la lista de clientes en un archivo que abre Excel.</CardDescription></CardHeader>
        <CardContent>
          <Button size="lg" variant="outline" onClick={() => download("/clients/export.csv", "clientes.csv").catch((e) => toast.error(e.message))}>
            <DownloadIcon /> Descargar clientes
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
