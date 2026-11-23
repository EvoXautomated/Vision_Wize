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
import { type Messages, useFormat, useT } from "@/i18n"
import { api } from "@/lib/api"
import { smsParts } from "@/lib/gsm"
import { useSession } from "@/lib/session"
import type { Campaign, CampaignPreview, Segment, Settings, Tag, User } from "@/lib/types"
import { cn } from "@/lib/utils"

/** A quién va la campaña: cada criterio es un trozo completo del diccionario. */
function segmentLabel(s: Segment, sellers: User[], t: Messages["campaigns"]["segment"]) {
  const parts: string[] = []
  if (s.tags?.length) parts.push(t.tags(s.tags))
  if (s.sellerId) parts.push(s.sellerId === "none" ? t.noSeller : t.seller(sellers.find((u) => u.id === s.sellerId)?.fullName))
  if (s.birthdayMonth) parts.push(t.birthday)
  if (s.inactiveMonths) parts.push(t.inactive(s.inactiveMonths))
  if (s.examOverdue) parts.push(t.examOverdue)
  return parts.length ? parts.join(" · ") : t.all
}

export default function CampaignsPage() {
  const { can } = useSession()
  const t = useT().campaigns
  const fmt = useFormat()
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => api<Campaign[]>("/campaigns"), refetchInterval: 15_000 })
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const [editing, setEditing] = useState<Campaign | "new" | null>(null)
  const sellers = users.data?.filter((u) => u.role === "seller") ?? []

  if (!can("campaigns.send")) return <p className="p-8 text-center text-muted-foreground">{t.noPermission}</p>

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button size="lg" onClick={() => setEditing("new")}><PlusIcon /> {t.new}</Button>
      </div>

      {campaigns.data && !campaigns.data.length && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <MegaphoneIcon className="size-8" />
          {t.empty}
        </CardContent></Card>
      )}

      <ul className="grid gap-3">
        {campaigns.data?.map((c) => (
          <li key={c.id}>
            <button onClick={() => setEditing(c)} className="w-full rounded-xl border bg-card p-4 text-left transition hover:bg-muted/40">
              <div className="flex flex-wrap items-center gap-2">
                {c.channel === "sms" ? <MessageSquareIcon className="size-4 text-muted-foreground" /> : <MailIcon className="size-4 text-muted-foreground" />}
                <span className="font-medium">{c.name}</span>
                <Badge variant={c.status === "sent" ? "default" : "outline"}>{t.status[c.status]}</Badge>
                <span className="ml-auto text-sm text-muted-foreground">
                  {c.sentAt ? t.sentAt(fmt.dateTime(c.sentAt, "day"), fmt.time(c.sentAt)) : t.created(fmt.dateTime(c.createdAt, "dayMonth"))}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{segmentLabel(c.segment, sellers, t.segment)}</p>
              {c.status === "sent" && <Results c={c} />}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && editing !== "new" && editing.status === "sent" ? (
          <SentCampaign key={editing.id} campaign={editing} sellers={sellers} />
        ) : editing ? (
          <CampaignEditor
            key={editing === "new" ? "new" : editing.id}
            campaign={editing === "new" ? null : editing}
            sellers={sellers}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </div>
  )
}

function Results({ c }: { c: Campaign }) {
  const t = useT().campaigns.results
  const items = [
    { label: t.recipients, value: c.recipients },
    { label: t.sent, value: c.stats.sent },
    { label: c.channel === "email" ? t.deliveredSmsOnly : t.delivered, value: c.stats.delivered },
    { label: t.queued, value: c.stats.queued },
    { label: t.failed, value: c.stats.failed },
    { label: t.unsubscribed, value: c.stats.unsubscribed },
  ]
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg bg-muted/60 p-2 text-center">
          <div className="text-lg font-semibold tabular-nums">{i.value}</div>
          <div className="text-xs text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  )
}

/** Campaña ya enviada: solo se consulta, con sus resultados. */
function SentCampaign({ campaign, sellers }: { campaign: Campaign; sellers: User[] }) {
  const t = useT().campaigns
  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{campaign.name}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">{segmentLabel(campaign.segment, sellers, t.segment)} · {t.channel[campaign.channel]}</p>
        {campaign.subject && <p className="text-sm"><b>{t.subjectLabel}</b> {campaign.subject}</p>}
        <p className="rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-wrap">{campaign.body}</p>
        <Results c={campaign} />
        {campaign.stats.queued > 0 && (
          <p className="text-sm text-muted-foreground">{t.queuedNote}</p>
        )}
      </div>
    </DialogContent>
  )
}

/** Borrador de campaña (nuevo o guardado): se edita, se prueba y se envía. */
function CampaignEditor({ campaign, sellers, onClose }: { campaign: Campaign | null; sellers: User[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { campaigns: t, common } = useT()
  const { user } = useSession()
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
    const timer = setTimeout(() => {
      api<CampaignPreview>("/campaigns/preview", "POST", { channel, segment }).then(setPreview).catch(() => undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [channel, segment])

  const payload = () => ({ name, channel, subject: channel === "email" ? subject : undefined, body, segment })
  const refresh = () => qc.invalidateQueries({ queryKey: ["campaigns"] })

  const save = useMutation({
    mutationFn: () => (id ? api<Campaign>(`/campaigns/${id}`, "PATCH", payload()) : api<Campaign>("/campaigns", "POST", payload())),
    onSuccess: (c) => { setId(c.id); refresh(); toast.success(t.draftSaved) },
    onError: (e) => toast.error(e.message),
  })
  const test = useMutation({
    mutationFn: async () => {
      const c = await save.mutateAsync()
      return api<{ dryRun: boolean }>(`/campaigns/${c.id}/test`, "POST", { to: testTo })
    },
    onSuccess: (r) => toast.success(r.dryRun ? t.test.dryRun : t.test.sent),
    onError: (e) => toast.error(e.message),
  })
  const send = useMutation({
    mutationFn: async () => {
      const c = await save.mutateAsync()
      return api<{ recipients: number }>(`/campaigns/${c.id}/send`, "POST")
    },
    onSuccess: (r) => { refresh(); toast.success(t.sending(r.recipients)); onClose() },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api(`/campaigns/${id}`, "DELETE"),
    onSuccess: () => { refresh(); onClose() },
    onError: (e) => toast.error(e.message),
  })

  const sms = smsParts(body, { plain })
  const valid = name.trim() && body.trim() && (channel === "sms" || subject.trim())
  const toggleTag = (tag: string) => {
    const cur = segment.tags ?? []
    setSegment({ ...segment, tags: cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag] })
  }

  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{id ? t.editor.editTitle : t.editor.newTitle}</DialogTitle></DialogHeader>

      <div className="grid gap-4">
        <FormField label={t.editor.name}><Input placeholder={t.editor.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} /></FormField>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">{t.editor.channel}</span>
          <div className="flex gap-2">
            {(["sms", "email"] as const).map((ch) => (
              <Button key={ch} type="button" size="lg" variant={channel === ch ? "default" : "outline"} onClick={() => setChannel(ch)}>
                {ch === "sms" ? <MessageSquareIcon /> : <MailIcon />} {t.channel[ch]}
              </Button>
            ))}
          </div>
        </div>

        <fieldset className="grid gap-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{t.editor.who}</legend>
          {!!tags.data?.length && (
            <div className="flex flex-wrap gap-2">
              {tags.data.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  className={cn("h-9 rounded-full border px-3 text-sm", segment.tags?.includes(tag.name) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t.editor.seller}>
              <NativeSelect value={segment.sellerId ?? ""} onChange={(e) => setSegment({ ...segment, sellerId: e.target.value || undefined })}>
                <option value="">{t.editor.allSellers}</option>
                {sellers.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                <option value="none">{t.editor.noSeller}</option>
              </NativeSelect>
            </FormField>
            <FormField label={t.editor.inactive}>
              <NativeSelect value={segment.inactiveMonths ?? ""} onChange={(e) => setSegment({ ...segment, inactiveMonths: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">{t.editor.inactiveAny}</option>
                {[6, 12, 18, 24].map((m) => <option key={m} value={m}>{t.editor.months(m)}</option>)}
              </NativeSelect>
            </FormField>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t.editor.birthday}
            <Switch checked={!!segment.birthdayMonth} onCheckedChange={(v) => setSegment({ ...segment, birthdayMonth: v || undefined })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t.editor.examOverdue}
            <Switch checked={!!segment.examOverdue} onCheckedChange={(v) => setSegment({ ...segment, examOverdue: v || undefined })} />
          </label>
          {preview && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite">
              <b>{preview.reachable}</b> {t.preview.willReceive(preview.reachable)}
              {preview.matched > preview.reachable && (
                <span className="text-muted-foreground">
                  {" "}{t.preview.ofGroup({ matched: preview.matched, noConsent: preview.noConsent, unsubscribed: preview.unsubscribed, channel })}
                </span>
              )}
              {!!preview.sample.length && <span className="block text-muted-foreground">{t.preview.sample(preview.sample.join(", "))}</span>}
            </p>
          )}
        </fieldset>

        {channel === "email" && (
          <FormField label={t.editor.subject}><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></FormField>
        )}
        <div className="grid gap-1.5">
          <FormField label={t.editor.message}><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></FormField>
          <p className="text-xs text-muted-foreground">
            {t.editor.variables}
            {channel === "sms" && (
              <> {t.sms.length(sms.len)} · <b>{t.sms.count(sms.parts)}</b> {t.sms.perClient}
                {plain ? ` ${t.sms.plainNote}` : !sms.gsm && ` ${t.sms.accentsNote}`}</>
            )}
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border p-3">
          <span className="text-sm font-medium">{t.test.title}</span>
          <div className="flex gap-2">
            <Input
              aria-label={channel === "sms" ? t.test.phoneLabel : t.test.emailLabel}
              inputMode={channel === "sms" ? "tel" : "email"}
              placeholder={channel === "sms" ? t.test.phonePlaceholder : t.test.emailPlaceholder}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button type="button" size="lg" variant="outline" disabled={!valid || !testTo || test.isPending} onClick={() => test.mutate()}>
              {t.test.send}
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter className="flex-wrap">
        {id && <Button variant="ghost" size="lg" onClick={() => remove.mutate()}>{t.editor.delete}</Button>}
        <Button variant="outline" size="lg" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{t.editor.saveDraft}</Button>
        <Button size="lg" disabled={!valid || !preview?.reachable || send.isPending} onClick={() => setConfirming(true)}>
          <SendIcon /> {t.editor.send}
        </Button>
      </DialogFooter>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirm.title(preview?.reachable ?? 0)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirm.body(channel === "sms" ? (preview?.reachable ?? 0) * sms.parts : undefined)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => send.mutate()}>{t.confirm.action}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  )
}
