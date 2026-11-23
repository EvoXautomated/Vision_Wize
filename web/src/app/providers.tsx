"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { I18nProvider, type Locale } from "@/i18n"
import { SessionProvider } from "@/lib/session"

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } },
      }),
  )
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="optica.theme">
      <I18nProvider initialLocale={locale}>
        <QueryClientProvider client={client}>
          <SessionProvider>{children}</SessionProvider>
          <Toaster position="top-center" richColors />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
