"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api, tokenStore } from "./api"
import type { User } from "./types"

interface SessionValue {
  user: User | null
  grants: string[]
  loading: boolean
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

  useEffect(() => {
    if (!tokenStore.get()) return
    api<{ user: User; grants: string[] }>("/auth/me")
      .then((r) => {
        setUser(r.user)
        setGrants(r.grants)
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (userId: string, pin: string) => {
    const r = await api<{ token: string; user: User; grants: string[] }>("/auth/login", "POST", { userId, pin })
    tokenStore.set(r.token)
    setUser(r.user)
    setGrants(r.grants)
  }, [])

  const logout = useCallback(async () => {
    await api("/auth/logout", "POST").catch(() => undefined)
    tokenStore.clear()
    setUser(null)
    setGrants([])
  }, [])

  const can = useCallback((perm: string) => user?.role === "owner" || grants.includes(perm), [user, grants])

  return (
    <SessionContext.Provider value={{ user, grants, loading, can, login, logout }}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession fuera de SessionProvider")
  return ctx
}
