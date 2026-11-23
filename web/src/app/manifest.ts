import type { MetadataRoute } from "next"

/** PWA: se instala en el iPad desde Safari con «Añadir a pantalla de inicio». */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Óptica · Clientes",
    short_name: "Óptica",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
