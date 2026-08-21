/**
 * Tipos para el módulo de consentimiento informado.
 * Define la configuración del consentimiento y los registros de firma.
 */

export interface ConsentConfig {
  version: number;
  updatedDate: string;
  text: string;
  minorText: string;
}

export interface ConsentRecord {
  signed: boolean;
  signedDate: string;
  signedVersion: number;
  signature: string;
  mediaAuth?: boolean;
  byGuardian?: boolean;
  history?: ConsentHistoryEntry[];
}

export interface ConsentHistoryEntry {
  signedDate: string;
  signedVersion: number;
  signature: string;
}
