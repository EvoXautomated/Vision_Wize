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

export const SMS_FOOTER = " Resp. STOP para darse de baja."

/** Cuántos SMS cobra el operador por este texto (con el pie de baja si es marketing). */
export function smsParts(text: string, { plain = true, footer = true } = {}) {
  const raw = footer ? text + SMS_FOOTER : text
  const full = plain ? toGsm(raw) : raw
  const gsm = isGsm(full)
  const len = [...full].length
  const [single, multi] = gsm ? [160, 153] : [70, 67]
  return { len, gsm, parts: len <= single ? 1 : Math.ceil(len / multi) }
}
