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
  }
}
