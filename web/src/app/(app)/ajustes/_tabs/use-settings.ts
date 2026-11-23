import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useT } from "@/i18n"
import { api } from "@/lib/api"
import type { Settings } from "@/lib/types"

/** Ajustes de la óptica y la mutación que los guarda. */
export function useSettings() {
  const qc = useQueryClient()
  const t = useT().settings
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") })
  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => api<Settings>("/settings", "PUT", patch),
    onSuccess: (s) => {
      qc.setQueryData(["settings"], s)
      toast.success(t.saved)
    },
    onError: (e) => toast.error(e.message),
  })
  return { settings: settings.data, save }
}
