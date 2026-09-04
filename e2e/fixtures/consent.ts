/**
 * fixtures/consent.ts
 * Datos de prueba reutilizables para el módulo de consentimiento.
 */

export const DEFAULT_CONSENT_CONFIG = {
  version: 1,
  updatedDate: new Date().toISOString(),
  text: 'Texto de consentimiento para adultos.',
  minorText: 'Texto de consentimiento para menores.',
};

export const signedConsentFor = (version: number) => ({
  signed: true,
  signedDate: new Date().toISOString(),
  signedVersion: version,
  signature: 'data:image/png;base64,abc',
  mediaAuth: false,
  byGuardian: false,
});

export const unsignedConsent = {
  signed: false,
  signedDate: '',
  signedVersion: 0,
  signature: '',
  mediaAuth: false,
  byGuardian: false,
};
