"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangleIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { NativeSelect } from "@/components/native-select"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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

interface ClientDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved?: (c: Client) => void
}

/** Alta de cliente. Mientras se escribe avisa si ya existe alguien parecido. */
export function NewClientDialog({ open, onOpenChange, onSaved }: ClientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <NewClientForm onClose={() => onOpenChange(false)} onSaved={onSaved} />}
    </Dialog>
  )
}

/** Edición de la ficha de un cliente. */
export function EditClientDialog({ open, onOpenChange, client, onSaved }: ClientDialogProps & { client: Client }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EditClientForm key={client.id} client={client} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
    </Dialog>
  )
}

// ───────────── Lo que comparten el alta y la edición ─────────────

/** Estado del formulario: datos, errores por campo y validación al enviar. */
function useClientDraft(initial: FormState) {
  const [f, setF] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const form = useRef<HTMLFormElement>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  /** Marca los errores junto a su campo y enfoca el primero. Devuelve si se puede enviar. */
  const check = () => {
    const found = validate(f)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
    return !first
  }
  return { f, set, errors, form, check }
}

type Draft = ReturnType<typeof useClientDraft>

/** Cuerpo de la petición a partir del formulario. */
function clientBody(f: FormState, canSetExam: boolean) {
  return {
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
    ...(canSetExam ? { priorExamAt: f.priorExamAt || null } : {}),
  }
}

/** Tras guardar: refresca las listas y la ficha. */
function useClientSaved() {
  const qc = useQueryClient()
  return (c: Client) => {
    qc.invalidateQueries({ queryKey: ["clients"] })
    qc.invalidateQueries({ queryKey: ["client", c.id] })
  }
}

const duplicatesOf = (e: Error) =>
  e instanceof ApiError && e.status === 409 && Array.isArray(e.body.duplicates) ? (e.body.duplicates as Client[]) : null

