export const es = {
  who: "¿Quién eres?",
  noConnection: "No hay conexión con el servidor. Revisa el wifi e inténtalo de nuevo.",
  hello: (name: string) => `Hola, ${name}`,
  enterPin: "Escribe tu PIN",
  failed: "No se pudo entrar",
  chooseOther: "Elegir otra persona",
  enroll: {
    title: "Autoriza este dispositivo",
    body: "Pídele al dueño un código: lo genera en Ajustes → Equipo → Dispositivos autorizados, desde un dispositivo que ya esté autorizado.",
    code: "Código de 8 dígitos",
    name: "Nombre de este dispositivo",
    namePlaceholder: "iPad de recepción…",
    incomplete: "Escribe los 8 dígitos del código y un nombre para el dispositivo.",
    submit: "Autorizar dispositivo",
    submitting: "Autorizando…",
  },
}

export const en: typeof es = {
  who: "Who’s signing in?",
  noConnection: "Can’t reach the server. Check the Wi-Fi and try again.",
  hello: (name) => `Hi, ${name}`,
  enterPin: "Enter your PIN",
  failed: "Couldn’t sign in",
  chooseOther: "Choose someone else",
  enroll: {
    title: "Authorize this device",
    body: "Ask the owner for a code: they create it in Settings → Team → Authorized devices, from a device that’s already authorized.",
    code: "8-digit code",
    name: "Name for this device",
    namePlaceholder: "Front desk iPad…",
    incomplete: "Enter the 8-digit code and a name for the device.",
    submit: "Authorize device",
    submitting: "Authorizing…",
  },
}
