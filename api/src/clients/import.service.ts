import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/decorators.js';
import { looksClinical } from '../common/clinical.js';
import { fold, normalizeEmail, normalizePhone, toDate } from '../common/normalize.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClientsService, searchKeyOf } from './clients.service.js';

/** Nombres de columna aceptados (sin acentos, en minúsculas). */
const ALIASES: Record<string, string[]> = {
  firstName: ['nombre', 'nombres', 'first name', 'firstname', 'first'],
  lastName: ['apellido', 'apellidos', 'last name', 'lastname', 'last', 'surname'],
  fullName: ['nombre completo', 'cliente', 'full name', 'name', 'paciente'],
  phone: ['telefono', 'tel', 'celular', 'movil', 'phone', 'mobile', 'cell', 'whatsapp'],
  email: ['correo', 'email', 'e-mail', 'mail', 'correo electronico'],
  birthDate: ['nacimiento', 'fecha de nacimiento', 'cumpleanos', 'birthday', 'dob', 'birth date', 'fecha nacimiento'],
  address: ['direccion', 'address', 'domicilio'],
  priorExamAt: ['ultimo examen', 'fecha examen', 'examen', 'last exam', 'exam date', 'fecha ultimo examen'],
  tags: ['etiquetas', 'etiqueta', 'tags', 'tag'],
  notes: ['notas', 'nota', 'notes', 'observaciones', 'comentarios'],
  source: ['como nos conocio', 'origen', 'source', 'referido'],
};

const fieldFor = (header: string) => {
  const h = fold(header).replace(/[_.]/g, ' ').replace(/\s+/g, ' ');
  return Object.entries(ALIASES).find(([, a]) => a.includes(h))?.[0];
};

/** Fecha de Excel: aaaa-mm-dd, mm/dd/aaaa (EE. UU.), dd-mm-aaaa o número de serie. */
export function parseDate(v: unknown): string | null | 'invalid' {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d{5}$/.test(String(v))) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/))) [mo, d, y] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{2,4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else return 'invalid';
  if (y < 100) y += y > 30 ? 1900 : 2000;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1900) return 'invalid';
  return date.toISOString().slice(0, 10);
}

