"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/lib/session"
import { TeamTab } from "./_tabs/team-tab"
import { DevicesCard } from "./_tabs/devices-card"
import { PermissionsTab } from "./_tabs/permissions-tab"
import { MessagesTab } from "./_tabs/messages-tab"
import { BusinessTab } from "./_tabs/business-tab"
import { TagsTab } from "./_tabs/tags-tab"
import { DataTab } from "./_tabs/data-tab"

export default function SettingsPage() {
  const { can } = useSession()
  if (!can("settings.manage")) return <p className="p-8 text-center text-muted-foreground">Solo el dueño puede ver los ajustes.</p>
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Ajustes</h1>
      <Tabs defaultValue="team">
        <TabsList className="flex-wrap">
          <TabsTrigger value="team">Equipo</TabsTrigger>
          <TabsTrigger value="permissions">Permisos</TabsTrigger>
          <TabsTrigger value="messages">Mensajes</TabsTrigger>
          <TabsTrigger value="business">La óptica</TabsTrigger>
          <TabsTrigger value="tags">Etiquetas</TabsTrigger>
          <TabsTrigger value="data">Importar y exportar</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="grid gap-4"><TeamTab /><DevicesCard /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="messages"><MessagesTab /></TabsContent>
        <TabsContent value="business"><BusinessTab /></TabsContent>
        <TabsContent value="tags"><TagsTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
      </Tabs>
    </div>
  )
}
