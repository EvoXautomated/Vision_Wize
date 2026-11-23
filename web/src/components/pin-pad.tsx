"use client"

import { DeleteIcon } from "lucide-react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

/** Teclado de PIN de 4 dígitos, grande para el iPad (también acepta el teclado físico). */
export function PinPad({ value, onChange, onComplete, disabled }: {
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
  disabled?: boolean
}) {
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
      <div className="flex gap-4" aria-label={`${value.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full border-2 border-primary transition-colors",
              i < value.length && "bg-primary",
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
        <Key onClick={back} disabled={disabled} aria-label="Borrar">
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
      className="flex size-18 items-center justify-center rounded-full bg-secondary text-2xl font-medium text-secondary-foreground transition active:scale-95 active:bg-primary/20 disabled:opacity-50"
      {...props}
    />
  )
}