export interface ImportRowReport {
  row: number; // número de fila del Excel (la cabecera es la 1)
  name: string;
  status: 'new' | 'duplicate' | 'error';
  errors: string[];
  duplicateOf?: string;
  /** La nota no se importa: parece una graduación, un diagnóstico o un seguro. */
  noteSkipped?: boolean;
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly audit: AuditService,
  ) {}

  /** Convierte la cabecera del archivo en las claves de cliente. */
  mapRows(rows: Record<string, unknown>[]) {
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const map = new Map(headers.map((h) => [h, fieldFor(h)]));
    const unknown = headers.filter((h) => !map.get(h));
    return {
      unknownColumns: unknown,
      rows: rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [h, v] of Object.entries(r)) {
          const f = map.get(h);
          if (f && v !== '' && v != null) out[f] = typeof v === 'string' ? v.trim() : v;
        }
        return out;
      }),
    };
  }

  async run(input: Record<string, unknown>[], dryRun: boolean, user: AuthUser, includeNotes = false) {
    const { rows, unknownColumns } = this.mapRows(input);
    const existing = await this.prisma.client.findMany({
      where: { deletedAt: null, mergedIntoId: null },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
    const byPhone = new Map(existing.filter((c) => c.phone).map((c) => [c.phone!, c]));
    const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!, c]));
    const byName = new Map(existing.map((c) => [fold(`${c.firstName} ${c.lastName}`), c]));
    const seen = new Map<string, number>(); // clave → fila del archivo

    const report: ImportRowReport[] = [];
    const toCreate: { data: Prisma.ClientCreateManyInput; tags: string[]; notes?: string }[] = [];

    rows.forEach((r, i) => {
      const rowNum = i + 2;
      const errors: string[] = [];
      let first = String(r.firstName ?? '');
      let last = String(r.lastName ?? '');
      if (!first && !last && r.fullName) {
        const parts = String(r.fullName).split(/\s+/);
        first = parts.shift() ?? '';
        last = parts.join(' ');
      }
      if (!first) errors.push('Falta el nombre');
      const phone = normalizePhone(r.phone == null ? null : String(r.phone));
      if (r.phone && (!phone || phone.length < 11 || phone.length > 15)) errors.push('Teléfono no válido');
      const email = normalizeEmail(r.email == null ? null : String(r.email));
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Correo no válido');
      const birth = parseDate(r.birthDate);
      if (birth === 'invalid') errors.push('Fecha de nacimiento no válida');
      const exam = parseDate(r.priorExamAt);
      if (exam === 'invalid') errors.push('Fecha de examen no válida');
      const name = `${first} ${last}`.trim();

      if (errors.length) {
        report.push({ row: rowNum, name, status: 'error', errors });
        return;
      }
      const dup =
        (phone && byPhone.get(phone)) ||
        (email && byEmail.get(email)) ||
        (!phone && !email && byName.get(fold(name)));
      if (dup) {
        report.push({ row: rowNum, name, status: 'duplicate', errors: [], duplicateOf: `${dup.firstName} ${dup.lastName}` });
        return;
      }
      const keys = [phone && `p:${phone}`, email && `e:${email}`, !phone && !email && `n:${fold(name)}`].filter(Boolean) as string[];
      const repeated = keys.map((k) => seen.get(k)).find((x) => x);
      if (repeated) {
        report.push({ row: rowNum, name, status: 'duplicate', errors: [], duplicateOf: `fila ${repeated} del archivo` });
        return;
      }
      keys.forEach((k) => seen.set(k, rowNum));
      // Las notas solo entran si se pide, y nunca las que parecen datos clínicos.
      const rawNote = r.notes ? String(r.notes) : undefined;
      const noteSkipped = !!rawNote && looksClinical(rawNote);
      const note = includeNotes && !noteSkipped ? rawNote : undefined;
      report.push({ row: rowNum, name, status: 'new', errors: [], ...(noteSkipped ? { noteSkipped } : {}) });
      toCreate.push({
        data: {
          firstName: first,
          lastName: last,
          searchKey: searchKeyOf(first, last),
          phone,
          email,
          birthDate: toDate(birth as string | null),
          address: r.address ? String(r.address) : null,
          priorExamAt: toDate(exam as string | null),
          source: r.source ? String(r.source) : 'Importación',
        },
        tags: r.tags ? String(r.tags).split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
        notes: note,
      });
    });

    const summary = {
      total: rows.length,
      new: report.filter((r) => r.status === 'new').length,
      duplicates: report.filter((r) => r.status === 'duplicate').length,
      errors: report.filter((r) => r.status === 'error').length,
      /** Notas que se guardarán (0 si no se pidió importarlas). */
      notes: toCreate.filter((c) => c.notes).length,
      /** Notas descartadas por parecer graduaciones, diagnósticos o seguros. */
      notesSkipped: report.filter((r) => r.noteSkipped).length,
    };
    if (dryRun) return { dryRun: true, summary, unknownColumns, rows: report };

    // Sin consentimiento: los importados no reciben marketing hasta que lo den.
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of toCreate) {
          const c = await tx.client.create({ data: item.data });
          if (item.tags.length) {
            for (const name of item.tags) {
              const tag =
                (await tx.tag.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })) ??
                (await tx.tag.create({ data: { name } }));
              await tx.clientTag.create({ data: { clientId: c.id, tagId: tag.id } });
            }
          }
          if (item.notes) {
            await tx.note.create({ data: { clientId: c.id, authorId: user.id, body: item.notes } });
          }
          if (item.data.priorExamAt) await this.clients.recomputeExam(tx, c.id);
        }
        await this.audit.log(user.id, 'import', 'clients', 'create', summary, tx);
      },
      { timeout: 120_000 },
    );
    return { dryRun: false, summary, unknownColumns, rows: report };
  }
}
