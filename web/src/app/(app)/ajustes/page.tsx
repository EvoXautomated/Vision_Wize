"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useT } from "@/i18n"
import { useSession } from "@/lib/session"
import { TeamTab } from "./_tabs/team-tab"
import { DevicesCard } from "./_tabs/devices-card"
import { PermissionsTab } from "./_tabs/permissions-tab"
import { MessagesTab } from "./_tabs/messages-tab"
import { BusinessTab } from "./_tabs/business-tab"
import { TagsTab } from "./_tabs/tags-tab"
import { DataTab } from "./_tabs/data-tab"
import { AppearanceTab } from "./_tabs/appearance-tab"

export default function SettingsPage() {
  const { can } = useSession()
  const { settings: t, shell } = useT()
  if (!can("settings.manage")) return <p className="p-8 text-center text-muted-foreground">{t.ownerOnly}</p>
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <Tabs defaultValue="team">
        <TabsList className="flex-wrap">
          <TabsTrigger value="team">{t.tabs.team}</TabsTrigger>
          <TabsTrigger value="permissions">{t.tabs.permissions}</TabsTrigger>
          <TabsTrigger value="messages">{t.tabs.messages}</TabsTrigger>
          <TabsTrigger value="business">{t.tabs.business}</TabsTrigger>
          <TabsTrigger value="tags">{t.tabs.tags}</TabsTrigger>
          <TabsTrigger value="data">{t.tabs.data}</TabsTrigger>
          <TabsTrigger value="appearance">{shell.appearance.title}</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="grid gap-4"><TeamTab /><DevicesCard /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="messages"><MessagesTab /></TabsContent>
        <TabsContent value="business"><BusinessTab /></TabsContent>
        <TabsContent value="tags"><TagsTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
      </Tabs>
    </div>
  )
}
