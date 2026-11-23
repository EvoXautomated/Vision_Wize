"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n"

/** Botón de una acción que no se puede deshacer con un toque: antes pregunta. */
export function ConfirmButton({ title, description, confirmLabel, onConfirm, children, ...button }: {
  title: string
  description: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "title">) {
  const [open, setOpen] = useState(false)
  const t = useT().common
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button {...button} />}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.back}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => { setOpen(false); onConfirm() }}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
