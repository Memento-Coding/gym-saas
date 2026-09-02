/**
 * fixtures/students.ts
 * Datos de prueba reutilizables para estudiantes.
 */

export const TEST_STUDENT = {
  id: 'stu-e2e-001',
  photo: '',
  firstName: 'Ana',
  lastName: 'García',
  documentId: '1234567890',
  isMinor: false,
  guardianName: '',
  guardianDocument: '',
  phone: '3001234567',
  email: 'ana.garcia@test.com',
  emergencyName: 'Carlos García',
  emergencyPhone: '3009876543',
  emergencyRelation: 'Padre',
  dateOfBirth: '1995-06-15',
  bloodType: 'O+',
  firstRegistrationDate: '2024-01-01',
  recentRegistrationDate: '2024-01-01',
  registrationDate: '2024-01-01',
  subscriptionEndDate: '2025-12-31',
  monthlyFee: 95000,
  planCategory: 'mensualidad',
  planName: 'Estándar',
  planId: 'standard',
  payments: [],
  courtesyBonuses: [],
  medicalNotes: '',
  status: 'active',
  beltRank: 'Blanco',
  telegramChatId: '',
  consent: {
    signed: false,
    signedDate: '',
    signedVersion: 0,
    signature: '',
    mediaAuth: false,
    byGuardian: false,
  },
  customFields: {},
};

export const TEST_MINOR_STUDENT = {
  ...TEST_STUDENT,
  id: 'stu-e2e-002',
  firstName: 'Luis',
  lastName: 'Pérez',
  documentId: '9876543210',
  isMinor: true,
  guardianName: 'María Pérez',
  guardianDocument: '111222333',
  dateOfBirth: '2012-03-20',
};
