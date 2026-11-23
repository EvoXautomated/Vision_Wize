import { isGsm, toGsm } from './gsm.js';

describe('toGsm', () => {
  it('quita las tildes que no son GSM y conserva ñ, é, ¿ y ¡', () => {
    expect(toGsm('¿Le agendamos su revisión? Está todo listo, señora José')).toBe(
      '¿Le agendamos su revision? Esta todo listo, señora José',
    );
  });

  it('cambia comillas tipográficas, rayas y puntos suspensivos', () => {
    expect(toGsm('“Hola” – nos vemos…')).toBe('"Hola" - nos vemos...');
  });

  it('deja el texto en GSM-7 (160 caracteres por SMS)', () => {
    expect(isGsm(toGsm('Úrsula, último día: 20 % en monturas'))).toBe(true);
  });

  it('no toca lo que no tiene equivalente (emoji)', () => {
    expect(toGsm('Gracias 😊')).toBe('Gracias 😊');
  });
});
