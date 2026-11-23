import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"
import "./globals.css"
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/dict"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Óptica · Clientes",
  description: "Clientes, visitas y agenda de la óptica",
  appleWebApp: { capable: true, title: "Óptica", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iPad: evita que Safari amplíe la página al enfocar un campo. El zoom con
  // los dedos sigue funcionando (iOS no aplica este límite al gesto).
  maximumScale: 1,
  // La barra del navegador acompaña al tema (mismos tonos que --background).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1113" },
  ],
  colorScheme: "light dark",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El idioma elegido en el dispositivo viaja en una cookie: la página ya sale en ese idioma.
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(saved) ? saved : DEFAULT_LOCALE
  return (
    // next-themes pone la clase del tema antes de pintar: de ahí suppressHydrationWarning.
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body style={{ ["--font-heading" as string]: "var(--font-sans)" }}>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  )
}
