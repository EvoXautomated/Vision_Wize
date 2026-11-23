/** Cabecera, navegación, menú de usuario y preferencias de apariencia. */
export const es = {
  nav: { today: "Hoy", clients: "Clientes", agenda: "Agenda", calls: "Por llamar", campaigns: "Campañas", panel: "Panel", settings: "Ajustes" },
  mainNav: "Secciones",
  pendingCalls: (n: number) => `${n} por llamar`,
  userMenu: "Menú de usuario",
  switchUser: "Cambiar de usuario",
  offline: { title: "Sin conexión con el servidor", body: "Revisa el wifi del iPad. Tu sesión sigue abierta." },
  appearance: {
    title: "Apariencia",
    description: "Se guarda en este dispositivo y vale para todo el que lo use.",
    theme: "Tema",
    light: "Claro",
    dark: "Oscuro",
    system: "Automático",
    systemHint: "Sigue el modo claro u oscuro del iPad.",
    language: "Idioma",
    languageHint: "Cambia el idioma de la app. Los mensajes a los clientes no cambian: se editan en Ajustes → Mensajes.",
  },
}

export const en: typeof es = {
  nav: { today: "Today", clients: "Clients", agenda: "Schedule", calls: "To call", campaigns: "Campaigns", panel: "Dashboard", settings: "Settings" },
  mainNav: "Sections",
  pendingCalls: (n) => `${n} to call`,
  userMenu: "User menu",
  switchUser: "Switch user",
  offline: { title: "Can’t reach the server", body: "Check the iPad’s Wi-Fi. You’re still signed in." },
  appearance: {
    title: "Appearance",
    description: "Saved on this device and applies to everyone who uses it.",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "Automatic",
    systemHint: "Follows the iPad’s light or dark mode.",
    language: "Language",
    languageHint: "Changes the app’s language. Messages to clients don’t change: edit them in Settings → Messages.",
  },
}
