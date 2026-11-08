/** Fecha de los documentos legales vigentes; también identifica la versión aceptada. */
export const LEGAL_UPDATED = '8 de noviembre de 2026';

/** Valor de `custom:terms_accepted` en Cognito. */
export function termsAcceptanceValue(): string {
  return `${LEGAL_UPDATED}|${new Date().toISOString()}`;
}
