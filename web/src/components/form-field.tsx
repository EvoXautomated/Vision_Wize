import { cloneElement, isValidElement, useId } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Etiqueta + un control, unidos por id (el lector de pantalla y el toque en la etiqueta enfocan el campo). */
export function FormField({ label, children, className }: {
  label: React.ReactNode
  children: React.ReactElement<{ id?: string }>
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-muted-foreground">{label}</Label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
    </div>
  )
}
