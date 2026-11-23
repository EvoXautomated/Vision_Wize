/** Pantalla «Hoy»: tablero de visitas, citas del día y entregas. */
export const es = {
  title: "Hoy",
  pendingCalls: (n: number) => `${n} por llamar`,
  clientArrived: "Llegó un cliente",
  queryLabel: "las visitas y citas de hoy",
  /** Aviso al dueño: `strong` va en negrita y `rest` sigue en la misma frase. */
  missingBusiness: {
    strong: "Completa los datos de la óptica",
    rest: "(nombre y teléfono) en Ajustes → La óptica. Se usan en los mensajes a los clientes.",
  },
  inReception: (name: string) => `${name} está en recepción`,
  appointmentsToday: "Citas de hoy",
  noAppointments: "No hay citas para hoy.",
  arrived: "Llegó",
  noShow: "No vino",
  deliveredToday: "Entregados hoy",
  noneYet: "Todavía ninguno.",
  pickerTitle: "¿Quién llegó?",
}

export const en: typeof es = {
  title: "Today",
  pendingCalls: (n) => `${n} to call`,
  clientArrived: "Client arrived",
  queryLabel: "today’s visits and appointments",
  missingBusiness: {
    strong: "Fill in the business details",
    rest: "(name and phone) in Settings → Business. They’re used in messages to clients.",
  },
  inReception: (name) => `${name} is at the front desk`,
  appointmentsToday: "Today’s appointments",
  noAppointments: "No appointments today.",
  arrived: "Arrived",
  noShow: "No-show",
  deliveredToday: "Delivered today",
  noneYet: "None yet.",
  pickerTitle: "Who arrived?",
}
