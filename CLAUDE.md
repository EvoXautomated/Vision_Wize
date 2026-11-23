# Vision Wize · CRM de la óptica

Monorepo: `api/` (NestJS + Prisma + PostgreSQL) y `web/` (Next.js + shadcn/ui, PWA para iPad). Ver README.md.

## Skills que hay que usar

- **Diseño e interfaz**: `.claude/skills/web-design-guidelines`. Al crear o cambiar pantallas de `web/`, revisar los archivos tocados contra `references/command.md` antes de dar el trabajo por terminado.
- **Arquitectura de componentes React**: `.claude/skills/composition-patterns`. Al crear o refactorizar componentes de `web/` seguir sus reglas: composición en vez de props booleanas, compound components, estado en providers y React 19 (`use()` y sin `forwardRef`).

### Adaptaciones al proyecto (prevalecen sobre las guías)

- La interfaz está en **español de EE. UU.**: mayúscula solo al inicio de títulos y botones (no Title Case), comillas «» o “”, y «…» en lugar de «...».
- Público: una tienda con iPad. Los objetivos táctiles son grandes (`size="lg"`), se usa `<select>` nativo y se escribe en segunda persona de usted en los textos al cliente.
- Las graduaciones, los diagnósticos y los seguros médicos nunca se guardan (contrato, cláusula 10.4).
- Los SMS salen en GSM-7, sin tildes (`toGsm`): cuidar la longitud de los textos.

## Comprobaciones

- API: `npx tsc --noEmit`, `npx vitest run` y la prueba de humo `scripts/smoke.mjs` contra una base nueva.
- Web: `npx tsc --noEmit`, `npx eslint src` y `npm run build`. Probar en el navegador a 1180×820 (iPad horizontal).
