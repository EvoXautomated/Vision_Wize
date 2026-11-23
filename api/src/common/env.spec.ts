import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.js';

const prod = {
  NODE_ENV: 'production',
  APP_SECRET: 'x'.repeat(32),
  PUBLIC_API_URL: 'https://api.example.com',
  CORS_ORIGIN: 'https://app.example.com',
};

describe('validateEnv', () => {
  it('no exige nada fuera de producción', () => expect(validateEnv({})).toEqual({}));
  it('acepta un entorno de producción completo', () => expect(validateEnv(prod)).toBe(prod));
  it('acepta CORS_ORIGIN «none» y toma la dirección pública de Render', () => {
    const env = { ...prod, CORS_ORIGIN: 'none', PUBLIC_API_URL: undefined, RENDER_EXTERNAL_URL: 'https://api.onrender.com' };
    expect(validateEnv(env).PUBLIC_API_URL).toBe('https://api.onrender.com');
    delete process.env.PUBLIC_API_URL;
  });
  it.each([
    ['APP_SECRET corto', { APP_SECRET: 'corto' }],
    ['APP_SECRET de desarrollo', { APP_SECRET: 'dev-secret-change-me' }],
    ['PUBLIC_API_URL sin https', { PUBLIC_API_URL: 'http://localhost:4000' }],
    ['CORS_ORIGIN abierto', { CORS_ORIGIN: '*' }],
    ['CORS_ORIGIN vacío', { CORS_ORIGIN: '' }],
  ])('rechaza %s', (_name, patch) => expect(() => validateEnv({ ...prod, ...patch })).toThrow(/producción/));
});
