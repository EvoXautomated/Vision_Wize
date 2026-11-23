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
import { useFormat, useT } from "@/i18n"
import type { Messages } from "@/i18n/dict"
import { api, ApiError } from "@/lib/api"
import { formatPhone } from "@/lib/format"
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
  const messages = useT().clients.form.errors
  const [f, setF] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const form = useRef<HTMLFormElement>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))
  /** Marca los errores junto a su campo y enfoca el primero. Devuelve si se puede enviar. */
  const check = () => {
    const found = validate(f, messages)
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
  const all = useT()
  const t = all.clients.form
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const sellers = users.data?.filter((u) => u.active && (u.role === "seller" || u.role === "owner")) ?? []
  return (
    <>
      <FormField label={t.firstName} error={errors.firstName}><Input name="firstName" autoComplete="off" aria-required value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></FormField>
      <FormField label={t.lastName} error={errors.lastName}><Input name="lastName" autoComplete="off" aria-required value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></FormField>
      <FormField label={t.phone} error={errors.phone}><Input name="phone" type="tel" autoComplete="off" placeholder="(305) 555-0100…" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></FormField>
      <FormField label={t.email} error={errors.email}><Input name="email" type="email" autoComplete="off" spellCheck={false} value={f.email} onChange={(e) => set("email", e.target.value)} /></FormField>
      <FormField label={t.birthday}><Input name="birthDate" type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></FormField>
      <FormField label={t.seller}>
        <NativeSelect name="sellerId" value={f.sellerId} onChange={(e) => set("sellerId", e.target.value)}>
          <option value="">{t.unassigned}</option>
          {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label={t.address} className="sm:col-span-2"><Input name="address" autoComplete="off" value={f.address} onChange={(e) => set("address", e.target.value)} /></FormField>
      <FormField label={t.contactPref}>
        <NativeSelect name="contactPref" value={f.contactPref} onChange={(e) => set("contactPref", e.target.value as ContactPref)}>
          {(Object.keys(all.common.contact) as ContactPref[]).map((k) => <option key={k} value={k}>{all.common.contact[k]}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label={t.tags}><Input name="tags" autoComplete="off" placeholder={t.tagsPlaceholder} value={f.tags} onChange={(e) => set("tags", e.target.value)} /></FormField>
      <FormField label={t.source}><Input name="source" autoComplete="off" value={f.source} onChange={(e) => set("source", e.target.value)} /></FormField>
      {can("exam.write") && (
        <FormField label={t.priorExam}><Input name="priorExamAt" type="date" value={f.priorExamAt} onChange={(e) => set("priorExamAt", e.target.value)} /></FormField>
      )}

      <div className="grid gap-3 rounded-lg border p-3 sm:col-span-2">
        <p className="text-sm font-medium">{t.consent.title}</p>
        <Consent checked={f.smsConsent} onChange={(v) => set("smsConsent", v)} label={t.consent.sms} hint={smsHint} />
        <Consent checked={f.emailConsent} onChange={(v) => set("emailConsent", v)} label={t.consent.email} hint={emailHint} />
      </div>
    </>
  )
}

function DuplicatesNotice({ dups, onOpenFile }: { dups: Client[]; onOpenFile: () => void }) {
  const t = useT().clients.form.duplicates
  if (!dups.length) return null
  return (
    <div className="rounded-lg border border-warning bg-warning/10 p-3 sm:col-span-2" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangleIcon aria-hidden className="size-4" /> {t.title}
      </p>
      <ul className="mt-2 grid gap-1 text-sm">
        {dups.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words">
              <b>{d.fullName}</b>{d.restricted ? "" : ` · ${formatPhone(d.phone)} ${d.email ?? ""}`}
              <span className="text-muted-foreground">{t.matches(d.matches?.map((m) => t.field[m]) ?? [])}</span>
            </span>
            {d.restricted ? (
              <span className="text-muted-foreground">{t.fileOf(d.seller?.fullName)}</span>
            ) : (
              <Link className="text-primary underline" href={`/clientes/${d.id}`} onClick={onOpenFile}>{t.open}</Link>
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
  const all = useT()
  const t = all.clients.form
  const { f, set, errors, form, check } = useClientDraft(empty)
  const [dups, setDups] = useState<Client[]>([])
  const refresh = useClientSaved()

  // Aviso en vivo de posibles duplicados mientras se escribe.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = new URLSearchParams()
      if (f.phone.replace(/\D/g, "").length >= 10) q.set("phone", f.phone)
      if (f.email.includes("@")) q.set("email", f.email)
      if (f.firstName && f.lastName) {
        q.set("firstName", f.firstName)
        q.set("lastName", f.lastName)
      }
      setDups([...q.keys()].length ? await api<Client[]>(`/clients/duplicates?${q}`).catch(() => []) : [])
    }, 350)
    return () => clearTimeout(timer)
  }, [f.phone, f.email, f.firstName, f.lastName])

  const save = useMutation({
    mutationFn: (force: boolean) => {
      // En el alta los datos vacíos se omiten.
      const body = Object.fromEntries(Object.entries({ ...clientBody(f, can("exam.write")), force }).filter(([, v]) => v !== null && v !== ""))
      return api<Client>("/clients", "POST", body)
    },
    onSuccess: (c) => {
      refresh(c)
      toast.success(t.registered)
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
      <DialogHeader><DialogTitle>{t.newTitle}</DialogTitle></DialogHeader>
      <form ref={form} noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(false) }}>
        <ClientFields f={f} set={set} errors={errors} smsHint={t.consent.dateSaved} />
        <DuplicatesNotice dups={dups} onOpenFile={onClose} />
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>{all.common.cancel}</Button>
          {dups.length > 0 ? (
            <Button type="button" size="lg" variant="secondary" disabled={save.isPending} onClick={() => submit(true)}>
              {t.duplicates.registerAnyway}
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? t.registering : t.register}</Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ───────────── Edición ─────────────

function EditClientForm({ client, onClose, onSaved }: ClientFormProps & { client: Client }) {
  const { can } = useSession()
  const all = useT()
  const t = all.clients.form
  const fmt = useFormat()
  const consentDate = (iso: string | null) => (iso ? t.consent.givenOn(fmt.dateTime(iso, "day")) : undefined)
  const { f, set, errors, form, check } = useClientDraft(fromClient(client))
  const [dups, setDups] = useState<Client[]>([])
  const refresh = useClientSaved()

  const save = useMutation({
    // null en PATCH borra el dato.
    mutationFn: () => api<Client>(`/clients/${client.id}`, "PATCH", { ...clientBody(f, can("exam.write")), force: false }),
    onSuccess: (c) => {
      refresh(c)
      toast.success(t.updated)
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
      <DialogHeader><DialogTitle>{t.editTitle}</DialogTitle></DialogHeader>
      <form ref={form} noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (check()) save.mutate() }}>
        <ClientFields f={f} set={set} errors={errors} smsHint={consentDate(client.smsConsentAt) ?? t.consent.dateSaved} emailHint={consentDate(client.emailConsentAt)} />
        <DuplicatesNotice dups={dups} onOpenFile={onClose} />
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>{all.common.cancel}</Button>
          <Button type="submit" size="lg" disabled={save.isPending}>{save.isPending ? all.common.saving : all.common.save}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

type FieldErrors = Partial<Record<"firstName" | "lastName" | "phone" | "email", string>>

function validate(f: FormState, messages: Messages["clients"]["form"]["errors"]): FieldErrors {
  const errors: FieldErrors = {}
  if (!f.firstName.trim()) errors.firstName = messages.firstName
  if (!f.lastName.trim()) errors.lastName = messages.lastName
  const digits = f.phone.replace(/\D/g, "").length
  if (f.phone.trim() && (digits < 10 || digits > 15)) errors.phone = messages.phone
  if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) errors.email = messages.email
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
