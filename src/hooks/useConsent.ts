/**
 * useConsent — Custom hook para gestión del módulo de consentimiento.
 *
 * Envuelve el ConsentService y gestiona estado reactivo para:
 * - Configuración actual del consentimiento (versión, textos)
 * - Lista de estudiantes pendientes de firma
 * - Acciones: actualizar versión, firmar, diferir, generar PDF
 *
 * Requirements: 6.1, 6.4, 6.6
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import { ConsentService } from '@/services/ConsentService';
import { generateConsentPDF } from '@/components/consent/ConsentPDF';
import type { ConsentConfig } from '@/types/consent';
import type { Student } from '@/types/student';

interface UseConsentReturn {
  config: ConsentConfig | null;
  pendingStudents: Student[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updateVersion: (text: string, minorText: string) => Promise<void>;
  signConsent: (
    studentId: string,
    signature: string,
    byGuardian?: boolean,
    mediaAuth?: boolean,
  ) => Promise<Student>;
  deferConsent: (studentId: string) => Promise<void>;
  generatePDF: (student: Student) => Promise<void>;
}

export function useConsent(): UseConsentReturn {
  const [config, setConfig] = useState<ConsentConfig | null>(null);
  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<ConsentService | null>(null);

  // Initialize the service
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const consentService = new ConsentService(storage);
        if (!cancelled) {
          setService(consentService);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Error al inicializar el servicio de consentimiento.');
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Load data whenever the service is ready
  const refreshData = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const [consentConfig, pending] = await Promise.all([
        service.getConsentConfig(),
        service.getAllPendingStudents(),
      ]);
      setConfig(consentConfig);
      setPendingStudents(pending);
    } catch (err) {
      setError('Error al cargar datos de consentimiento.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) {
      refreshData();
    }
  }, [service, refreshData]);

  const updateVersion = useCallback(
    async (text: string, minorText: string) => {
      if (!service) return;
      setError(null);

      try {
        const newConfig = await service.updateConsentVersion(text, minorText);
        setConfig(newConfig);
        const pending = await service.getAllPendingStudents();
        setPendingStudents(pending);
      } catch (err) {
        setError('Error al actualizar la versión del consentimiento.');
        throw err;
      }
    },
    [service],
  );

  const signConsent = useCallback(
    async (
      studentId: string,
      signature: string,
      byGuardian?: boolean,
      mediaAuth?: boolean,
    ): Promise<Student> => {
      if (!service) throw new Error('Servicio no inicializado.');
      setError(null);

      try {
        const updatedStudent = await service.signConsent(studentId, signature, byGuardian, mediaAuth);
        // Refresh pending list
        const pending = await service.getAllPendingStudents();
        setPendingStudents(pending);
        return updatedStudent;
      } catch (err) {
        setError('Error al firmar el consentimiento.');
        throw err;
      }
    },
    [service],
  );

  const deferConsent = useCallback(
    async (studentId: string) => {
      if (!service) return;
      setError(null);

      try {
        await service.deferConsent(studentId);
        const pending = await service.getAllPendingStudents();
        setPendingStudents(pending);
      } catch (err) {
        setError('Error al diferir el consentimiento.');
        throw err;
      }
    },
    [service],
  );

  const generatePDF = useCallback(
    async (student: Student) => {
      if (!config) {
        setError('Configuración de consentimiento no disponible.');
        return;
      }

      try {
        await generateConsentPDF(student, config);
      } catch (err) {
        setError('Error al generar el PDF del consentimiento.');
        throw err;
      }
    },
    [config],
  );

  return {
    config,
    pendingStudents,
    loading,
    error,
    refreshData,
    updateVersion,
    signConsent,
    deferConsent,
    generatePDF,
  };
}
