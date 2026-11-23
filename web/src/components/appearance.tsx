"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { LOCALE_NAME, LOCALES, useLocale, useT } from "@/i18n"
import { cn } from "@/lib/utils"

/** Grupo de opciones excluyentes, del tamaño de un dedo. */
function Segmented<V extends string>({ label, value, onChange, options }: {
  label: string
  value: V | undefined
  onChange: (v: V) => void
  options: { value: V; label: string; icon?: React.ReactNode }[]
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm whitespace-nowrap font-medium text-muted-foreground outline-none transition-colors",
            "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            "aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm aria-checked:ring-1 aria-checked:ring-foreground/10",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

const noop = () => () => {}
/** El tema guardado solo se conoce en el navegador: hasta entonces no se marca ninguno. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false)

export function ThemeSwitch() {
  const t = useT().shell.appearance
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  return (
    <Segmented
      label={t.theme}
      value={mounted ? (theme as "light" | "dark" | "system") : undefined}
      onChange={setTheme}
      options={[
        { value: "light", label: t.light, icon: <SunIcon className="size-4" aria-hidden /> },
        { value: "dark", label: t.dark, icon: <MoonIcon className="size-4" aria-hidden /> },
        { value: "system", label: t.system, icon: <MonitorIcon className="size-4" aria-hidden /> },
      ]}
    />
  )
}

export function LanguageSwitch() {
  const t = useT().shell.appearance
  const { locale, setLocale } = useLocale()
  return (
    <Segmented
      label={t.language}
      value={locale}
      onChange={setLocale}
      options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAME[l] }))}
    />
  )
}
