import { fold } from './normalize.js';

/**
 * ¿El texto parece una graduación, un diagnóstico o un seguro médico? Esos
 * datos no se guardan nunca (contrato, cláusula 10.4), así que las notas
 * importadas que lo parecen se descartan. Es una criba prudente: prefiere
 * descartar una nota inocente a guardar una receta.
 */
export function looksClinical(text: string): boolean {
  // Ojo derecho/izquierdo, tal como se anotan en una receta (en mayúsculas).
  if (/\b(OD|OI|OS|OU|AO|RX|DP|DNP)\b/.test(text)) return true;
  // Dioptrías con signo (-2.50, +1,75) o agudeza visual (20/40).
  if (/[+-]\s?\d{1,2}[.,]\d{2}\b/.test(text) || /\b20\/\d{2,3}\b/.test(text)) return true;
  return CLINICAL_WORDS.test(fold(text));
}

const CLINICAL_WORDS = new RegExp(
  `\\b(${[
    'esf', 'esfera', 'cil', 'cilindro', 'eje', 'sph', 'cyl', 'axis', 'adicion', 'prisma',
    'dioptrias?', 'graduacion', 'receta', 'prescripcion', 'prescription',
    'miopia', 'miope', 'astigmatismo', 'hipermetropia', 'presbicia', 'cataratas?', 'glaucoma',
    'queratocono', 'retinopatia', 'diabet\\w*', 'hipertens\\w*', 'diagnostico', 'diagnosis',
    'seguro medico', 'aseguradora', 'poliza', 'insurance', 'medicaid', 'medicare',
    'vsp', 'eyemed', 'aetna', 'cigna', 'humana',
  ].join('|')})\\b`,
);
