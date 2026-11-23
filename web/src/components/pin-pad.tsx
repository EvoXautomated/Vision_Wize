"use client"

import { DeleteIcon } from "lucide-react"
import { useEffect } from "react"
import { useT } from "@/i18n"
import { cn } from "@/lib/utils"

/** Teclado de PIN de 4 dígitos, grande para el iPad (también acepta el teclado físico). */
export function PinPad({ value, onChange, onComplete, disabled }: {
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
  disabled?: boolean
}) {
  const t = useT().common.pin
  const press = (d: string) => {
    if (disabled || value.length >= 4) return
    const next = value + d
    onChange(next)
    if (next.length === 4) onComplete(next)
  }
  const back = () => !disabled && onChange(value.slice(0, -1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === "Backspace") back()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-4" role="img" aria-label={t.progress(value.length)}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full bg-foreground/15 transition-all duration-150",
              i < value.length && "scale-110 bg-primary",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled}>{d}</Key>
        ))}
        <span />
        <Key onClick={() => press("0")} disabled={disabled}>0</Key>
        <Key onClick={back} disabled={disabled} aria-label={t.erase}>
          <DeleteIcon className="size-6" />
        </Key>
      </div>
    </div>
  )
}

function Key(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="flex size-18 items-center justify-center rounded-full bg-card text-2xl font-medium tabular-nums shadow-sm ring-1 ring-foreground/10 outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 active:bg-primary/15 disabled:opacity-50"
      {...props}
    />
  )
}
