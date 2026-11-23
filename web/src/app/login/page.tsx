"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, GlassesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Avatar } from "@/components/avatar"
import { LanguageSwitch, ThemeSwitch } from "@/components/appearance"
import { FormField } from "@/components/form-field"
import { PinPad } from "@/components/pin-pad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n"
import { api, ApiError, deviceStore } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { User } from "@/lib/types"

export default function LoginPage() {
  const t = useT()
  const router = useRouter()
  const { login, user } = useSession()
  const team = useQuery({ queryKey: ["team"], queryFn: () => api<User[]>("/auth/team"), retry: false })
  const untrusted = team.error instanceof ApiError && team.error.body.code === "device_not_trusted"
  const [selected, setSelected] = useState<User | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) router.replace("/")
  }, [user, router])

  const submit = async (value: string) => {
    if (!selected) return
    setBusy(true)
    setError("")
    try {
      await login(selected.id, value)
      router.replace("/")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.login.failed)
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="bg-brand-mesh flex min-h-dvh flex-col items-center gap-8 p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 self-stretch">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <GlassesIcon className="size-6" aria-hidden />
          </span>
          <span className="text-2xl font-semibold tracking-tight">{t.common.appName}</span>
        </div>

        {untrusted ? (
          <EnrollDevice onDone={() => team.refetch()} />
        ) : !selected ? (
          <section className="flex w-full max-w-2xl flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold">{t.login.who}</h1>
            {team.isError && <p className="text-destructive" role="alert">{t.login.noConnection}</p>}
            <div className="flex w-full flex-wrap justify-center gap-4">
              {team.data?.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="flex w-44 flex-col items-center gap-3 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10 outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0 active:scale-[0.98]"
                >
                  <Avatar initials={u.initials} className="size-16 text-xl" />
                  <span className="text-center font-medium">{u.fullName}</span>
                  <span className="text-sm text-muted-foreground">{t.common.role[u.role]}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-center gap-6">
            <div className="grid justify-items-center gap-3 text-center">
              <Avatar initials={selected.initials} className="size-16 text-xl" />
              <div>
                <h1 className="text-2xl font-semibold">{t.login.hello(selected.fullName.split(" ")[0])}</h1>
                <p className="text-muted-foreground">{t.login.enterPin}</p>
              </div>
            </div>
            <PinPad value={pin} onChange={setPin} onComplete={submit} disabled={busy} />
            <p className="min-h-5 text-sm text-destructive" role="alert">{error}</p>
            <Button variant="ghost" size="lg" onClick={() => { setSelected(null); setPin(""); setError("") }}>
              <ArrowLeftIcon aria-hidden /> {t.login.chooseOther}
            </Button>
          </section>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-3">
        <div className="w-96 max-w-full"><ThemeSwitch /></div>
        <div className="w-52 max-w-full"><LanguageSwitch /></div>
      </footer>
    </main>
  )
}

/** Dispositivo sin autorizar: se desbloquea con el código que genera el dueño en Ajustes → Equipo. */
function EnrollDevice({ onDone }: { onDone: () => void }) {
  const t = useT().login.enroll
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const enroll = useMutation({
    mutationFn: () => api<{ deviceToken: string }>("/auth/devices/enroll", "POST", { code, name: name.trim() }),
    onSuccess: (r) => {
      deviceStore.set(r.deviceToken)
      onDone()
    },
  })
  const ready = code.length === 8 && name.trim().length > 0
  const [incomplete, setIncomplete] = useState(false)

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setIncomplete(!ready)
        if (ready) enroll.mutate()
      }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-balance">{t.title}</h1>
        <p className="text-muted-foreground text-pretty">
          {t.body}
        </p>
      </div>
      <FormField label={t.code}>
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={8}
          placeholder="12345678"
          className="h-12 text-center text-lg tracking-widest tabular-nums"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </FormField>
      <FormField label={t.name}>
        <Input name="device-name" autoComplete="off" maxLength={60} placeholder={t.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <p className="min-h-5 text-sm text-destructive" role="alert">{incomplete && !ready ? t.incomplete : enroll.error?.message}</p>
      <Button type="submit" size="lg" disabled={enroll.isPending}>
        {enroll.isPending ? t.submitting : t.submit}
      </Button>
    </form>
  )
}
