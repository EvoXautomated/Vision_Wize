"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, GlassesIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { PinPad } from "@/components/pin-pad"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { ROLE_LABEL } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { User } from "@/lib/types"

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useSession()
  const team = useQuery({ queryKey: ["team"], queryFn: () => api<User[]>("/auth/team") })
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
      setError(e instanceof ApiError ? e.message : "No se pudo entrar")
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="bg-brand-mesh flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="flex items-center gap-2 text-primary">
        <GlassesIcon className="size-8" />
        <span className="text-xl font-semibold">Óptica</span>
      </div>

      {!selected ? (
        <section className="flex w-full max-w-2xl flex-col items-center gap-6">
          <h1 className="text-2xl font-semibold">¿Quién eres?</h1>
          {team.isError && <p className="text-destructive">No hay conexión con el servidor.</p>}
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
            {team.data?.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 shadow-sm transition active:scale-[0.98]"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                  {u.initials}
                </span>
                <span className="text-center font-medium">{u.fullName}</span>
                <span className="text-sm text-muted-foreground">{ROLE_LABEL[u.role]}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Hola, {selected.fullName.split(" ")[0]}</h1>
            <p className="text-muted-foreground">Escribe tu PIN</p>
          </div>
          <PinPad value={pin} onChange={setPin} onComplete={submit} disabled={busy} />
          <p className="h-5 text-sm text-destructive" role="alert">{error}</p>
          <Button variant="ghost" size="lg" onClick={() => { setSelected(null); setPin(""); setError("") }}>
            <ArrowLeftIcon /> Elegir otra persona
          </Button>
        </section>
      )}
    </main>
  )
}
