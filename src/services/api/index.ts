/**
 * Barrel del módulo de integración con la API REST de GymOps.
 */

export { api, apiRequest, ApiError, setApiTokenProvider } from './apiClient';
export type { HttpMethod, RequestOptions, TokenProvider } from './apiClient';
export { initApiAuthBridge } from './authToken';
export { ApiStorageAdapter } from './ApiStorageAdapter';

// Operaciones REST directas para flujos que no encajan en el patrón clave→colección.
export { createApiPayment } from './resources/paymentsResource';
export { createApiSale, payApiInstallment } from './resources/salesResource';
export { sendApiEmail } from './resources/communicationResource';
export {
  listApiCourtesies,
  listApiCourtesiesByStudent,
  createApiCourtesy,
  deleteApiCourtesy,
} from './resources/courtesiesApi';
