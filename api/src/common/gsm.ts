/**
 * Alfabeto GSM-7 (básico + extensión). Un SMS que solo usa estos caracteres
 * admite 160 por tramo; con uno solo fuera (á, í, ó, ú, “…”) baja a 70.
 */
const GSM_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€";
const GSM = new Set(GSM_CHARS);

/** Sustituciones habituales que no son una simple tilde. */
const REPLACE: Record<string, string> = {
  '“': '"', '”': '"', '«': '"', '»': '"', '‘': "'", '’': "'", '´': "'",
  '–': '-', '—': '-', '…': '...', '•': '-', '·': '-', ' ': ' ', 'º': 'o', 'ª': 'a',
};

/** Texto apto para SMS de 160 caracteres: quita tildes y signos fuera de GSM-7. */
export function toGsm(text: string): string {
  let out = '';
  for (const ch of text) {
    if (GSM.has(ch)) out += ch;
    else if (REPLACE[ch] !== undefined) out += REPLACE[ch];
    else {
      const base = ch.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      // Si al quitar la tilde sigue sin estar en GSM (emoji, etc.), se deja tal cual.
      out += [...base].every((c) => GSM.has(c)) ? base : ch;
    }
  }
  return out;
}

export const isGsm = (text: string) => [...text].every((c) => GSM.has(c));
