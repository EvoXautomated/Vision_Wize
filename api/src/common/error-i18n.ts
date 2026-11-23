/**
 * Los mensajes de la API se escriben en español. Si la app pide inglés
 * (`Accept-Language: en`), se traducen al salir: las frases fijas con la tabla
 * y las que llevan datos con los patrones. Lo que no esté aquí sale tal cual.
 * `error-i18n.spec.ts` comprueba que todo mensaje lanzado tiene traducción.
 */
const EN: Record<string, string> = {
  // Genéricos
  'Ese valor ya existe': 'That value already exists',
  'No encontrado': 'Not found',
  'La persona o el registro indicado no existe': 'That person or record doesn’t exist',
  'Error interno del servidor': 'Internal server error',
  'No tienes permiso para hacer esto': 'You don’t have permission to do this',
  // Acceso
  'Usuario o PIN incorrecto': 'Wrong user or PIN',
  'Sesión caducada o no válida': 'Your session expired or isn’t valid',
  'El PIN son 4 dígitos': 'The PIN is 4 digits',
  'El código son 8 dígitos': 'The code is 8 digits',
  'Este dispositivo no está autorizado. Pide un código al dueño.': 'This device isn’t authorized. Ask the owner for a code.',
  'Código incorrecto o caducado. Pide uno nuevo al dueño.': 'Wrong or expired code. Ask the owner for a new one.',
  'No puedes quitar el dispositivo que estás usando': 'You can’t remove the device you’re using',
  'Dispositivo no encontrado': 'Device not found',
  // Equipo
  'Usuario no encontrado': 'User not found',
  'No puedes darte de baja a ti mismo': 'You can’t remove yourself',
  'Debe quedar al menos un dueño activo': 'At least one active owner must remain',
  // Clientes
  'Ficha unida a otra': 'This record was merged into another one',
  'Cliente no encontrado': 'Client not found',
  'Teléfono no válido': 'Invalid phone number',
  'Correo no válido': 'Invalid email',
  'Fecha con formato aaaa-mm-dd': 'Date must be in yyyy-mm-dd format',
  'Puede que este cliente ya exista': 'This client may already exist',
  'Ese teléfono o correo ya es de otro cliente': 'That phone or email already belongs to another client',
  'No puedes poner la fecha del examen': 'You can’t set the exam date',
  'No puedes cambiar la fecha del examen': 'You can’t change the exam date',
  'Elige dos fichas distintas': 'Choose two different records',
  'Llamada no encontrada': 'Call not found',
  // Importación
  'Falta el nombre': 'Name is missing',
  'Fecha de nacimiento no válida': 'Invalid birth date',
  'Fecha de examen no válida': 'Invalid exam date',
  // Citas y visitas
  'La cita no puede ser en el pasado': 'The appointment can’t be in the past',
  'Cita no encontrada': 'Appointment not found',
  'El cliente ya llegó a esta cita': 'The client already arrived for this appointment',
  'Visita no encontrada': 'Visit not found',
  'Este cliente ya tiene una visita en curso': 'This client already has a visit in progress',
  'La cita no es de este cliente': 'That appointment belongs to another client',
  'No puedes registrar la montura': 'You can’t record the frame',
  'La fecha del examen no puede ser futura': 'The exam date can’t be in the future',
  'Tu rol no puede pasar la visita a ese estado': 'Your role can’t move the visit to that step',
  'Solo el dueño puede reabrir una visita cerrada': 'Only the owner can reopen a closed visit',
  'Solo el dueño puede devolver una visita a un paso anterior': 'Only the owner can move a visit back to an earlier step',
  // Campañas
  'Campaña no encontrada': 'Campaign not found',
  'Elige SMS o correo': 'Choose text or email',
  'El correo necesita un asunto': 'The email needs a subject',
  'Una campaña enviada no se puede cambiar': 'A sent campaign can’t be changed',
  'Una campaña enviada no se puede borrar': 'A sent campaign can’t be deleted',
  'Esta campaña ya se envió': 'This campaign was already sent',
  'No hay nadie a quien enviar en este grupo': 'There’s no one to send to in this group',
  // Ajustes
  'Los meses de revisión deben ser un número entero entre 1 y 60': 'Exam reminder months must be a whole number from 1 to 60',
  'Los días del segundo aviso deben ser un número entero entre 0 y 365': 'Second reminder days must be a whole number from 0 to 365',
  'La duración de la cita debe estar entre 5 y 240 minutos': 'Appointment length must be between 5 and 240 minutes',
  'Los datos de la óptica deben ser textos de hasta 200 caracteres': 'Business details must be text of up to 200 characters',
  'Los mensajes activos no son válidos': 'The enabled messages aren’t valid',
  'El horario de envío debe ir de 0 a 24 horas': 'Sending hours must be between 0 and 24',
  'El horario de envío debe empezar antes de terminar': 'Sending hours must start before they end',
  'smsPlainText debe ser verdadero o falso': 'smsPlainText must be true or false',
  'La firma debe ser un texto de hasta 60 caracteres': 'The signature must be text of up to 60 characters',
  'Las plantillas deben ser textos de hasta 1000 caracteres': 'Templates must be text of up to 1000 characters',
};

/** Mensajes con datos dentro. */
const EN_PATTERNS: [RegExp, (...groups: string[]) => string][] = [
  [/^Demasiados intentos\. Prueba de nuevo en (\d+) minutos?$/, (n) => `Too many attempts. Try again in ${n} minute${n === '1' ? '' : 's'}`],
  [/^No se pudo enviar: (.*)$/s, (why) => `Couldn’t send: ${why}`],
  [/^Ajuste desconocido: (.*)$/, (k) => `Unknown setting: ${k}`],
  [/^(\w+) debe ser un objeto$/, (k) => `${k} must be an object`],
  [/^Dato de la óptica desconocido: (.*)$/, (k) => `Unknown business detail: ${k}`],
  [/^Permiso no válido: (.*)$/, (k) => `Invalid permission: ${k}`],
  [/^Ajuste de mensajes desconocido: (.*)$/, (k) => `Unknown message setting: ${k}`],
  [/^fila (\d+) del archivo$/, (n) => `row ${n} of the file`],
];

/** Mensajes que Nest da en inglés y que la app en español no debe enseñar así. */
const ES: Record<string, string> = {
  'Forbidden resource': 'No tienes permiso para hacer esto',
};

export type Lang = 'es' | 'en';

/** Idioma que pide la app; español salvo que la preferencia principal sea inglés. */
export const langOf = (acceptLanguage: string | undefined): Lang =>
  /^\s*en\b/i.test(acceptLanguage ?? '') ? 'en' : 'es';

function one(message: string, lang: Lang): string {
  if (lang === 'es') return ES[message] ?? message;
  if (EN[message]) return EN[message];
  for (const [pattern, build] of EN_PATTERNS) {
    const m = pattern.exec(message);
    if (m) return build(...m.slice(1));
  }
  return message;
}

/** Traduce un mensaje de la API (o varios unidos con «; », como los de validación). */
export function localize(message: string, lang: Lang): string {
  const whole = one(message, lang);
  if (whole !== message) return whole;
  return message.split('; ').map((part) => one(part, lang)).join('; ');
}

export const knownMessages = () => Object.keys(EN);
export const knownPatterns = () => EN_PATTERNS.map(([p]) => p);
