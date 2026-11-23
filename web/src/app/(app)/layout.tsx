import { Suspense } from "react"
import { AppShell } from "@/components/app-shell"

// La app vive en el navegador (sesión en el iPad): todo se pinta en cliente.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
