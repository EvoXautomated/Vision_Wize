// Prueba de extremo a extremo: crea una base desechable, aplica las
// migraciones y la semilla, arranca la API compilada y pasa la prueba de humo.
// Uso: npm run test:e2e (necesita el Postgres de docker-compose en marcha).
import 'dotenv/config';
import { execFileSync, spawn } from 'node:child_process';
import pg from 'pg';

const base = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!base) throw new Error('Falta DATABASE_URL_TEST (o DATABASE_URL) en api/.env');
// Siempre una base propia, con sufijo: nunca se toca la de desarrollo.
const url = new URL(base);
const name = `${url.pathname.slice(1).replace(/_e2e$/, '')}_e2e`;
url.pathname = `/${name}`;
const admin = new URL(base);
admin.pathname = '/postgres';

const port = process.env.E2E_PORT ?? '4011';
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  PORT: port,
  NODE_ENV: 'test',
  SEED_DEMO: 'true',
  SEED_OWNER_PIN: '0000',
  APP_SECRET: 'e2e-secret',
  DEVICE_TRUST: 'true',
  DISABLE_CRON: 'true',
  RESEND_API_KEY: '',
  TWILIO_ACCOUNT_SID: '',
};
const run = (cmd, args) => execFileSync(cmd, args, { env, stdio: 'inherit' });
const sql = async (text) => {
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
};

let api;
let code = 1;
try {
  await sql(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await sql(`CREATE DATABASE "${name}"`);
  run('npx', ['prisma', 'migrate', 'deploy']);
  run('npx', ['prisma', 'db', 'seed']);
  run('npx', ['nest', 'build']);
  api = spawn('node', ['dist/main.js'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
  const health = `http://localhost:${port}/health`;
  for (let i = 0; ; i++) {
    if (await fetch(health).then((r) => r.ok, () => false)) break;
    if (i > 60 || api.exitCode !== null) throw new Error('La API no arrancó');
    await new Promise((r) => setTimeout(r, 500));
  }
  run('node', ['scripts/smoke.mjs']);
  code = 0;
} catch (e) {
  console.error(e.message);
} finally {
  api?.kill();
  await sql(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => undefined);
}
process.exit(code);
