const DEV_SECRETS = ['dev-secret', 'dev-secret-change-me'];

/**
 * Comprueba el entorno al arrancar. En producción no se arranca con valores
 * de desarrollo: `APP_SECRET` firma los enlaces de baja, `PUBLIC_API_URL` va
 * en esos enlaces y en los avisos de Twilio, y `CORS_ORIGIN` limita qué web
 * puede llamar a la API.
 */
export function validateEnv(env: Record<string, unknown>) {
  // En Render la dirección pública la da el propio servicio.
  if (!env.PUBLIC_API_URL && typeof env.RENDER_EXTERNAL_URL === 'string') {
    env.PUBLIC_API_URL = env.RENDER_EXTERNAL_URL;
    process.env.PUBLIC_API_URL = env.RENDER_EXTERNAL_URL;
  }
  if (env.NODE_ENV !== 'production') return env;
  const str = (key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');
  const problems: string[] = [];
  const secret = str('APP_SECRET');
  if (secret.length < 32 || DEV_SECRETS.includes(secret)) {
    problems.push('APP_SECRET debe ser un valor aleatorio de al menos 32 caracteres');
  }
  if (!str('PUBLIC_API_URL').startsWith('https://')) {
    problems.push('PUBLIC_API_URL debe ser la dirección pública de la API, con https://');
  }
  const origins = str('CORS_ORIGIN').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*')) {
    problems.push('CORS_ORIGIN debe indicar la dirección de la web, o «none» si la web usa su puente /api (no «*»)');
  }
  if (problems.length) throw new Error(`Entorno de producción incompleto: ${problems.join('; ')}`);
  return env;
}
