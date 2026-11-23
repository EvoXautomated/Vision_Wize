/** «Por llamar»: avisos para clientes a los que no se les puede escribir. */
export const es = {
  title: "Por llamar",
  subtitle: "Clientes que tienen un aviso pendiente y no tienen SMS ni correo con permiso.",
  queryLabel: "las llamadas pendientes",
  empty: "No hay llamadas pendientes. 🎉",
  lastExam: (date: string) => `último examen ${date}`,
  /** `body` es el texto del aviso (contenido, no se traduce). */
  whatToSay: (body: string) => `Qué decirle: ${body}`,
  /** Resultado de la llamada: el texto del botón es lo que se guarda en el historial. */
  outcomes: {
    booked: "Agendó cita",
    leftMessage: "Le dejé mensaje",
    willCall: "Llamará él",
    notInterested: "No le interesa",
  },
  recorded: "Llamada registrada",
}

export const en: typeof es = {
  title: "To call",
  subtitle: "Clients with a pending notification and no permission to text or email them.",
  queryLabel: "the pending calls",
  empty: "No pending calls. 🎉",
  lastExam: (date) => `last exam ${date}`,
  whatToSay: (body) => `What to say: ${body}`,
  outcomes: {
    booked: "Booked an appointment",
    leftMessage: "Left a message",
    willCall: "Will call back",
    notInterested: "Not interested",
  },
  recorded: "Call logged",
}
