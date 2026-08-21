/**
 * ApiAdapter — Placeholder for future REST API / DynamoDB migration.
 *
 * This adapter implements the StorageAdapter interface but is NOT functional.
 * It exists as a documented contract for when the application migrates from
 * client-side storage (IndexedDB + localStorage) to a backend API.
 *
 * Future implementation will:
 * - Make HTTP requests to a REST API (API Gateway + Lambda)
 * - Persist data in DynamoDB
 * - Handle auth tokens for authenticated requests
 * - Implement optimistic updates with rollback on failure
 * - Support offline-first with sync queue
 */

import type { StorageAdapter } from './IndexedDBAdapter';

export class ApiAdapter implements StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_baseUrl?: string, _getAuthToken?: () => Promise<string>) {
    // Placeholder: will receive API base URL and auth token getter
  }

  async init(): Promise<void> {
    throw new Error(
      'ApiAdapter is not yet implemented. This is a placeholder for future DynamoDB migration.'
    );
  }

  async get<T>(_key: string): Promise<T | null> {
    throw new Error(
      'ApiAdapter.get() is not yet implemented. This is a placeholder for future DynamoDB migration.'
    );
  }

  async set<T>(_key: string, _value: T): Promise<void> {
    throw new Error(
      'ApiAdapter.set() is not yet implemented. This is a placeholder for future DynamoDB migration.'
    );
  }

  async delete(_key: string): Promise<void> {
    throw new Error(
      'ApiAdapter.delete() is not yet implemented. This is a placeholder for future DynamoDB migration.'
    );
  }

  async keys(): Promise<string[]> {
    throw new Error(
      'ApiAdapter.keys() is not yet implemented. This is a placeholder for future DynamoDB migration.'
    );
  }
}
