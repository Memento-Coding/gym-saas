/**
 * Tipos para el módulo de estudiantes.
 * Define la estructura principal de un estudiante y sus relaciones.
 */

import type { Payment } from './payment';
import type { CourtesyBonus } from './courtesy';
import type { ConsentRecord, ConsentHistoryEntry } from './consent';

export type { ConsentRecord, ConsentHistoryEntry };

/** Tipos de documento de identidad usados en Colombia. */
export type DocumentTypeCode = 'CC' | 'TI' | 'RC' | 'CE' | 'PA' | 'PPT' | 'PEP';

export interface Student {
  id: string;
  photo: string;
  firstName: string;
  lastName: string;
  documentId: string;
  documentType?: DocumentTypeCode;
  isMinor: boolean;
  guardianName: string;
  guardianDocument: string;
  guardianDocumentType?: DocumentTypeCode;
  phone: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  dateOfBirth: string;
  bloodType: string;
  firstRegistrationDate: string;
  recentRegistrationDate: string;
  registrationDate: string;
  subscriptionEndDate: string;
  monthlyFee: number;
  planCategory: 'mensualidad' | 'personalizada';
  planName: string;
  planId: string;
  payments: Payment[];
  courtesyBonuses: CourtesyBonus[];
  medicalNotes: string;
  status: 'active' | 'frozen' | 'inactive';
  beltRank: string;
  freezeReason?: string;
  freezeDate?: string;
  freezeEndDate?: string;
  consent: ConsentRecord;
  telegramChatId?: string;
  customFields?: Record<string, unknown>;
}
