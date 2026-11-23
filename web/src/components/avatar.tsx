import { cn } from "@/lib/utils"

/** «María González» → MG */
export function nameInitials(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase()
}

/** Círculo con iniciales: lleno para el equipo, suave para los clientes. Decorativo: el nombre va al lado. */
export function Avatar({ initials, soft, className }: { initials: string; soft?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        soft
          ? "bg-primary/10 text-primary dark:bg-primary/15"
          : "bg-linear-to-br from-primary to-[color-mix(in_oklch,var(--primary),var(--info)_45%)] text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  )
}
