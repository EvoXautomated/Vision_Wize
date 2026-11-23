/** Diálogo de la visita: estado, fecha del examen, montura, vendedora y notas. */
export const es = {
  /** Aviso al cambiar de estado: «Ana Pérez: Examen». */
  statusChanged: (name: string, status: string) => `${name}: ${status}`,
  saved: "Visita guardada",
  examDate: "Fecha del examen",
  today: "Hoy",
  noExamYet: "Sin examen todavía",
  /** Cláusula 10.4 del contrato: debe quedar igual de claro en todos los idiomas. */
  examHint: "Solo la fecha. El sistema no guarda graduaciones ni diagnósticos.",
  frame: "Montura elegida o comprada",
  framePlaceholder: "Marca, modelo y color",
  seller: "Vendedora",
  unassigned: "Sin asignar",
  notes: "Notas de la visita",
}

export const en: typeof es = {
  statusChanged: (name, status) => `${name}: ${status}`,
  saved: "Visit saved",
  examDate: "Exam date",
  today: "Today",
  noExamYet: "No exam yet",
  examHint: "Date only. The system doesn’t store prescriptions or diagnoses.",
  frame: "Frame chosen or purchased",
  framePlaceholder: "Brand, model, and color",
  seller: "Salesperson",
  unassigned: "Unassigned",
  notes: "Visit notes",
}
