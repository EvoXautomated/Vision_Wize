"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangleIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/native-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api, ApiError } from "@/lib/api"
import { CONTACT_LABEL, formatPhone } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { Client, ContactPref, User } from "@/lib/types"

interface FormState {
  firstName: string
  lastName: string
  phone: string
  email: string
  birthDate: string
  address: string
  contactPref: ContactPref
  smsConsent: boolean
  emailConsent: boolean
  sellerId: string
  tags: string
  source: string
  priorExamAt: string
}

const empty: FormState = {
  firstName: "", lastName: "", phone: "", email: "", birthDate: "", address: "",
  contactPref: "sms", smsConsent: false, emailConsent: false, sellerId: "", tags: "", source: "", priorExamAt: "",
}

const fromClient = (c: Client): FormState => ({
  firstName: c.firstName,
  lastName: c.lastName,
  phone: c.phone ? formatPhone(c.phone) : "",
  email: c.email ?? "",
  birthDate: c.birthDate ?? "",
  address: c.address ?? "",
  contactPref: c.contactPref,
  smsConsent: !!c.smsConsentAt,
  emailConsent: !!c.emailConsentAt,
  sellerId: c.seller?.id ?? "",
  tags: c.tags.map((t) => t.name).join(", "),
  source: c.source ?? "",
  priorExamAt: c.priorExamAt ?? "",
})

/** Alta o edición de cliente. Antes de guardar avisa si ya existe alguien parecido. */
export function ClientFormDialog({ open, onOpenChange, client, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  client?: Client
  onSaved?: (c: Client) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <ClientForm key={client?.id ?? "new"} client={client} onOpenChange={onOpenChange} onSaved={onSaved} />}
    </Dialog>
  )
}

function ClientForm({ client, onOpenChange, onSaved }: {
  client?: Client
  onOpenChange: (o: boolean) => void
  onSaved?: (c: Client) => void
}) {
  const qc = useQueryClient()
  const { can } = useSession()
  const [f, setF] = useState<FormState>(() => (client ? fromClient(client) : empty))
  const [dups, setDups] = useState<Client[]>([])
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const sellers = users.data?.filter((u) => u.active && (u.role === "seller" || u.role === "owner")) ?? []

  // Aviso en vivo de posibles duplicados mientras se escribe (solo en altas).
  useEffect(() => {
    if (client) return
    const t = setTimeout(async () => {
      const q = new URLSearchParams()
      if (f.phone.replace(/\D/g, "").length >= 10) q.set("phone", f.phone)
      if (f.email.includes("@")) q.set("email", f.email)
      if (f.firstName && f.lastName) {
        q.set("firstName", f.firstName)
        q.set("lastName", f.lastName)
      }
      setDups([...q.keys()].length ? await api<Client[]>(`/clients/duplicates?${q}`).catch(() => []) : [])
    }, 350)
    return () => clearTimeout(t)
  }, [f.phone, f.email, f.firstName, f.lastName, client])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  const save = useMutation({
    mutationFn: (force: boolean) => {
      const body = {
        firstName: f.firstName,
        lastName: f.lastName,
        phone: f.phone || null,
        email: f.email || null,
        birthDate: f.birthDate || null,
        address: f.address,
        contactPref: f.contactPref,
        smsConsent: f.smsConsent,
        emailConsent: f.emailConsent,
        sellerId: f.sellerId || null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
        source: f.source,
        ...(can("exam.write") ? { priorExamAt: f.priorExamAt || null } : {}),
        force,
      }
      // null en PATCH borra el dato; en el alta se omite.
      const clean = client ? body : Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null && v !== ""))
      return client ? api<Client>(`/clients/${client.id}`, "PATCH", clean) : api<Client>("/clients", "POST", clean)
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["clients"] })
      qc.invalidateQueries({ queryKey: ["client", c.id] })
      toast.success(client ? "Ficha actualizada" : "Cliente registrado")
      onOpenChange(false)
      onSaved?.(c)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409 && Array.isArray(e.body.duplicates)) {
        setDups(e.body.duplicates as Client[])
      }
      toast.error(e.message)
    },
  })

  const valid = f.firstName.trim() && f.lastName.trim()

  return (
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? "Editar ficha" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) save.mutate(false)
          }}
        >
          <Field label="Nombre *"><Input autoFocus value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Apellidos *"><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Teléfono"><Input inputMode="tel" placeholder="(305) 555-0100" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Correo"><Input type="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Cumpleaños"><Input type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
          <Field label="Vendedora">
            <NativeSelect value={f.sellerId} onChange={(e) => set("sellerId", e.target.value)}>
              <option value="">Sin asignar</option>
              {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Dirección" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Prefiere que le avisemos por">
            <NativeSelect value={f.contactPref} onChange={(e) => set("contactPref", e.target.value as ContactPref)}>
              {(Object.keys(CONTACT_LABEL) as ContactPref[]).map((k) => <option key={k} value={k}>{CONTACT_LABEL[k]}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Etiquetas (separadas por coma)"><Input placeholder="VIP, Lentes de contacto" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
          <Field label="¿Cómo nos conoció?"><Input value={f.source} onChange={(e) => set("source", e.target.value)} /></Field>
          {can("exam.write") && (
            <Field label="Examen anterior (si ya venía)"><Input type="date" value={f.priorExamAt} onChange={(e) => set("priorExamAt", e.target.value)} /></Field>
          )}

          <div className="grid gap-3 rounded-lg border p-3 sm:col-span-2">
            <p className="text-sm font-medium">Consentimiento (pregúntale al cliente)</p>
            <Consent
              checked={f.smsConsent}
              onChange={(v) => set("smsConsent", v)}
              label="Acepta recibir SMS de la óptica"
              hint={client?.smsConsentAt ? `Dado el ${new Date(client.smsConsentAt).toLocaleDateString("es-US")}` : "Se guarda la fecha en que lo acepta"}
            />
            <Consent
              checked={f.emailConsent}
              onChange={(v) => set("emailConsent", v)}
              label="Acepta recibir correos con novedades"
              hint={client?.emailConsentAt ? `Dado el ${new Date(client.emailConsentAt).toLocaleDateString("es-US")}` : undefined}
            />
          </div>

          {dups.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning/10 p-3 sm:col-span-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangleIcon className="size-4" /> Puede que este cliente ya exista
              </p>
              <ul className="mt-2 grid gap-1 text-sm">
                {dups.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <b>{d.fullName}</b> · {formatPhone(d.phone)} {d.email}
                      <span className="text-muted-foreground"> — coincide {d.matches?.map((m) => ({ phone: "teléfono", email: "correo", name: "nombre" })[m]).join(" y ")}</span>
                    </span>
                    <Link className="text-primary underline" href={`/clientes/${d.id}`} onClick={() => onOpenChange(false)}>Abrir su ficha</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {dups.length > 0 && !client ? (
              <Button type="button" size="lg" variant="secondary" disabled={!valid || save.isPending} onClick={() => save.mutate(true)}>
                Es otra persona, registrar
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={!valid || save.isPending}>{client ? "Guardar" : "Registrar"}</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Consent({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
