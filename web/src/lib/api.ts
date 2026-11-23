export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1"

const TOKEN_KEY = "optica.token"

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Error de la API con el cuerpo completo (p. ej. `duplicates`, `mergedIntoId`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export async function api<T = unknown>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && token) {
    tokenStore.clear()
    // Fuera de React (sin router): la sesión caducó, se vuelve al PIN.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.assign(`${location.origin}/login`)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.message ?? "Algo salió mal. Inténtalo de nuevo.", data)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get("content-type") ?? ""
  return (type.includes("json") ? res.json() : res.text()) as Promise<T>
}

/** Descarga un archivo autenticado (exportación CSV). */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } })
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).message ?? "No se pudo descargar")
  const name = res.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement("a"), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}
