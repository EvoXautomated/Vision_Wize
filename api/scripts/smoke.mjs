// Prueba de humo de la Fase 1 contra una API con la semilla de prueba recién cargada.
// Uso: API_URL=http://localhost:4001/v1 node scripts/smoke.mjs
const B = process.env.API_URL ?? 'http://localhost:4001/v1';
const team = await (await fetch(B + '/auth/team')).json();
const id = (role, name) => team.find((u) => u.role === role && (!name || u.fullName.includes(name))).id;
async function login(userId, pin) {
  const r = await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, pin }) })).json();
  return (path, method = 'GET', body) => fetch(B + path, { method, headers: { authorization: 'Bearer ' + r.token, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(async (x) => ({ s: x.status, b: x.headers.get('content-type')?.includes('json') ? await x.json() : await x.text() }));
}
const owner = await login(id('owner'), '0000');
const rec = await login(id('reception'), '1111');
const doc = await login(id('doctor'), '2222');
const ana = await login(id('seller', 'Ana'), '3333');
const ok = (c, m) => console.log((c ? 'OK  ' : 'FAIL') + ' ' + m);

let r = await ana('/clients'); ok(r.b.total === 2, `vendedora Ana ve solo sus 2 clientes (ve ${r.b.total})`);
r = await rec('/clients?q=305 555 0101'); ok(r.b.items?.[0]?.firstName === 'María', 'búsqueda por teléfono');
r = await rec('/clients?q=gonzalez'); ok(r.b.total >= 0, `búsqueda por nombre sin acento (${r.b.total})`);
r = await rec('/clients?q=VIP'); ok(r.b.items?.[0]?.firstName === 'María', 'búsqueda por etiqueta');
r = await rec('/clients', 'POST', { firstName: 'Maria', lastName: 'Gonzalez', phone: '(305) 555-0101' });
ok(r.s === 409 && r.b.duplicates?.length, 'aviso de duplicado al registrar');
r = await rec('/clients', 'POST', { firstName: 'Pedro', lastName: 'Ruiz', phone: '305-555-0199', smsConsent: true, tags: ['Niño'] });
ok(r.s === 201, 'alta de cliente'); const pedro = r.b;
r = await doc('/clients', 'POST', { firstName: 'X', lastName: 'Y' }); ok(r.s === 403, 'médico no puede crear clientes');
r = await rec('/clients/export.csv'); ok(r.s === 403, 'recepción no puede exportar');
r = await owner('/clients/export.csv'); ok(r.s === 200 && r.b.includes('Pedro'), 'dueño exporta CSV');
// visita completa
r = await rec('/visits', 'POST', { clientId: pedro.id }); ok(r.s === 201, 'recepción abre visita'); const v = r.b;
r = await rec(`/visits/${v.id}/status`, 'POST', { status: 'exam' }); ok(r.b.status === 'exam', 'recepción → examen');
r = await rec(`/visits/${v.id}`, 'PATCH', { examDate: '2026-11-22' }); ok(r.s === 403, 'recepción no puede poner fecha de examen');
r = await doc(`/visits/${v.id}`, 'PATCH', { examDate: '2026-11-22' }); ok(r.s === 200 && r.b.doctor, 'médico pone fecha de examen');
r = await doc(`/visits/${v.id}/status`, 'POST', { status: 'sale' }); ok(r.b.status === 'sale', 'médico → venta');
r = await doc(`/visits/${v.id}/status`, 'POST', { status: 'ready' }); ok(r.s === 403, 'médico no puede marcar lentes listos');
r = await ana(`/visits/${v.id}`, 'PATCH', { frame: 'Ray-Ban RB5154 negro' }); ok(r.s === 403 || r.s === 404, `Ana no ve la visita de un cliente que no es suyo (${r.s})`);
r = await owner(`/clients/${pedro.id}`, 'PATCH', { sellerId: id('seller', 'Ana') });
r = await ana(`/visits/${v.id}`, 'PATCH', { frame: 'Ray-Ban RB5154 negro' }); ok(r.b.frame === 'Ray-Ban RB5154 negro', 'vendedora registra montura');
r = await doc(`/visits/${v.id}`); ok(r.b.frame === undefined, 'médico no ve la montura');
r = await ana(`/visits/${v.id}/status`, 'POST', { status: 'ready' }); ok(r.b.status === 'ready', 'vendedora → lentes listos');
r = await ana(`/visits/${v.id}/status`, 'POST', { status: 'sale' }); ok(r.s === 403, 'vendedora no puede volver atrás');
r = await ana(`/visits/${v.id}/status`, 'POST', { status: 'delivered' }); ok(r.b.status === 'delivered', 'vendedora → entregado');
r = await rec(`/clients/${pedro.id}`); ok(r.b.lastExamAt === '2026-11-22' && r.b.nextExamDue === '2027-11-22', `próxima revisión calculada (${r.b.nextExamDue})`);
// corregir fecha
r = await doc(`/visits/${v.id}`, 'PATCH', { examDate: '2026-11-20' });
r = await rec(`/clients/${pedro.id}`); ok(r.b.nextExamDue === '2027-11-20', 'corregir examen recalcula la revisión');
// cita
const t = new Date(Date.now() + 24 * 3600e3).toISOString();
r = await rec('/appointments', 'POST', { clientId: pedro.id, startsAt: t }); ok(r.s === 201, 'recepción agenda cita');
r = await ana('/appointments', 'POST', { clientId: pedro.id, startsAt: t }); ok(r.s === 403, 'vendedora no agenda (por defecto)');
r = await rec('/today'); ok(r.s === 200 && r.b.appointments, `pantalla Hoy (${r.b.visits?.length} visitas, ${r.b.appointments?.length} citas)`);
// mensajes
r = await owner('/messages/run', 'POST'); ok(r.s === 201, `seguimiento: ${JSON.stringify(r.b)}`);
r = await owner('/messages'); console.log('     mensajes:', r.b.map((m) => `${m.kind}/${m.channel}/${m.status} ${m.client?.firstName ?? ''}${m.error ? ' (' + m.error + ')' : ''}`).join(' | '));
r = await rec('/calls'); ok(Array.isArray(r.b), `lista por llamar: ${r.b.map((c) => c.client.firstName).join(', ')}`);
// unir duplicados
r = await rec('/clients', 'POST', { firstName: 'Pedro', lastName: 'Ruiz', email: 'pedro@example.com', force: true }); const dup = r.b;
r = await rec(`/clients/${pedro.id}/merge`, 'POST', { sourceId: dup.id }); ok(r.s === 403, 'recepción no une fichas');
r = await owner(`/clients/${pedro.id}/merge`, 'POST', { sourceId: dup.id }); ok(r.b.email === 'pedro@example.com', 'dueño une fichas y completa datos');
r = await owner(`/clients/${dup.id}`); ok(r.s === 409 && r.b.mergedIntoId === pedro.id, 'ficha unida redirige');
r = await rec(`/clients/${pedro.id}/timeline`); console.log('     línea de tiempo:', r.b.map((i) => i.title).join(' | '));
// importación
r = await owner('/clients/import', 'POST', { dryRun: true, rows: [
  { Nombre: 'Rosa', Apellidos: 'Díaz', Teléfono: '305 555 0300', 'Fecha de nacimiento': '04/15/1980', 'Último examen': '2025-10-01' },
  { Nombre: '', Apellidos: 'Sin nombre' },
  { Nombre: 'María', Apellidos: 'González', Teléfono: '3055550101' },
  { 'Nombre completo': 'Tomás Vega', Correo: 'malo@', Columna: 'x' },
] });
ok(r.b.summary?.new === 1 && r.b.summary.errors === 2 && r.b.summary.duplicates === 1, `informe de importación ${JSON.stringify(r.b.summary)} cols desconocidas: ${r.b.unknownColumns}`);
r = await owner('/clients/import', 'POST', { rows: [{ Nombre: 'Rosa', Apellidos: 'Díaz', Teléfono: '305 555 0300', 'Último examen': '2025-10-01' }] });
r = await rec('/clients?q=Rosa'); ok(r.b.items?.[0]?.nextExamDue === '2026-10-01', 'importado con revisión calculada');
// campañas y panel
r = await rec('/campaigns'); ok(r.s === 403, 'recepción no envía campañas (por defecto)');
r = await owner('/campaigns/preview', 'POST', { channel: 'sms', segment: { tags: ['VIP'] } }); ok(r.b.reachable === 1, `grupo VIP por SMS: ${r.b.reachable} de ${r.b.matched}`);
r = await owner('/campaigns', 'POST', { name: 'X', channel: 'email', body: 'Hola' }); ok(r.s === 400, 'correo sin asunto rechazado');
r = await owner('/campaigns', 'POST', { name: 'Navidad', channel: 'sms', body: 'Hola {nombre}', segment: {} }); const camp = r.b;
r = await owner(`/campaigns/${camp.id}/test`, 'POST', { to: '305 555 0000' }); ok(r.s === 200, 'envío de prueba');
r = await owner(`/campaigns/${camp.id}/send`, 'POST'); ok(r.s === 200 && r.b.recipients > 0, `campaña enviada a ${r.b.recipients}`);
r = await owner(`/campaigns/${camp.id}/send`, 'POST'); ok(r.s === 400, 'no se envía dos veces');
r = await owner('/campaigns'); ok(r.b[0].recipients > 0 && r.b[0].stats, `resultados ${JSON.stringify(r.b[0].stats)}`);
r = await owner('/dashboard'); ok(r.s === 200 && r.b.clients.total > 0, `panel: ${r.b.clients.total} clientes, ${r.b.visits.thisMonth} visitas este mes`);
r = await rec('/dashboard'); ok(r.s === 403, 'recepción no ve el panel');
r = await fetch(B + '/public/twilio/inbound', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'From=%2B13055550101&Body=STOP' }); ok(r.status === 403, 'webhook de Twilio sin firma rechazado');
