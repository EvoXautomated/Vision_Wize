"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmButton } from "@/components/confirm-button"
import { NativeSelect } from "@/components/native-select"
import { Badge } from "@/components/ui/badge"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/i18n"
import { api } from "@/lib/api"
import type { Role, User } from "@/lib/types"

export function TeamTab() {
  const qc = useQueryClient()
  const { settings: { team: t }, common } = useT()
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") })
  const [editing, setEditing] = useState<User | null>(null)
  const [adding, setAdding] = useState(false)
  const saved = () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["team"] }) }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-lg border">
          {users.data?.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{u.initials}</span>
              <span className="flex-1">
                <span className="block font-medium">{u.fullName}</span>
                <span className="block text-sm text-muted-foreground">{common.role[u.role]}{u.email ? ` · ${u.email}` : ""}</span>
              </span>
              {!u.active && <Badge variant="outline">{t.inactive}</Badge>}
              <Button variant="outline" onClick={() => setEditing(u)}>{common.edit}</Button>
            </li>
          ))}
        </ul>
        <Button size="lg" className="justify-self-start" onClick={() => setAdding(true)}><PlusIcon /> {t.addPerson}</Button>
      </CardContent>
      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && <NewUserForm onClose={() => setAdding(false)} onSaved={saved} />}
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <EditUserForm key={editing.id} user={editing} onClose={() => setEditing(null)} onSaved={saved} />}
      </Dialog>
    </Card>
  )
}

// Alta y edición son dos formularios distintos que comparten los campos.

interface UserDraft {
  fullName: string
  role: Role
  email: string
  pin: string
}

interface UserFormProps {
  onClose: () => void
  onSaved: () => void
}

const userBody = (d: UserDraft) => ({ fullName: d.fullName, role: d.role, ...(d.email ? { email: d.email } : {}), ...(d.pin ? { pin: d.pin } : {}) })

function UserFields({ draft, onChange, pinLabel, children }: {
  draft: UserDraft
  onChange: (patch: Partial<UserDraft>) => void
  pinLabel: string
  children?: React.ReactNode
}) {
  const { settings: { team: t }, common } = useT()
  return (
    <div className="grid gap-3">
      <FormField label={t.name}><Input name="fullName" autoComplete="off" value={draft.fullName} onChange={(e) => onChange({ fullName: e.target.value })} /></FormField>
      <FormField label={t.role}>
        <NativeSelect name="role" value={draft.role} onChange={(e) => onChange({ role: e.target.value as Role })}>
          {(Object.keys(common.role) as Role[]).map((r) => <option key={r} value={r}>{common.role[r]}</option>)}
        </NativeSelect>
      </FormField>
      <FormField label={t.email}><Input name="email" type="email" autoComplete="off" spellCheck={false} value={draft.email} onChange={(e) => onChange({ email: e.target.value })} /></FormField>
      <FormField label={pinLabel}>
        <Input name="pin" inputMode="numeric" autoComplete="off" maxLength={4} value={draft.pin} onChange={(e) => onChange({ pin: e.target.value.replace(/\D/g, "") })} />
      </FormField>
      {children}
    </div>
  )
}

function NewUserForm({ onClose, onSaved }: UserFormProps) {
  const { settings: { team: t }, common } = useT()
  const [draft, setDraft] = useState<UserDraft>({ fullName: "", role: "seller", email: "", pin: "" })
  const save = useMutation({
    mutationFn: () => api("/users", "POST", userBody(draft)),
    onSuccess: () => { onSaved(); onClose(); toast.success(t.added) },
    onError: (e) => toast.error(e.message),
  })
  const ready = draft.fullName.trim().length >= 2 && /^\d{4}$/.test(draft.pin)
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{t.addPerson}</DialogTitle></DialogHeader>
      <UserFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} pinLabel={t.newPin} />
      <DialogFooter>
        <Button size="lg" disabled={!ready || save.isPending} onClick={() => save.mutate()}>{save.isPending ? common.saving : common.add}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function EditUserForm({ user, onClose, onSaved }: UserFormProps & { user: User }) {
  const { settings: { team: t, saved: savedText }, common } = useT()
  const [draft, setDraft] = useState<UserDraft>({ fullName: user.fullName, role: user.role, email: user.email ?? "", pin: "" })
  const [active, setActive] = useState(user.active)
  const save = useMutation({
    mutationFn: () => api(`/users/${user.id}`, "PATCH", { ...userBody(draft), active }),
    onSuccess: () => { onSaved(); onClose(); toast.success(savedText) },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api(`/users/${user.id}`, "DELETE"),
    onSuccess: () => { onSaved(); onClose(); toast.success(t.removed) },
    onError: (e) => toast.error(e.message),
  })
  const ready = draft.fullName.trim().length >= 2 && (draft.pin === "" || /^\d{4}$/.test(draft.pin))
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{t.editPerson}</DialogTitle></DialogHeader>
      <UserFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} pinLabel={t.changePin}>
        <label className="flex items-center justify-between"><span className="text-sm">{t.active}</span><Switch checked={active} onCheckedChange={setActive} /></label>
      </UserFields>
      <DialogFooter>
        <ConfirmButton
          variant="destructive"
          size="lg"
          disabled={remove.isPending}
          title={t.removeTitle(user.fullName)}
          description={t.removeBody}
          confirmLabel={t.remove}
          onConfirm={() => remove.mutate()}
        >
          {t.remove}
        </ConfirmButton>
        <Button size="lg" disabled={!ready || save.isPending} onClick={() => save.mutate()}>{save.isPending ? common.saving : common.save}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
