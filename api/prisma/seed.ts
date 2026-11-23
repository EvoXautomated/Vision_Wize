import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const pin = (p: string) => bcrypt.hash(p, 10);

async function main() {
  const owners = await prisma.user.count({ where: { role: Role.owner } });
  if (!owners) {
    if (process.env.NODE_ENV === 'production' && !/^\d{4}$/.test(process.env.SEED_OWNER_PIN ?? '')) {
      throw new Error('En producción indica SEED_OWNER_PIN (4 dígitos) para el PIN inicial del dueño');
    }
    await prisma.user.create({
      data: { fullName: 'Dueño', initials: 'D', role: Role.owner, pinHash: await pin(process.env.SEED_OWNER_PIN ?? '0000') },
    });
    console.log(`Dueño creado con PIN ${process.env.SEED_OWNER_PIN ?? '0000'} (cámbialo al entrar)`);
  }
  if (process.env.SEED_DEMO !== 'true') return;
  if (await prisma.user.count({ where: { role: { not: Role.owner } } })) return;

  const [rec, doc, ana, luz] = await Promise.all(
    [
      ['Rosa Recepción', 'RR', Role.reception, '1111'],
      ['Dr. Marco Díaz', 'MD', Role.doctor, '2222'],
      ['Ana Vendedora', 'AV', Role.seller, '3333'],
      ['Luz Vendedora', 'LV', Role.seller, '4444'],
    ].map(async ([fullName, initials, role, p]) =>
      prisma.user.create({ data: { fullName, initials, role: role as Role, pinHash: await pin(p) } }),
    ),
  );
  console.log('Equipo de prueba: recepción 1111, médico 2222, vendedoras 3333 y 4444');

  const vip = await prisma.tag.create({ data: { name: 'VIP', color: 'amber' } });
  const lc = await prisma.tag.create({ data: { name: 'Lentes de contacto', color: 'sky' } });
  await prisma.tag.create({ data: { name: 'Niño', color: 'emerald' } });

  const ago = (months: number) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - months);
    return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
  };
  const plus12 = (d: Date) => {
    const r = new Date(d);
    r.setUTCMonth(r.getUTCMonth() + 12);
    return r;
  };
  const people = [
    { firstName: 'María', lastName: 'González', phone: '13055550101', email: 'maria@example.com', birthDate: new Date('1984-03-12'), sellerId: ana.id, exam: 12, tags: [vip.id], sms: true },
    { firstName: 'José', lastName: 'Pérez', phone: '13055550102', email: null, birthDate: new Date('1990-07-02'), sellerId: luz.id, exam: 13, tags: [], sms: false },
    { firstName: 'Carmen', lastName: 'Rodríguez', phone: '13055550103', email: 'carmen@example.com', birthDate: null, sellerId: ana.id, exam: 6, tags: [lc.id], sms: true },
    { firstName: 'Luis', lastName: 'Martínez', phone: '13055550104', email: 'luis@example.com', birthDate: new Date('1975-11-30'), sellerId: luz.id, exam: 2, tags: [], sms: true },
    { firstName: 'Ana', lastName: 'López', phone: null, email: 'ana.lopez@example.com', birthDate: null, sellerId: null, exam: null, tags: [], sms: false },
  ];
  for (const p of people) {
    const prior = p.exam == null ? null : ago(p.exam);
    await prisma.client.create({
      data: {
        firstName: p.firstName,
        lastName: p.lastName,
        searchKey: `${p.firstName} ${p.lastName}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
        phone: p.phone,
        email: p.email,
        birthDate: p.birthDate,
        sellerId: p.sellerId,
        smsConsentAt: p.sms ? new Date() : null,
        emailConsentAt: p.email ? new Date() : null,
        priorExamAt: prior,
        lastExamAt: prior,
        nextExamDue: prior ? plus12(prior) : null,
        source: 'Prueba',
        tags: { create: p.tags.map((tagId) => ({ tagId })) },
      },
    });
  }
  void rec;
  void doc;
  console.log('5 clientes de prueba creados');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
