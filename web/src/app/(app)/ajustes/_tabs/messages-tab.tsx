"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useLocale, useT } from "@/i18n"
import { api } from "@/lib/api"
import { smsParts } from "@/lib/gsm"
import { cn } from "@/lib/utils"
import type { Settings } from "@/lib/types"
import { useSettings } from "./use-settings"

const AUTO_KINDS = ["exam_reminder", "appt_confirmation", "appt_reminder", "ready", "welcome", "birthday"]
const TEMPLATE_KINDS = ["exam_reminder", "exam_reminder_2", "appt_confirmation", "appt_reminder", "ready", "welcome", "birthday"]

export function MessagesTab() {
  const { settings, save } = useSettings()
  return settings ? <MessagesForm key={JSON.stringify(settings.messages)} settings={settings} save={save} /> : null
}

function MessagesForm({ settings, save }: { settings: Settings; save: ReturnType<typeof useSettings>["save"] }) {
  const qc = useQueryClient()
  const { settings: { messages: t }, common } = useT()
  const { locale } = useLocale()
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings))
  const recent = useQuery({
    queryKey: ["messages"],
    queryFn: () => api<{ id: string; kind: string; channel: string; status: string; error: string | null; createdAt: string; client: { firstName: string; lastName: string } | null }[]>("/messages"),
  })
  const run = useMutation({
    mutationFn: () => api<{ created: number; reminders: number; sent: number }>("/messages/run", "POST"),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["messages"] }); qc.invalidateQueries({ queryKey: ["calls"] }); toast.success(t.runDone(r.created + r.reminders, r.sent)) },
    onError: (e) => toast.error(e.message),
  })
  const m = draft.messages
  const setM = (patch: Partial<Settings["messages"]>) => setDraft({ ...draft, messages: { ...m, ...patch } })

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {AUTO_KINDS.map((k) => (
              <label key={k} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{common.messageKind[k]}</span>
                <Switch checked={m.enabled[k] !== false} onCheckedChange={(v) => setM({ enabled: { ...m.enabled, [k]: v } })} />
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <NumberField label={t.examMonths} value={draft.examReminderMonths} onChange={(v) => setDraft({ ...draft, examReminderMonths: v })} />
            <NumberField label={t.secondReminderDays} value={draft.secondReminderDays} onChange={(v) => setDraft({ ...draft, secondReminderDays: v })} />
            <NumberField label={t.sendFrom} value={m.sendFromHour} onChange={(v) => setM({ sendFromHour: v })} />
            <NumberField label={t.sendTo} value={m.sendToHour} onChange={(v) => setM({ sendToHour: v })} />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm">{t.plainSms}</span>
              <span className="block text-xs text-muted-foreground">
                {t.plainSmsHint}
              </span>
            </span>
            <Switch checked={m.smsPlainText} onCheckedChange={(v) => setM({ smsPlainText: v })} />
          </label>
          <FormField label={t.signature}><Input value={m.signature} onChange={(e) => setM({ signature: e.target.value })} /></FormField>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{t.variables}</p>
            {TEMPLATE_KINDS.map((k) => (
              <div key={k} className="grid gap-1">
                <FormField label={common.messageKind[k]}><Textarea rows={2} value={m.templates[k] ?? ""} onChange={(e) => setM({ templates: { ...m.templates, [k]: e.target.value } })} /></FormField>
                <SmsCount text={m.templates[k] ?? ""} kind={k} plain={m.smsPlainText} signature={m.signature} phone={draft.business.phone} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={save.isPending} onClick={() => save.mutate({
              messages: draft.messages,
              examReminderMonths: draft.examReminderMonths,
              secondReminderDays: draft.secondReminderDays,
            })}>{common.save}</Button>
            <Button size="lg" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>{t.runNow}</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t.recent}</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {recent.data?.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-36 text-muted-foreground">{new Date(x.createdAt).toLocaleString(locale === "es" ? "es-US" : "en-US", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="flex-1">{x.client ? `${x.client.firstName} ${x.client.lastName}` : "—"} · {common.messageKind[x.kind] ?? x.kind}</span>
                <Badge variant="outline">{t.channel[x.channel] ?? x.channel}</Badge>
                <Badge variant={x.status === "failed" ? "destructive" : x.status === "skipped" ? "secondary" : "default"}>
                  {t.status[x.status]}
                </Badge>
                {x.error && <span className="w-full text-xs text-muted-foreground">{x.error}</span>}
              </li>
            ))}
            {!recent.data?.length && <li className="py-4 text-muted-foreground">{t.recentEmpty}</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

const MARKETING_KINDS = ["exam_reminder", "exam_reminder_2", "welcome", "birthday"]

/** Cuántos SMS cuesta un texto automático, con valores de ejemplo en las variables. */
function SmsCount({ text, kind, plain, signature, phone }: { text: string; kind: string; plain: boolean; signature: string; phone: string }) {
  const t = useT().settings.messages
  // Valores de ejemplo para medir el texto: van en el idioma de las plantillas, no en el de la app.
  const sample: Record<string, string> = {
    nombre: "María",
    optica: signature || "Mi Óptica",
    telefono: phone || "(305) 555-0100",
    fecha: "lunes 24 de noviembre",
    hora: "10:00 a. m.",
    resena: "https://g.page/r/xxxxxxxx",
  }
  const filled = text.replace(/\{(\w+)\}/g, (x, v: string) => sample[v] ?? x)
  const { parts, len } = smsParts(filled, { plain, footer: MARKETING_KINDS.includes(kind) })
  return (
    <span className={cn("text-xs", parts > 1 ? "text-warning-foreground" : "text-muted-foreground")}>
      {t.smsCount(len, parts)}
    </span>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <FormField label={label}><Input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} /></FormField>
  )
}
