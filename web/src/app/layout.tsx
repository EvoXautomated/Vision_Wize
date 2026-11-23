import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Óptica · Clientes",
  description: "Clientes, visitas y agenda de la óptica",
  appleWebApp: { capable: true, title: "Óptica", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body style={{ ["--font-heading" as string]: "var(--font-sans)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
