# Vision Wize · Sistema para la óptica

Sistema por fases para una óptica de una sola tienda: **CRM de clientes (Fase 1)**, inventario de monturas (Fase 2) y web con catálogo y reservas (Fase 3). Este repositorio contiene la Fase 1.

| Carpeta | Qué es | Stack |
|---|---|---|
| `api/` | API REST | NestJS 12 · Prisma 7 · PostgreSQL 17 |
| `web/` | App para el iPad (PWA) | Next.js 16 · React 19 · shadcn/ui · TanStack Query |

## Fase 1 · qué incluye

- **Equipo y permisos**: dueño, recepción, médico y vendedora. Cada persona entra con su PIN de 4 dígitos (bloqueo tras 5 intentos). Los permisos se comprueban en la API y el dueño puede ajustarlos desde *Ajustes → Permisos*.
- **Ficha de cliente**: datos de contacto, cumpleaños, preferencia de aviso, consentimiento de SMS y correo con fecha, vendedora, etiquetas, notas y un historial con todo lo ocurrido.
- **Sin duplicados**: búsqueda por nombre (sin acentos), teléfono, correo o etiqueta; aviso al registrar si ya existe, y unión de fichas sin perder historial.
- **Visitas**: recepción → examen → venta → lentes listos → entregado, con la pantalla *Hoy*. De cada examen se guarda **solo la fecha**: ni graduaciones ni diagnósticos.
- **Agenda**: citas por semana, con confirmación al agendar y recordatorio 24 h antes.
- **Seguimiento automático**: revisión anual (con segundo aviso), «lentes listos», bienvenida y cumpleaños. Si se corrige la fecha del examen, el aviso se recalcula. Las bajas se respetan siempre. Los clientes sin SMS ni correo con permiso pasan a la lista *Por llamar*.
- **Importación desde Excel/CSV** con un informe previo, y **exportación** a CSV.
- **Nada se borra del todo**: borrado lógico y registro de cambios (`AuditLog`).

Pendiente en la Fase 1: campañas por segmentos con envío de prueba y resultados, y el panel del dueño.

## Puesta en marcha (desarrollo)

Requisitos: Node 24 y Docker.

```bash
docker run -d --name optica-pg -e POSTGRES_USER=optica -e POSTGRES_PASSWORD=optica \
  -e POSTGRES_DB=optica -p 5434:5432 -v optica-pgdata:/var/lib/postgresql/data postgres:17

cd api && cp .env.example .env && npm install && npx prisma migrate deploy && npm run db:seed && npm run start:dev
cd web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3010
```

La semilla crea al dueño (PIN `0000`) y, con `SEED_DEMO=true`, un equipo de prueba: recepción `1111`, médico `2222` y vendedoras `3333` y `4444`. La documentación de la API está en http://localhost:4000/docs.

**Mensajes**: si no se configuran `RESEND_API_KEY`/`EMAIL_FROM` (correo) y `TWILIO_*` (SMS), los envíos quedan registrados en *modo prueba* y no salen. Para SMS en EE. UU. hace falta el registro A2P 10DLC.

**Prueba de humo** (contra una base con la semilla recién cargada):

```bash
API_URL=http://localhost:4000/v1 node api/scripts/smoke.mjs
```
