import { Role } from '../generated/prisma/client.js';

/**
 * Qué puede hacer cada rol. El dueño siempre puede todo. Estos son los valores
 * por defecto; la óptica puede cambiarlos (ajuste `permissions`), salvo los
 * marcados como solo del dueño.
 */
export const DEFAULT_PERMISSIONS = {
  /** Ver fichas de clientes. */
  'clients.read': [Role.reception, Role.doctor, Role.seller],
  /** Crear y editar datos de contacto, etiquetas y notas. */
  'clients.write': [Role.reception, Role.seller],
  /** Ver clientes de otras vendedoras (si no, la vendedora ve solo los suyos). */
  'clients.readAll': [Role.reception, Role.doctor],
  /** Ver la montura comprada y el historial de ventas. */
  'sales.read': [Role.reception, Role.seller],
  /** Poner o corregir la fecha del examen. */
  'exam.write': [Role.doctor],
  /** Agendar, mover y cancelar citas. */
  'appointments.write': [Role.reception],
  /** Unir fichas duplicadas. */
  'clients.merge': [] as Role[],
  /** Exportar clientes a Excel/CSV. */
  'clients.export': [] as Role[],
  /** Enviar campañas. */
  'campaigns.send': [] as Role[],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof DEFAULT_PERMISSIONS;

/** Siempre exclusivas del dueño, no configurables. */
export const OWNER_ONLY = [
  'users.manage',
  'settings.manage',
  'clients.delete',
  'clients.import',
] as const;
export type OwnerOnly = (typeof OWNER_ONLY)[number];

export const PERMISSIONS = Object.keys(DEFAULT_PERMISSIONS) as Permission[];

/** Estados a los que puede mover una visita cada rol (el dueño, a cualquiera). */
export const VISIT_TARGETS: Record<Exclude<Role, 'owner'>, string[]> = {
  reception: ['exam', 'sale', 'delivered', 'cancelled'],
  doctor: ['exam', 'sale'],
  seller: ['sale', 'ready', 'delivered', 'cancelled'],
};
