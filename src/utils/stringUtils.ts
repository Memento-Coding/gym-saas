/**
 * stringUtils.ts — Utilidades de normalización de texto (GymOps).
 *
 * Funciones puras sin dependencias externas, reutilizables en búsquedas,
 * comparaciones y validaciones que deban ser insensibles a tildes/diacríticos.
 */

/**
 * Normaliza un texto para búsquedas insensibles a tildes y mayúsculas.
 *
 * Pasos:
 *  1. `normalize("NFD")` — descompone los caracteres acentuados en letra base
 *     + diacrítico separado (ej. "á" → "a" + combining acute accent U+0301).
 *  2. `.replace(/[\u0300-\u036f]/g, "")` — elimina todos los diacríticos del
 *     bloque "Combining Diacritical Marks" (tildes, diéresis, cedillas, etc.).
 *  3. `.toLowerCase()` — insensible a mayúsculas.
 *
 * Ejemplos:
 *  normalizeText("Estándar")  → "estandar"
 *  normalizeText("García")    → "garcia"
 *  normalizeText("ÑOÑO")      → "nono"
 *  normalizeText("  Güiro  ") → "  guiro  "  (espacios no se tocan)
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
