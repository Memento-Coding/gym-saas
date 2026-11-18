/**
 * Contacto de emergencia: la API lo guarda como un único texto libre
 * (`emergencyContact`), mientras que el formulario lo edita como nombre y
 * teléfono. Estas funciones convierten en ambos sentidos sin perder datos.
 *
 * Formato de la API (sin cambios): `Nombre - Teléfono`; si falta una de las
 * partes, solo aparece la otra.
 */

const SEPARATOR = ' - ';

export interface EmergencyContact {
  name: string;
  phone: string;
}

/** ¿Parece un teléfono? Solo dígitos y signos habituales, con al menos 6 dígitos. */
function looksLikePhone(text: string): boolean {
  return /^\+?[\d\s().-]+$/.test(text) && (text.match(/\d/g)?.length ?? 0) >= 6;
}

/** Texto que se envía a la API. */
export function serializeEmergencyContact(name?: string, phone?: string): string {
  return [name, phone]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(SEPARATOR);
}

/**
 * Interpreta el texto de la API. Un texto con separador cuyo último tramo parece
 * un teléfono se parte en nombre y teléfono; uno sin separador es teléfono si lo
 * parece y nombre si no. Cualquier otra cosa se conserva entera como nombre, de
 * modo que `serializeEmergencyContact(parse(t))` devuelve siempre el texto original.
 */
export function parseEmergencyContact(text?: string | null): EmergencyContact {
  const value = (text ?? '').trim();
  if (value === '') return { name: '', phone: '' };

  const cut = value.lastIndexOf(SEPARATOR);
  if (cut >= 0) {
    const tail = value.slice(cut + SEPARATOR.length).trim();
    const head = value.slice(0, cut).trim();
    if (head !== '' && looksLikePhone(tail)) return { name: head, phone: tail };
    return { name: value, phone: '' };
  }

  return looksLikePhone(value) ? { name: '', phone: value } : { name: value, phone: '' };
}