function ClientFields({ f, set, errors, smsHint, emailHint }: Pick<Draft, "f" | "set" | "errors"> & { smsHint?: string; emailHint?: string }) {
  const { can } = useSession()
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const sellers = users.data?.filter((u) => u.active && (u.role === "seller" || u.role === "owner")) ?? []
  return (
    <>
      <FormField label="Nombre *" error={errors.firstName}><Input name="firstName" autoComplete="off" aria-required value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></FormField>
      <FormField label="Apellidos *" error={errors.lastName}><Input name="lastName" autoComplete="off" aria-required value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></FormField>
      <FormField label="Teléfono" error={errors.phone}><Input name="phone" type="tel" autoComplete="off" placeholder="(305) 555-0100…" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></FormField>
      <FormField label="Correo" error={errors.email}><Input name="email" type="email" autoComplete="off" spellCheck={false} value={f.email} onChange={(e) => set("email", e.target.value)} /></FormField>
      <FormField label="Cumpleaños"><Input name="birthDate" type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></FormField>
      <FormField label="Vendedora">
        <NativeSelect name="sellerId" value={f.sellerId} onChange={(e) => set("sellerId", e.target.value)}>
          <option value="">Sin asignar</option>
          {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label="Dirección" className="sm:col-span-2"><Input name="address" autoComplete="off" value={f.address} onChange={(e) => set("address", e.target.value)} /></FormField>
      <FormField label="Prefiere que le avisemos por">
        <NativeSelect name="contactPref" value={f.contactPref} onChange={(e) => set("contactPref", e.target.value as ContactPref)}>
          {(Object.keys(CONTACT_LABEL) as ContactPref[]).map((k) => <option key={k} value={k}>{CONTACT_LABEL[k]}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label="Etiquetas (separadas por coma)"><Input name="tags" autoComplete="off" placeholder="VIP, Lentes de contacto…" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></FormField>
      <FormField label="¿Cómo nos conoció?"><Input name="source" autoComplete="off" value={f.source} onChange={(e) => set("source", e.target.value)} /></FormField>
      {can("exam.write") && (
        <FormField label="Examen anterior (si ya venía)"><Input name="priorExamAt" type="date" value={f.priorExamAt} onChange={(e) => set("priorExamAt", e.target.value)} /></FormField>
      )}

      <div className="grid gap-3 rounded-lg border p-3 sm:col-span-2">
        <p className="text-sm font-medium">Consentimiento (pregúntale al cliente)</p>
        <Consent checked={f.smsConsent} onChange={(v) => set("smsConsent", v)} label="Acepta recibir SMS de la óptica" hint={smsHint} />
        <Consent checked={f.emailConsent} onChange={(v) => set("emailConsent", v)} label="Acepta recibir correos con novedades" hint={emailHint} />
      </div>
    </>
  )
}

function DuplicatesNotice({ dups, onOpenFile }: { dups: Client[]; onOpenFile: () => void }) {
  if (!dups.length) return null
  return (
    <div className="rounded-lg border border-warning bg-warning/10 p-3 sm:col-span-2" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangleIcon aria-hidden className="size-4" /> Puede que este cliente ya exista
      </p>
      <ul className="mt-2 grid gap-1 text-sm">
        {dups.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words">
              <b>{d.fullName}</b>{d.restricted ? "" : ` · ${formatPhone(d.phone)} ${d.email ?? ""}`}
              <span className="text-muted-foreground"> — coincide {d.matches?.map((m) => ({ phone: "teléfono", email: "correo", name: "nombre" })[m]).join(" y ")}</span>
            </span>
            {d.restricted ? (
              <span className="text-muted-foreground">Ficha de {d.seller?.fullName ?? "otra vendedora"}</span>
            ) : (
              <Link className="text-primary underline" href={`/clientes/${d.id}`} onClick={onOpenFile}>Abrir su ficha</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ClientFormProps {
  onClose: () => void
  onSaved?: (c: Client) => void
}

// ───────────── Alta ─────────────

function NewClientForm({ onClose, onSaved }: ClientFormProps) {
  const { can } = useSession()
  const { f, set, errors, form, check } = useClientDraft(empty)
  const [dups, setDups] = useState<Client[]>([])
  const refresh = useClientSaved()

  // Aviso en vivo de posibles duplicados mientras se escribe.
  useEffect(() => {
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
  }, [f.phone, f.email, f.firstName, f.lastName])

  const save = useMutation({
    mutationFn: (force: boolean) => {
      // En el alta los datos vacíos se omiten.
      const body = Object.fromEntries(Object.entries({ ...clientBody(f, can("exam.write")), force }).filter(([, v]) => v !== null && v !== ""))
      return api<Client>("/clients", "POST", body)
    },
    onSuccess: (c) => {
      refresh(c)
      toast.success("Cliente registrado")
      onClose()
      onSaved?.(c)
    },
    onError: (e) => {
      setDups(duplicatesOf(e) ?? dups)
      toast.error(e.message)
    },
  })
  const submit = (force: boolean) => check() && save.mutate(force)

  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
      <form ref={form} noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(false) }}>
        <ClientFields f={f} set={set} errors={errors} smsHint="Se guarda la fecha en que lo acepta" />
        <DuplicatesNotice dups={dups} onOpenFile={onClose} />
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>Cancelar</Button>
          {dups.length > 0 ? (
            <Button type="button" size="lg" variant="secondary" disabled={save.isPending} onClick={() => submit(true)}>
              Es otra persona, registrar
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? "Registrando…" : "Registrar"}</Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ───────────── Edición ─────────────

const consentDate = (iso: string | null) => (iso ? `Dado el ${new Date(iso).toLocaleDateString("es-US")}` : undefined)

function EditClientForm({ client, onClose, onSaved }: ClientFormProps & { client: Client }) {
  const { can } = useSession()
  const { f, set, errors, form, check } = useClientDraft(fromClient(client))
  const [dups, setDups] = useState<Client[]>([])
  const refresh = useClientSaved()

  const save = useMutation({
    // null en PATCH borra el dato.
    mutationFn: () => api<Client>(`/clients/${client.id}`, "PATCH", { ...clientBody(f, can("exam.write")), force: false }),
    onSuccess: (c) => {
      refresh(c)
      toast.success("Ficha actualizada")
      onClose()
      onSaved?.(c)
    },
    onError: (e) => {
      setDups(duplicatesOf(e) ?? [])
      toast.error(e.message)
    },
  })

  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Editar ficha</DialogTitle></DialogHeader>
      <form ref={form} noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (check()) save.mutate() }}>
        <ClientFields f={f} set={set} errors={errors} smsHint={consentDate(client.smsConsentAt) ?? "Se guarda la fecha en que lo acepta"} emailHint={consentDate(client.emailConsentAt)} />
        <DuplicatesNotice dups={dups} onOpenFile={onClose} />
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

type FieldErrors = Partial<Record<"firstName" | "lastName" | "phone" | "email", string>>

function validate(f: FormState): FieldErrors {
  const errors: FieldErrors = {}
  if (!f.firstName.trim()) errors.firstName = "Escribe el nombre."
  if (!f.lastName.trim()) errors.lastName = "Escribe los apellidos."
  const digits = f.phone.replace(/\D/g, "").length
  if (f.phone.trim() && (digits < 10 || digits > 15)) errors.phone = "Revisa el teléfono: deben ser 10 dígitos, con el código de área."
  if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) errors.email = "Revisa el correo: le falta algo, como la @ o el dominio."
  return errors
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
