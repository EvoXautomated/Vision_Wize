const DEV_SECRETS = ['dev-secret', 'dev-secret-change-me'];

/**
 * Comprueba el entorno al arrancar. En producción `APP_SECRET` firma los
 * enlaces de baja: sin un valor propio y largo cualquiera podría falsificarlos.
 */
export function validateEnv(env: Record<string, unknown>) {
  if (env.NODE_ENV !== 'production') return env;
  const secret = typeof env.APP_SECRET === 'string' ? env.APP_SECRET : '';
  if (secret.length < 32 || DEV_SECRETS.includes(secret)) {
    throw new Error('APP_SECRET debe ser un valor aleatorio de al menos 32 caracteres en producción');
  }
  return env;
}
