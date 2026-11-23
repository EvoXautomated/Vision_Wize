"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MailIcon, MegaphoneIcon, MessageSquareIcon, PlusIcon, SendIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { FormField } from "@/components/form-field"
import { NativeSelect } from "@/components/native-select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { formatDateTime, plural } from "@/lib/format"
import { smsParts } from "@/lib/gsm"
import { useSession } from "@/lib/session"
import type { Campaign, CampaignPreview, Segment, Settings, Tag, User } from "@/lib/types"
import { cn } from "@/lib/utils"

function segmentLabel(s: Segment, sellers: User[]) {
  const parts: string[] = []
  if (s.tags?.length) parts.push(`etiqueta ${s.tags.join(" o ")}`)
  if (s.sellerId) parts.push(s.sellerId === "none" ? "sin vendedora" : `de ${sellers.find((u) => u.id === s.sellerId)?.fullName ?? "una vendedora"}`)
  if (s.birthdayMonth) parts.push("cumplen años este mes")
  if (s.inactiveMonths) parts.push(`sin venir hace ${s.inactiveMonths} meses`)
  if (s.examOverdue) parts.push("revisión vencida")
  return parts.length ? parts.join(" · ") : "Todos los clientes"
}

export default function CampaignsPage() {
  const { can } = useSession()
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => api<Campaign[]>("/campaigns"), refetchInterval: 15_000 })
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const [editing, setEditing] = useState<Campaign | "new" | null>(null)
  const sellers = users.data?.filter((u) => u.role === "seller") ?? []

  if (!can("campaigns.send")) return <p className="p-8 text-center text-muted-foreground">No tienes permiso para enviar campañas.</p>

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Campañas</h1>
          <p className="text-muted-foreground">Mensajes a un grupo de clientes. Solo reciben quienes dieron su permiso y no se dieron de baja.</p>
        </div>
        <Button size="lg" onClick={() => setEditing("new")}><PlusIcon /> Nueva campaña</Button>
      </div>

      {campaigns.data && !campaigns.data.length && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <MegaphoneIcon className="size-8" />
          Todavía no hay campañas. Crea la primera: por ejemplo, a los que cumplen años este mes.
        </CardContent></Card>
      )}

      <ul className="grid gap-3">
        {campaigns.data?.map((c) => (
          <li key={c.id}>
            <button onClick={() => setEditing(c)} className="w-full rounded-xl border bg-card p-4 text-left transition hover:bg-muted/40">
              <div className="flex flex-wrap items-center gap-2">
                {c.channel === "sms" ? <MessageSquareIcon className="size-4 text-muted-foreground" /> : <MailIcon className="size-4 text-muted-foreground" />}
                <span className="font-medium">{c.name}</span>
                <Badge variant={c.status === "sent" ? "default" : "outline"}>{c.status === "sent" ? "Enviada" : "Borrador"}</Badge>
                <span className="ml-auto text-sm text-muted-foreground">
                  {c.sentAt ? formatDateTime(c.sentAt, "d MMM yyyy, h:mm a") : `Creada ${formatDateTime(c.createdAt, "d MMM")}`}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{segmentLabel(c.segment, sellers)}</p>
              {c.status === "sent" && <Results c={c} />}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <CampaignEditor
            key={editing === "new" ? "new" : editing.id}
            campaign={editing === "new" ? null : editing}
            sellers={sellers}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  )
}

function Results({ c }: { c: Campaign }) {
  const items = [
    { label: "Destinatarios", value: c.recipients },
    { label: "Enviados", value: c.stats.sent },
    { label: "Entregados", value: c.stats.delivered, hint: c.channel === "email" ? "solo SMS" : undefined },
    { label: "En cola", value: c.stats.queued },
    { label: "Fallidos", value: c.stats.failed },
    { label: "Bajas", value: c.stats.unsubscribed },
  ]
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg bg-muted/60 p-2 text-center">
          <div className="text-lg font-semibold tabular-nums">{i.value}</div>
          <div className="text-xs text-muted-foreground">{i.label}{i.hint ? ` (${i.hint})` : ""}</div>
        </div>
      ))}
    </div>
  )
}

