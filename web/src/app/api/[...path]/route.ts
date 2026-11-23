/**
 * Puente hacia la API por la red privada del proveedor: el navegador llama a
 * `/api/v1/…` en la misma dirección que la web (sin CORS ni saber la dirección
 * pública de la API). Solo se usa si la web se construye con
 * `NEXT_PUBLIC_API_URL=/api/v1`; `API_HOSTPORT` es `servidor:puerto` de la API.
 */
const target = process.env.API_HOSTPORT ? `http://${process.env.API_HOSTPORT}` : null

// Cabeceras que no se copian: son de la conexión, no del contenido.
const HOP = ["connection", "content-encoding", "content-length", "host", "keep-alive", "transfer-encoding"]

const copy = (from: Headers) => {
  const to = new Headers(from)
  for (const name of HOP) to.delete(name)
  return to
}

const TEXT = {
  es: {
    unset: "La web no tiene configurada la dirección de la API (API_HOSTPORT).",
    down: "No hay conexión con el servidor. Inténtalo de nuevo en un momento.",
  },
  en: {
    unset: "The web app doesn’t have the API address configured (API_HOSTPORT).",
    down: "Can’t reach the server. Try again in a moment.",
  },
}

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const text = TEXT[/^\s*en\b/i.test(req.headers.get("accept-language") ?? "") ? "en" : "es"]
  if (!target) return Response.json({ message: text.unset }, { status: 503 })
  const { path } = await params
  const url = `${target}/${path.map(encodeURIComponent).join("/")}${new URL(req.url).search}`
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  try {
    const res = await fetch(url, {
      method: req.method,
      headers: copy(req.headers),
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    })
    return new Response(res.status === 204 || res.status === 304 ? null : res.body, { status: res.status, headers: copy(res.headers) })
  } catch {
    return Response.json({ message: text.down }, { status: 502 })
  }
}

export const dynamic = "force-dynamic"
export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT }
