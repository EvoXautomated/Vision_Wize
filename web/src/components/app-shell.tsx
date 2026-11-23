"use client"

import { useQuery } from "@tanstack/react-query"
import { BarChart3Icon, CalendarDaysIcon, ChevronDownIcon, GlassesIcon, LogOutIcon, MegaphoneIcon, PhoneIcon, SettingsIcon, SunIcon, UsersIcon, WifiOffIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { LanguageSwitch, ThemeSwitch } from "@/components/appearance"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/i18n"
import { api } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { CallItem } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT()
  const { user, loading, offline, retry, can } = useSession()
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <WifiOffIcon className="size-7 text-muted-foreground" aria-hidden />
        </span>
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t.shell.offline.title}</p>
          <p className="text-muted-foreground">{t.shell.offline.body}</p>
        </div>
        <Button size="lg" onClick={retry}>{t.common.retry}</Button>
      </div>
    )
  }
  if (!user) return null

  const nav = [
    { href: "/", label: t.shell.nav.today, icon: SunIcon },
    { href: "/clientes", label: t.shell.nav.clients, icon: UsersIcon },
    { href: "/agenda", label: t.shell.nav.agenda, icon: CalendarDaysIcon },
    { href: "/llamar", label: t.shell.nav.calls, icon: PhoneIcon, count: calls.data?.length },
    ...(can("campaigns.send") ? [{ href: "/campanas", label: t.shell.nav.campaigns, icon: MegaphoneIcon }] : []),
    ...(can("settings.manage")
      ? [
          { href: "/panel", label: t.shell.nav.panel, icon: BarChart3Icon },
          { href: "/ajustes", label: t.shell.nav.settings, icon: SettingsIcon },
        ]
      : []),
  ]
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href))

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="bg-brand-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 opacity-60 [mask-image:linear-gradient(black,transparent)]" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GlassesIcon className="size-5" aria-hidden />
            </span>
            <span className="hidden font-semibold tracking-tight xl:inline">{t.common.appName}</span>
          </Link>
          <nav aria-label={t.shell.mainNav} className="scrollbar-none flex flex-1 gap-1 overflow-x-auto py-1">
            {nav.map(({ href, label, icon: Icon, count }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                aria-label={count ? `${label} (${count})` : label}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors",
                  "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  "aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary dark:aria-[current=page]:bg-primary/15",
                )}
              >
                <Icon className="size-[1.125rem]" aria-hidden />
                <span className="hidden md:inline">{label}</span>
                {!!count && (
                  <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-xs font-semibold text-warning-foreground tabular-nums">{count}</span>
                )}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main key={path} className="mx-auto w-full max-w-6xl flex-1 animate-in px-4 pt-6 pb-16 duration-300 fade-in-0 slide-in-from-bottom-1 sm:px-6">{children}</main>
    </div>
  )
}

/** Quién está usando la app, la apariencia del dispositivo y el cambio de usuario. */
function UserMenu() {
  const t = useT()
  const { user, logout } = useSession()
  const router = useRouter()
  if (!user) return null
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t.shell.userMenu}
        className="flex h-11 items-center gap-2.5 rounded-xl pr-2 pl-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
      >
        <Avatar initials={user.initials} />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block font-medium">{user.fullName}</span>
          <span className="block text-xs text-muted-foreground">{t.common.role[user.role]}</span>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[22rem] gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Avatar initials={user.initials} className="size-11 text-sm" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold">{user.fullName}</p>
            <p className="text-sm text-muted-foreground">{t.common.role[user.role]}</p>
          </div>
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t.shell.appearance.theme}</p>
          <ThemeSwitch />
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t.shell.appearance.language}</p>
          <LanguageSwitch />
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={async () => { await logout(); router.replace("/login") }}
        >
          <LogOutIcon aria-hidden /> {t.shell.switchUser}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
