import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { knownMessages, knownPatterns, langOf, localize } from './error-i18n.js';

const SRC = join(import.meta.dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : sources(path);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && e.name !== 'error-i18n.ts' ? [path] : [];
  });
}

/** Textos fijos que el código lanza como error o mete en el informe de importación. */
function thrownMessages(): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  const patterns = [
    /Exception\(\s*'([^']+)'/g,
    /message: '([^']+)'/g,
    /errors\.push\('([^']+)'\)/g,
    /HttpStatus\.\w+, '([^']+)'\]/g,
    /(?:return|\?|:|,) '([A-ZÁÉÍÓÚ][^']{12,})'/g,
  ];
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8');
    const validation = file.endsWith('settings.validation.ts');
    patterns.forEach((re, i) => {
      // El último patrón (frases sueltas) solo vale para la validación de ajustes.
      if (i === patterns.length - 1 && !validation) return;
      for (const m of code.matchAll(re)) found.push({ file, text: m[1] });
    });
  }
  return found;
}

describe('errores de la API en inglés', () => {
  it('todo mensaje fijo que lanza el código tiene traducción', () => {
    const known = new Set(knownMessages());
    const missing = thrownMessages().filter((m) => !known.has(m.text) && !knownPatterns().some((p) => p.test(m.text)));
    expect(missing).toEqual([]);
  });

  it('el escaneo encuentra los mensajes (no pasa en vacío)', () => {
    expect(thrownMessages().length).toBeGreaterThan(40);
  });

  it('en español no cambia nada, salvo los textos en inglés de Nest', () => {
    expect(localize('Cliente no encontrado', 'es')).toBe('Cliente no encontrado');
    expect(localize('Forbidden resource', 'es')).toBe('No tienes permiso para hacer esto');
  });

  it('traduce frases fijas, con datos y listas de validación', () => {
    expect(localize('Cliente no encontrado', 'en')).toBe('Client not found');
    expect(localize('Demasiados intentos. Prueba de nuevo en 1 minuto', 'en')).toBe('Too many attempts. Try again in 1 minute');
    expect(localize('Demasiados intentos. Prueba de nuevo en 5 minutos', 'en')).toBe('Too many attempts. Try again in 5 minutes');
    expect(localize('El PIN son 4 dígitos; Correo no válido', 'en')).toBe('The PIN is 4 digits; Invalid email');
    expect(localize('fila 7 del archivo', 'en')).toBe('row 7 of the file');
  });

  it('deja tal cual lo que no conoce', () => {
    expect(localize('phone must be a string', 'en')).toBe('phone must be a string');
  });

  it('elige el idioma por la preferencia principal', () => {
    expect(langOf('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(langOf('es-US,es;q=0.9,en;q=0.8')).toBe('es');
    expect(langOf(undefined)).toBe('es');
  });
});
