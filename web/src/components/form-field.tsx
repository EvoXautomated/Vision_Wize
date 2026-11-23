import { cloneElement, isValidElement, useId } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }

/**
 * Etiqueta + un control, unidos por id (el lector de pantalla y el toque en la
 * etiqueta enfocan el campo). Con `error`, el mensaje sale junto al campo.
 */
export function FormField({ label, error, children, className }: {
  label: React.ReactNode
  error?: string
  children: React.ReactElement<ControlProps>
  className?: string
}) {
  const id = useId()
  const invalid: ControlProps = error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {}
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id, ...invalid }) : children}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
