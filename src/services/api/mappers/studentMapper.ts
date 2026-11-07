/**
 * studentMapper — Traducción entre el modelo Student del frontend y el de la API.
 *
 * El frontend usa un Student denormalizado y rico (embebe payments, bonos,
 * consent, plan por nombre+categoría, etc.). La API expone un subconjunto con
 * otros nombres de campo. Este mapper convierte en ambos sentidos, preservando
 * los campos que la API no conoce mediante un merge con el estado local previo.
 *
 * Correspondencias principales (frontend ⇄ API):
 *   subscriptionEndDate ⇄ expirationDate
 *   planName            ⇄ plan
 *   beltRank            ⇄ beltGrade
 *   emergencyContact (API, texto libre) ← se compone de emergencyName/Phone
 *
 * @see gym-sass-infra/docs/API.md — Students Lambda
 * @see gym-sass-infra/docs/DATA-MODEL.md — students
 */

import type { Student } from '@/types/student';

/** Forma (parcial) del Student devuelto por la API. */
export interface ApiStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  documentId?: string;
  phone?: string;
  email?: string;
  status?: string;
  plan?: string;
  planId?: string;
  planCategory?: string;
  monthlyFee?: number;
  expirationDate?: string;
  dateOfBirth?: string;
  bloodType?: string;
  beltGrade?: string;
  isMinor?: boolean;
  guardianName?: string;
  guardianDoc?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  photo?: string;
  registrationDate?: string;
  firstRegistrationDate?: string;
  createdAt?: string;
  freezeReason?: string;
  freezeDate?: string;
  freezeEnd?: string;
  telegramChatId?: string;
  customFields?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Valores por defecto de un Student del frontend (campos no provistos por la API). */
function studentDefaults(): Student {
  return {
    id: '',
    photo: '',
    firstName: '',
    lastName: '',
    documentId: '',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    dateOfBirth: '',
    bloodType: '',
    firstRegistrationDate: '',
    recentRegistrationDate: '',
    registrationDate: '',
    subscriptionEndDate: '',
    monthlyFee: 0,
    planCategory: 'mensualidad',
    planName: '',
    planId: '',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    status: 'active',
    beltRank: '',
    consent: {
      signed: false,
      signedDate: '',
      signedVersion: 0,
      signature: '',
    },
  };
}

/** Normaliza el status de la API al union del frontend. */
function toFrontStatus(status: string | undefined): Student['status'] {
  if (status === 'frozen' || status === 'inactive') return status;
  return 'active';
}

/** Normaliza la categoría de plan. */
function toFrontCategory(category: string | undefined): Student['planCategory'] {
  return category === 'personalizada' ? 'personalizada' : 'mensualidad';
}

/**
 * Convierte un ApiStudent al Student del frontend.
 *
 * @param api  Estudiante tal cual lo devuelve la API.
 * @param prev Estado local previo del mismo estudiante (si existe), para
 *             preservar campos que la API no gestiona (payments, bonos, consent).
 */
export function apiToStudent(api: ApiStudent, prev?: Student): Student {
  const base = prev ? { ...prev } : studentDefaults();

  return {
    ...base,
    id: api.id ?? base.id,
    firstName: api.firstName ?? base.firstName,
    lastName: api.lastName ?? base.lastName,
    documentId: api.documentId ?? base.documentId,
    phone: api.phone ?? base.phone,
    email: api.email ?? base.email,
    isMinor: api.isMinor ?? base.isMinor,
    guardianName: api.guardianName ?? base.guardianName,
    guardianDocument: api.guardianDoc ?? base.guardianDocument,
    dateOfBirth: api.dateOfBirth ?? base.dateOfBirth,
    bloodType: api.bloodType ?? base.bloodType,
    beltRank: api.beltGrade ?? base.beltRank,
    medicalNotes: api.medicalNotes ?? base.medicalNotes,
    photo: api.photo ?? base.photo,
    monthlyFee: api.monthlyFee ?? base.monthlyFee,
    planName: api.plan ?? base.planName,
    planId: api.planId ?? base.planId,
    planCategory: toFrontCategory(api.planCategory) ?? base.planCategory,
    subscriptionEndDate: api.expirationDate ?? base.subscriptionEndDate,
    registrationDate: api.registrationDate ?? api.createdAt ?? base.registrationDate,
    firstRegistrationDate:
      api.firstRegistrationDate ?? api.createdAt ?? base.firstRegistrationDate,
    status: toFrontStatus(api.status),
    freezeReason: api.freezeReason ?? base.freezeReason,
    freezeDate: api.freezeDate ?? base.freezeDate,
    freezeEndDate: api.freezeEnd ?? base.freezeEndDate,
    telegramChatId: api.telegramChatId ?? base.telegramChatId,
    customFields: api.customFields ?? base.customFields,
  };
}

/**
 * Convierte un Student del frontend al payload que espera la API (create/update).
 * Solo se envían los campos que la API conoce.
 */
export function studentToApi(student: Student): Record<string, unknown> {
  const emergencyContact = [student.emergencyName, student.emergencyPhone]
    .filter((v) => v && v.length > 0)
    .join(' - ');

  return {
    firstName: student.firstName,
    lastName: student.lastName,
    documentId: student.documentId,
    phone: student.phone,
    email: student.email,
    dateOfBirth: student.dateOfBirth,
    bloodType: student.bloodType,
    beltGrade: student.beltRank,
    plan: student.planName,
    planId: student.planId,
    planCategory: student.planCategory,
    monthlyFee: student.monthlyFee,
    expirationDate: student.subscriptionEndDate,
    isMinor: student.isMinor,
    guardianName: student.guardianName,
    guardianDoc: student.guardianDocument,
    emergencyContact,
    medicalNotes: student.medicalNotes,
    photo: student.photo,
    telegramChatId: student.telegramChatId,
    customFields: student.customFields,
  };
}
