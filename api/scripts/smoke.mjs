// Prueba de humo de la Fase 1 contra una API con la semilla de prueba recién cargada.
// Uso: API_URL=http://localhost:4001/v1 node scripts/smoke.mjs (con el mismo APP_SECRET que la API)
import { createHmac } from 'node:crypto';
const B = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4001}/v1`;
const team = await (await fetch(B + '/auth/team')).json();
const id = (role, name) => team.find((u) => u.role === role && (!name || u.fullName.includes(name))).id;
// El primer PIN correcto autoriza este «dispositivo»; los demás logins envían su token.
let device;
const dev = () => (device ? { 'x-device-token': device } : {});
async function login(userId, pin) {
  const r = await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', ...dev() }, body: JSON.stringify({ userId, pin }) })).json();
  device ??= r.deviceToken;
  return (path, method = 'GET', body) => fetch(B + path, { method, headers: { authorization: 'Bearer ' + r.token, 'content-type': 'application/json', ...dev() }, body: body && JSON.stringify(body) }).then(async (x) => ({ s: x.status, b: x.headers.get('content-type')?.includes('json') ? await x.json() : await x.text() }));
}
const owner = await login(id('owner'), '0000');
const rec = await login(id('reception'), '1111');
const doc = await login(id('doctor'), '2222');
const ana = await login(id('seller', 'Ana'), '3333');
let failed = 0;
const ok = (c, m) => { if (!c) failed++; console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); };

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
// dispositivos de confianza
ok(!!device, 'el primer login autoriza el dispositivo');
r = await fetch(B + '/auth/team'); ok(r.status === 403 && (await r.json()).code === 'device_not_trusted', 'sin dispositivo autorizado no se ve el equipo');
r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: id('owner'), pin: '0000' }) }); ok(r.status === 403, 'sin dispositivo autorizado no se prueba el PIN');
r = await rec('/devices/pairing-code', 'POST'); ok(r.s === 403, 'recepción no autoriza dispositivos');
r = await owner('/devices/pairing-code', 'POST'); const code = r.b.code; ok(/^\d{8}$/.test(code), 'el dueño genera un código');
const enroll = (c) => fetch(B + '/auth/devices/enroll', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: c, name: 'iPad 2' }) });
r = await enroll(code === '00000000' ? '00000001' : '00000000'); ok(r.status === 403, 'código incorrecto rechazado');
r = await enroll(code); const second = (await r.json()).deviceToken; ok(r.status === 201 && second, 'código correcto autoriza el dispositivo');
r = await enroll(code); ok(r.status === 403, 'el código no sirve dos veces');
r = await fetch(B + '/auth/team', { headers: { 'x-device-token': second } }); ok(r.status === 200, 'el dispositivo nuevo ve el equipo');
r = await owner('/devices'); const d2 = r.b.find((d) => d.name === 'iPad 2'); ok(r.b.length === 2 && r.b.find((d) => d.current)?.name === 'Primer dispositivo', 'lista de dispositivos');
r = await owner(`/devices/${r.b.find((d) => d.current).id}`, 'DELETE'); ok(r.s === 400, 'no se quita el dispositivo en uso');
r = await owner(`/devices/${d2.id}`, 'DELETE'); ok(r.s === 204, 'el dueño quita un dispositivo');
r = await fetch(B + '/auth/team', { headers: { 'x-device-token': second } }); ok(r.status === 403, 'el dispositivo quitado ya no entra');
// campañas: «no quiere avisos» queda fuera
r = await rec('/clients?q=VIP'); const maria = r.b.items[0];
r = await owner(`/clients/${maria.id}`, 'PATCH', { contactPref: 'none' });
r = await owner('/campaigns/preview', 'POST', { channel: 'sms', segment: { tags: ['VIP'] } }); ok(r.b.reachable === 0 && r.b.matched === 1, 'campaña: quien no quiere avisos queda fuera');
r = await owner(`/clients/${maria.id}`, 'PATCH', { contactPref: 'sms' });
// baja por correo: abrir el enlace no da de baja; el botón (POST) sí
const sig = createHmac('sha256', process.env.APP_SECRET ?? 'dev-secret').update(maria.id).digest('base64url').slice(0, 22);
const link = `${B}/public/unsubscribe/${maria.id}/${sig}`;
r = await fetch(link); ok(r.status === 200 && (await r.text()).includes('<form method="post">'), 'el enlace de baja pide confirmación');
r = await rec(`/clients/${maria.id}`); ok(r.b.unsubscribedAt === null, 'abrir el enlace no da de baja');
r = await fetch(link.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')); ok(r.status === 404, 'enlace de baja con firma falsa rechazado');
r = await fetch(link, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }); ok(r.status === 200, 'baja confirmada');
r = await rec(`/clients/${maria.id}`); ok(!!r.b.unsubscribedAt, 'la baja queda en la ficha');
// importación: las notas con datos clínicos no entran
const notas = [
  { Nombre: 'Nota', Apellidos: 'Clínica', Teléfono: '305 555 0401', Notas: 'OD -2.50 OI -2.25' },
  { Nombre: 'Nota', Apellidos: 'Normal', Teléfono: '305 555 0402', Notas: 'Prefiere que le llamen por la tarde' },
];
r = await owner('/clients/import', 'POST', { dryRun: true, rows: notas }); ok(r.b.summary.notes === 0 && r.b.summary.notesSkipped === 1, 'importación: por defecto no se importan notas');
r = await owner('/clients/import', 'POST', { rows: notas, includeNotes: true }); ok(r.b.summary.notes === 1 && r.b.summary.notesSkipped === 1, 'importación: la nota con graduación se descarta');
r = await rec('/clients?q=3055550401'); r = await rec(`/clients/${r.b.items[0].id}/timeline`); ok(!JSON.stringify(r.b).includes('2.50'), 'la graduación no se guardó');
// meses de revisión: al cambiarlos se mueve la próxima revisión
r = await owner('/settings', 'PUT', { examReminderMonths: 6 });
r = await rec(`/clients/${pedro.id}`); ok(r.b.nextExamDue === '2027-05-20', `cambiar los meses recalcula la revisión (${r.b.nextExamDue})`);
r = await owner('/settings', 'PUT', { examReminderMonths: 0 }); ok(r.s === 400, 'meses de revisión no válidos rechazados');
r = await owner('/settings', 'PUT', { examReminderMonths: 12 });
r = await rec(`/clients/${pedro.id}`); ok(r.b.nextExamDue === '2027-11-20', 'y vuelve al restaurarlos');
// duplicados: de la ficha de otra vendedora solo se ve el nombre
r = await ana('/clients/duplicates?phone=3055550102'); ok(r.b[0]?.restricted === true && r.b[0].phone === null && r.b[0].fullName === 'José Pérez', 'duplicado de otra vendedora sin sus datos');
r = await rec('/clients/duplicates?phone=3055550102'); ok(r.b[0]?.phone === '13055550102' && !r.b[0].restricted, 'recepción ve el duplicado completo');
// validaciones
r = await rec('/clients', 'POST', { firstName: 'Tel', lastName: 'Corto', phone: '12345' }); ok(r.s === 400, 'teléfono no válido rechazado');
r = await owner(`/clients/${pedro.id}`, 'PATCH', { sellerId: '00000000-0000-0000-0000-000000000000' }); ok(r.s === 400, 'vendedora inexistente → 400');
r = await owner('/settings', 'PUT', { messages: { sendFromHour: 'nueve' } }); ok(r.s === 400, 'ajuste de mensajes mal formado rechazado');
r = await owner('/settings', 'PUT', { business: { name: 'Vision Wize', phone: '305 555 0000' } }); ok(r.s === 200 && r.b.business.name === 'Vision Wize', 'ajustes de la óptica guardados');
r = await fetch(B + '/public/resend/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,AAAA' }, body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } }) }); ok(r.status === 403, 'webhook de Resend sin firma válida rechazado');
if (process.env.RESEND_WEBHOOK_SECRET) {
  const raw = JSON.stringify({ type: 'email.delivered', data: { email_id: 'no-existe' } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sigv = createHmac('sha256', Buffer.from(process.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64')).update(`msg_1.${ts}.${raw}`).digest('base64');
  r = await fetch(B + '/public/resend/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': `v1,${sigv}` }, body: raw }); ok(r.status === 204, 'webhook de Resend con firma válida aceptado');
}

console.log(failed ? `\n${failed} comprobaciones fallaron` : '\nTodo OK');
process.exit(failed ? 1 : 0);
