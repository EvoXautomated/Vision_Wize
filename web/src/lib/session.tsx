"use client"

import { toast } from "sonner"
import { createContext, use, useCallback, useEffect, useState } from "react"
import { api, ApiError, deviceStore, tokenStore } from "./api"
import type { User } from "./types"

interface SessionValue {
  user: User | null
  grants: string[]
  loading: boolean
  /** Hay sesión guardada pero no se pudo comprobar (sin conexión). */
  offline: boolean
  retry: () => void
  can: (perm: string) => boolean
  login: (userId: string, pin: string) => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [grants, setGrants] = useState<string[]>([])
  // Sin token guardado no hay nada que comprobar.
  const [loading, setLoading] = useState(() => typeof window !== "undefined" && !!tokenStore.get())

  const [offline, setOffline] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!tokenStore.get()) return
    api<{ user: User; grants: string[] }>("/auth/me")
      .then((r) => {
        setUser(r.user)
        setGrants(r.grants)
        setOffline(false)
      })
      .catch((e) => {
        // Solo un 401 cierra la sesión; un corte de wifi no debe mandar al PIN.
        if (e instanceof ApiError && e.status === 401) tokenStore.clear()
        else setOffline(true)
      })
      .finally(() => setLoading(false))
  }, [attempt])

  const retry = useCallback(() => {
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  const login = useCallback(async (userId: string, pin: string) => {
    const r = await api<{ token: string; user: User; grants: string[]; deviceToken?: string; weakPin?: boolean }>("/auth/login", "POST", { userId, pin })
    // Instalación nueva: el primer PIN correcto autoriza este dispositivo.
    if (r.deviceToken) deviceStore.set(r.deviceToken)
    tokenStore.set(r.token)
    setUser(r.user)
    setGrants(r.grants)
    if (r.weakPin) toast.warning("Tu PIN es muy fácil de adivinar. Pídele al dueño que lo cambie en Ajustes → Equipo.", { duration: 10_000 })
  }, [])

  const logout = useCallback(async () => {
    await api("/auth/logout", "POST").catch(() => undefined)
    tokenStore.clear()
    setUser(null)
    setGrants([])
  }, [])

  const can = useCallback((perm: string) => user?.role === "owner" || grants.includes(perm), [user, grants])

  return (
    <SessionContext.Provider value={{ user, grants, loading, offline, retry, can, login, logout }}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error("useSession fuera de SessionProvider")
  return ctx
}
