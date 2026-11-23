"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { DownloadIcon, UploadIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useT } from "@/i18n"
import { api, download } from "@/lib/api"

interface ImportReport {
  dryRun: boolean
  summary: { total: number; new: number; duplicates: number; errors: number; notes: number; notesSkipped: number }
  unknownColumns: string[]
  rows: { row: number; name: string; status: "new" | "duplicate" | "error"; errors: string[]; duplicateOf?: string }[]
}

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  let table: unknown[][]
  if (/\.csv$/i.test(file.name)) {
    table = parseCsv(await file.text())
  } else {
    const { readSheet } = await import("read-excel-file/browser")
    table = (await readSheet(file)) as unknown[][]
  }
  const [head, ...body] = table
  if (!head) return []
  const headers = head.map((h) => String(h ?? "").trim())
  return body
    .filter((r) => r.some((c) => c !== null && c !== ""))
    .map((r) =>
      Object.fromEntries(
        headers.map((h, i) => {
          const v = r[i]
          return [h, v instanceof Date ? v.toISOString().slice(0, 10) : v ?? ""]
        }),
      ),
    )
}

/** CSV con comillas; detecta ';' (Excel en español) o ','. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const first = src.split(/\r?\n/, 1)[0] ?? ""
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell); rows.push(row); row = []; cell = ""
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export function DataTab() {
  const qc = useQueryClient()
  const t = useT().settings.data
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [report, setReport] = useState<ImportReport | null>(null)
  const [includeNotes, setIncludeNotes] = useState(false)

  const check = useMutation({
    mutationFn: (dryRun: boolean) => api<ImportReport>("/clients/import", "POST", { rows, dryRun, includeNotes }),
    onSuccess: (r) => {
      setReport(r)
      if (!r.dryRun) {
        qc.invalidateQueries({ queryKey: ["clients"] })
        toast.success(t.imported(r.summary.new))
        setRows(null)
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const data = await readRows(f)
      setFileName(f.name)
      setRows(data)
      setReport(null)
    } catch {
      toast.error(t.readError)
    }
  }

  // El informe se pide en cuanto se leen las filas del archivo.
  const { mutate } = check
  useEffect(() => {
    if (rows) mutate(true)
  }, [rows, includeNotes, mutate])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t.importTitle}</CardTitle>
          <CardDescription>
            {t.importDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = "" }} />
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block text-sm font-medium">{t.notes}</span>
              <span className="block text-sm text-muted-foreground">
                {t.notesHint}
              </span>
            </span>
            <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} />
          </label>
          <Button size="lg" variant="outline" className="justify-self-start" onClick={() => input.current?.click()}><UploadIcon /> {t.chooseFile}</Button>
          {report && (
            <div className="grid gap-3">
              <p className="text-sm">
                <b>{fileName}</b>: {t.summary.rows(report.summary.total)} · <span className="text-success">{t.summary.new(report.summary.new)}</span> ·{" "}
                {t.summary.duplicates(report.summary.duplicates)} · <span className="text-destructive">{t.summary.errors(report.summary.errors)}</span>
              </p>
              {(includeNotes || report.summary.notesSkipped > 0) && (
                <p className="text-sm text-muted-foreground">
                  {includeNotes ? `${t.notesImported(report.summary.notes)} ` : ""}
                  {report.summary.notesSkipped > 0 && t.notesSkipped(report.summary.notesSkipped)}
                </p>
              )}
              {report.unknownColumns.length > 0 && (
                <p className="text-sm text-muted-foreground">{t.unknownColumns(report.unknownColumns.join(", "))}</p>
              )}
              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {report.rows.filter((r) => r.status !== "new").map((r) => (
                      <tr key={r.row}>
                        <td className="w-16 p-2 text-muted-foreground">{t.row(r.row)}</td>
                        <td className="p-2">{r.name || "—"}</td>
                        <td className="p-2">{r.status === "error" ? <span className="text-destructive">{r.errors.join("; ")}</span> : t.exists(r.duplicateOf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.dryRun && report.summary.new > 0 && (
                <Button size="lg" className="justify-self-start" disabled={check.isPending} onClick={() => check.mutate(false)}>
                  {t.importNew(report.summary.new)}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t.exportTitle}</CardTitle><CardDescription>{t.exportDescription}</CardDescription></CardHeader>
        <CardContent>
          <Button size="lg" variant="outline" onClick={() => download("/clients/export.csv", "clientes.csv").catch((e) => toast.error(e.message))}>
            <DownloadIcon /> {t.download}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
