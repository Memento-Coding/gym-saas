/**
 * useSettings — Custom hook para el módulo de configuración.
 *
 * Envuelve StorageService y BackupService para gestionar:
 * - Branding (logo, wordmark, tagline)
 * - Planes de membresía (CostsConfig)
 * - Campos de formulario dinámico (FormFieldConfig[])
 * - Exportar/importar backup
 * - Reinicio de datos (preserva configuración)
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import { BackupService } from '@/services/BackupService';
import type { StorageService } from '@/services/storage/StorageService';
import type { BrandingConfig, FormFieldConfig } from '@/types/settings';
import type { CostsConfig } from '@/types/membership';

/** Storage keys */
const BRANDING_KEY = 'branding';
const COSTS_KEY = 'costs';
const FORM_FIELDS_KEY = 'formFields';

/** Keys to preserve during reset */
const PRESERVE_KEYS = ['costs', 'consent', 'meta', 'branding', 'formFields', 'communication_config'];

interface UseSettingsReturn {
  branding: BrandingConfig | null;
  costs: CostsConfig | null;
  formFields: FormFieldConfig[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  saveBranding: (config: BrandingConfig) => Promise<void>;
  saveCosts: (config: CostsConfig) => Promise<void>;
  saveFormFields: (fields: FormFieldConfig[]) => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<{ success: boolean; errors?: string[] }>;
  resetData: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [costs, setCosts] = useState<CostsConfig | null>(null);
  const [formFields, setFormFields] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageService | null>(null);
  const [backupService, setBackupService] = useState<BackupService | null>(null);

  // Initialize services
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storageService = await getStorageService();
        const backup = new BackupService(storageService);
        if (!cancelled) {
          setStorage(storageService);
          setBackupService(backup);
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de configuración.');
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Load data when storage is ready
  const refreshData = useCallback(async () => {
    if (!storage) return;

    setLoading(true);
    setError(null);

    try {
      const [brandingData, costsData, fieldsData] = await Promise.all([
        storage.get<BrandingConfig>(BRANDING_KEY),
        storage.get<CostsConfig>(COSTS_KEY),
        storage.get<FormFieldConfig[]>(FORM_FIELDS_KEY),
      ]);

      setBranding(brandingData);
      setCosts(costsData);
      setFormFields(fieldsData ?? []);
    } catch {
      setError('Error al cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    if (storage) {
      refreshData();
    }
  }, [storage, refreshData]);

  const saveBranding = useCallback(
    async (config: BrandingConfig) => {
      if (!storage) return;
      setError(null);
      try {
        await storage.set(BRANDING_KEY, config);
        setBranding(config);
      } catch {
        setError('Error al guardar la configuración de marca.');
        throw new Error('Error al guardar la configuración de marca.');
      }
    },
    [storage],
  );

  const saveCosts = useCallback(
    async (config: CostsConfig) => {
      if (!storage) return;
      setError(null);
      try {
        await storage.set(COSTS_KEY, config);
        setCosts(config);
      } catch {
        setError('Error al guardar los planes.');
        throw new Error('Error al guardar los planes.');
      }
    },
    [storage],
  );

  const saveFormFields = useCallback(
    async (fields: FormFieldConfig[]) => {
      if (!storage) return;
      setError(null);
      try {
        await storage.set(FORM_FIELDS_KEY, fields);
        setFormFields(fields);
      } catch {
        setError('Error al guardar la configuración del formulario.');
        throw new Error('Error al guardar la configuración del formulario.');
      }
    },
    [storage],
  );

  const exportBackup = useCallback(async () => {
    if (!backupService) return;
    setError(null);
    try {
      await backupService.downloadBackup();
    } catch {
      setError('Error al exportar el backup.');
      throw new Error('Error al exportar el backup.');
    }
  }, [backupService]);

  const importBackup = useCallback(
    async (file: File): Promise<{ success: boolean; errors?: string[] }> => {
      if (!backupService) return { success: false, errors: ['Servicio no disponible.'] };
      setError(null);

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await backupService.importAll(data);

        if (result.success) {
          await refreshData();
        }

        return result;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return { success: false, errors: ['El archivo no es un JSON válido.'] };
        }
        setError('Error al importar el backup.');
        return { success: false, errors: ['Error inesperado al importar el backup.'] };
      }
    },
    [backupService, refreshData],
  );

  const resetData = useCallback(async () => {
    if (!storage) return;
    setError(null);
    try {
      await storage.clear(PRESERVE_KEYS);
      await refreshData();
    } catch {
      setError('Error al reiniciar los datos.');
      throw new Error('Error al reiniciar los datos.');
    }
  }, [storage, refreshData]);

  return {
    branding,
    costs,
    formFields,
    loading,
    error,
    refreshData,
    saveBranding,
    saveCosts,
    saveFormFields,
    exportBackup,
    importBackup,
    resetData,
  };
}
