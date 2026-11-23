"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarDaysIcon, GlassesIcon, LogOutIcon, PhoneIcon, SettingsIcon, SunIcon, UsersIcon, WifiOffIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { api } from "@/lib/api"
import { ROLE_LABEL } from "@/lib/format"
import { useSession } from "@/lib/session"
import type { CallItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Hoy", icon: SunIcon },
  { href: "/clientes", label: "Clientes", icon: UsersIcon },
  { href: "/agenda", label: "Agenda", icon: CalendarDaysIcon },
  { href: "/llamar", label: "Por llamar", icon: PhoneIcon },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, offline, retry, logout, can } = useSession()
  const router = useRouter()
  const path = usePathname()
  const calls = useQuery({
    queryKey: ["calls"],
    queryFn: () => api<CallItem[]>("/calls"),
    enabled: !!user,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!loading && !user && !offline) router.replace("/login")
  }, [loading, user, offline, router])

  if (!user && offline && !loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <WifiOffIcon className="size-10 text-muted-foreground" />
        <div>
          <p className="text-lg font-medium">Sin conexión con el servidor</p>
          <p className="text-muted-foreground">Revisa el wifi del iPad. Tu sesión sigue abierta.</p>
        </div>
        <button onClick={retry} className="h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground">Reintentar</button>
      </div>
    )
  }
  if (!user) return null

  const nav = can("settings.manage") ? [...NAV, { href: "/ajustes", label: "Ajustes", icon: SettingsIcon }] : NAV
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href))

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link href="/" className="mr-2 flex items-center gap-1.5 font-semibold text-primary">
            <GlassesIcon className="size-5" /> <span className="hidden sm:inline">Óptica</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors",
                  active(href) ? "bg-secondary text-foreground" : "hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{label}</span>
                {href === "/llamar" && !!calls.data?.length && (
                  <span className="rounded-full bg-warning px-1.5 text-xs text-warning-foreground">{calls.data.length}</span>
                )}
              </Link>
            ))}
          </nav>
          <button
            onClick={async () => { await logout(); router.replace("/login") }}
            className="flex h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
            title="Cambiar de usuario"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {user.initials}
            </span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block font-medium">{user.fullName}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
            <LogOutIcon className="size-4 text-muted-foreground" />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-16">{children}</main>
    </div>
  )
}
