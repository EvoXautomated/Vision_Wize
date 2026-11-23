import { describe, expect, it } from 'vitest';
import { looksClinical } from './clinical.js';

describe('looksClinical', () => {
  it.each([
    'OD -2.50 OI -2.25',
    'esf +1,75 cil -0.50 eje 90',
    'Miopía y astigmatismo',
    'Agudeza 20/40',
    'Seguro médico: VSP',
    'Paciente diabético',
  ])('descarta «%s»', (t) => expect(looksClinical(t)).toBe(true));

  it.each([
    'Prefiere que le llamen por la tarde',
    'Le gustan las monturas Ray-Ban negras',
    'Viene con su hija. Segundo par al 50 %',
    'No está seguro de la fecha',
  ])('deja pasar «%s»', (t) => expect(looksClinical(t)).toBe(false));
});
