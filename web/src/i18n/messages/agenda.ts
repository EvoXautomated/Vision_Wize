/** Agenda semanal de citas. */
export const es = {
  title: "Agenda",
  previousWeek: "Semana anterior",
  today: "Hoy",
  nextWeek: "Semana siguiente",
  /** Primer y último día de la semana, ya con formato. */
  range: (from: string, to: string) => `${from} – ${to}`,
  newAppointment: "Nueva cita",
  queryLabel: "las citas",
  hint: "Al agendar se envía la confirmación al cliente y, 24 horas antes, un recordatorio. Pulsa un día para agendar en esa fecha.",
}

export const en: typeof es = {
  title: "Schedule",
  previousWeek: "Previous week",
  today: "Today",
  nextWeek: "Next week",
  range: (from, to) => `${from} – ${to}`,
  newAppointment: "New appointment",
  queryLabel: "the appointments",
  hint: "When you schedule an appointment, the client gets a confirmation and, 24 hours before, a reminder. Tap a day to schedule on that date.",
}