function CampaignEditor({ campaign, sellers, onClose }: { campaign: Campaign | null; sellers: User[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { user } = useSession()
  const sent = campaign?.status === "sent"
  const [id, setId] = useState(campaign?.id ?? null)
  const [name, setName] = useState(campaign?.name ?? "")
  const [channel, setChannel] = useState<"sms" | "email">(campaign?.channel ?? "sms")
  const [subject, setSubject] = useState(campaign?.subject ?? "")
  const [body, setBody] = useState(campaign?.body ?? "Hola {nombre}, ")
  const [segment, setSegment] = useState<Segment>(campaign?.segment ?? {})
  const [testTo, setTestTo] = useState(user?.phone ?? "")
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => api<Tag[]>("/tags") })
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") })
  const plain = settings.data?.messages.smsPlainText ?? true

  // Cuántos lo recibirían, en vivo mientras se elige el grupo.
  useEffect(() => {
    const t = setTimeout(() => {
      api<CampaignPreview>("/campaigns/preview", "POST", { channel, segment }).then(setPreview).catch(() => undefined)
    }, 300)
    return () => clearTimeout(t)
  }, [channel, segment])

  const payload = () => ({ name, channel, subject: channel === "email" ? subject : undefined, body, segment })
  const refresh = () => qc.invalidateQueries({ queryKey: ["campaigns"] })

  const save = useMutation({
    mutationFn: () => (id ? api<Campaign>(`/campaigns/${id}`, "PATCH", payload()) : api<Campaign>("/campaigns", "POST", payload())),
    onSuccess: (c) => { setId(c.id); refresh(); toast.success("Borrador guardado") },
    onError: (e) => toast.error(e.message),
  })
  const test = useMutation({
    mutationFn: async () => {
      const c = await save.mutateAsync()
      return api<{ dryRun: boolean }>(`/campaigns/${c.id}/test`, "POST", { to: testTo })
    },
    onSuccess: (r) => toast.success(r.dryRun ? "Prueba registrada (modo prueba: falta configurar el proveedor)" : "Prueba enviada"),
    onError: (e) => toast.error(e.message),
  })
  const send = useMutation({
    mutationFn: async () => {
      const c = await save.mutateAsync()
      return api<{ recipients: number }>(`/campaigns/${c.id}/send`, "POST")
    },
    onSuccess: (r) => { refresh(); toast.success(`Enviando a ${plural(r.recipients, "cliente", "clientes")}`); onClose() },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api(`/campaigns/${id}`, "DELETE"),
    onSuccess: () => { refresh(); onClose() },
    onError: (e) => toast.error(e.message),
  })

  const sms = smsParts(body, { plain })
  const valid = name.trim() && body.trim() && (channel === "sms" || subject.trim())
  const toggleTag = (t: string) => {
    const cur = segment.tags ?? []
    setSegment({ ...segment, tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] })
  }

  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{sent ? campaign!.name : id ? "Editar campaña" : "Nueva campaña"}</DialogTitle></DialogHeader>

      {sent ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{segmentLabel(campaign!.segment, sellers)} · {campaign!.channel === "sms" ? "SMS" : "Correo"}</p>
          {campaign!.subject && <p className="text-sm"><b>Asunto:</b> {campaign!.subject}</p>}
          <p className="rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-wrap">{campaign!.body}</p>
          <Results c={campaign!} />
          {campaign!.stats.queued > 0 && (
            <p className="text-sm text-muted-foreground">Los que están en cola salen dentro del horario de envío (Ajustes → Mensajes).</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <FormField label="Nombre (solo para ti)"><Input placeholder="Navidad 2026" value={name} onChange={(e) => setName(e.target.value)} /></FormField>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Canal</span>
            <div className="flex gap-2">
              {(["sms", "email"] as const).map((ch) => (
                <Button key={ch} type="button" size="lg" variant={channel === ch ? "default" : "outline"} onClick={() => setChannel(ch)}>
                  {ch === "sms" ? <><MessageSquareIcon /> SMS</> : <><MailIcon /> Correo</>}
                </Button>
              ))}
            </div>
          </div>

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">¿A quién?</legend>
            {!!tags.data?.length && (
              <div className="flex flex-wrap gap-2">
                {tags.data.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.name)}
                    className={cn("h-9 rounded-full border px-3 text-sm", segment.tags?.includes(t.name) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Vendedora">
                <NativeSelect value={segment.sellerId ?? ""} onChange={(e) => setSegment({ ...segment, sellerId: e.target.value || undefined })}>
                  <option value="">Todas</option>
                  {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  <option value="none">Sin vendedora</option>
                </NativeSelect>
              </FormField>
              <FormField label="Que no vienen desde hace">
                <NativeSelect value={segment.inactiveMonths ?? ""} onChange={(e) => setSegment({ ...segment, inactiveMonths: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Da igual</option>
                  {[6, 12, 18, 24].map((m) => <option key={m} value={m}>{m} meses</option>)}
                </NativeSelect>
              </FormField>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              Cumplen años este mes
              <Switch checked={!!segment.birthdayMonth} onCheckedChange={(v) => setSegment({ ...segment, birthdayMonth: v || undefined })} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              Tienen la revisión vencida
              <Switch checked={!!segment.examOverdue} onCheckedChange={(v) => setSegment({ ...segment, examOverdue: v || undefined })} />
            </label>
            {preview && (
              <p className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite">
                <b>{preview.reachable}</b> {preview.reachable === 1 ? "cliente lo recibirá" : "clientes lo recibirán"}
                {preview.matched > preview.reachable && (
                  <span className="text-muted-foreground">
                    {" "}de {preview.matched} en el grupo ({preview.noConsent} sin {channel === "sms" ? "teléfono o permiso de SMS" : "correo o permiso de correo"}, o que no quieren mensajes
                    {preview.unsubscribed ? `, ${preview.unsubscribed} dados de baja` : ""})
                  </span>
                )}
                {!!preview.sample.length && <span className="block text-muted-foreground">Por ejemplo: {preview.sample.join(", ")}</span>}
              </p>
            )}
          </fieldset>

          {channel === "email" && (
            <FormField label="Asunto"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></FormField>
          )}
          <div className="grid gap-1.5">
            <FormField label="Mensaje"><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></FormField>
            <p className="text-xs text-muted-foreground">
              Puedes usar {"{nombre}"}, {"{optica}"} y {"{telefono}"}.
              {channel === "sms" && (
                <> {sms.len} caracteres con el aviso de baja · <b>{plural(sms.parts, "SMS", "SMS")}</b> por cliente.
                  {plain ? " Se envía sin tildes para que quepa en menos SMS." : !sms.gsm && " Las tildes reducen cada SMS a 70 caracteres."}</>
              )}
            </p>
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <span className="text-sm font-medium">Envío de prueba</span>
            <div className="flex gap-2">
              <Input
                aria-label={channel === "sms" ? "Teléfono de prueba" : "Correo de prueba"}
                inputMode={channel === "sms" ? "tel" : "email"}
                placeholder={channel === "sms" ? "Tu teléfono" : "Tu correo"}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <Button type="button" size="lg" variant="outline" disabled={!valid || !testTo || test.isPending} onClick={() => test.mutate()}>
                Enviar prueba
              </Button>
            </div>
          </div>
        </div>
      )}

      {!sent && (
        <DialogFooter className="flex-wrap">
          {id && <Button variant="ghost" size="lg" onClick={() => remove.mutate()}>Borrar</Button>}
          <Button variant="outline" size="lg" disabled={!valid || save.isPending} onClick={() => save.mutate()}>Guardar borrador</Button>
          <Button size="lg" disabled={!valid || !preview?.reachable || send.isPending} onClick={() => setConfirming(true)}>
            <SendIcon /> Enviar
          </Button>
        </DialogFooter>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a {plural(preview?.reachable ?? 0, "cliente", "clientes")}?</AlertDialogTitle>
            <AlertDialogDescription>
              {channel === "sms"
                ? `${(preview?.reachable ?? 0) * sms.parts === 1 ? "Es 1 SMS" : `Son ${(preview?.reachable ?? 0) * sms.parts} SMS`} en total. `
                : ""}
              Una vez enviada no se puede deshacer ni editar. Si es fuera del horario de envío, sale en cuanto se abra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => send.mutate()}>Enviar campaña</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  )
}
