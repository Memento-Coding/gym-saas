/**
 * useCommunication — Custom hook para gestión del módulo de comunicación multicanal.
 *
 * Envuelve el CommunicationService y gestiona estado reactivo para:
 * - Configuración de canales (activar/desactivar, tipos de notificación)
 * - Plantillas editables con variables dinámicas
 * - Envío en lote con reporte de omitidos
 * - Previsualización de mensajes resueltos
 *
 * Requirements: 12.2, 12.3, 12.4, 12.6, 12.9, 12.10, 12.12, 12.13, 12.15, 12.16
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import { CommunicationService, type BatchSendResult } from '@/services/CommunicationService';
import { studentService } from '@/services/StudentService';
import { isApiMode } from '@/config/env';
import { sendApiEmail } from '@/services/api';
import type {
  ChannelConfig,
  MessageTemplate,
  TemplateId,
} from '@/types/communication';
import type { CommunicationChannel } from '@/services/communication/ChannelInterface';
import type { Student } from '@/types/student';

interface UseCommunicationReturn {
  templates: Record<TemplateId, MessageTemplate> | null;
  channelConfigs: ChannelConfig[];
  channels: CommunicationChannel[];
  students: Student[];
  loading: boolean;
  error: string | null;
  updateTemplate: (templateId: TemplateId, newText: string) => Promise<void>;
  updateChannelConfig: (channelId: string, updates: Partial<ChannelConfig>) => Promise<void>;
  sendBatch: (students: Student[], templateId: TemplateId, channelId?: string) => Promise<BatchSendResult>;
  renderPreview: (template: MessageTemplate, student: Student) => string;
  refreshData: () => Promise<void>;
}

export function useCommunication(): UseCommunicationReturn {
  const [templates, setTemplates] = useState<Record<TemplateId, MessageTemplate> | null>(null);
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>([]);
  const [channels, setChannels] = useState<CommunicationChannel[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<CommunicationService | null>(null);

  // Initialize the service
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const commService = new CommunicationService(storage);
        if (!cancelled) {
          setService(commService);
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de comunicación.');
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
      const [templateData, configData, studentData] = await Promise.all([
        service.getTemplates(),
        service.getChannelConfigs(),
        studentService.getAll(),
      ]);
      setTemplates(templateData);
      setChannelConfigs(configData);
      setChannels(service.getAllChannels());
      setStudents(studentData);
    } catch {
      setError('Error al cargar datos de comunicación.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) {
      refreshData();
    }
  }, [service, refreshData]);

  const updateTemplate = useCallback(
    async (templateId: TemplateId, newText: string) => {
      if (!service) return;
      setError(null);

      try {
        await service.updateTemplate(templateId, newText);
        const updatedTemplates = await service.getTemplates();
        setTemplates(updatedTemplates);
      } catch {
        setError('Error al actualizar la plantilla.');
        throw new Error('Error al actualizar la plantilla.');
      }
    },
    [service],
  );

  const updateChannelConfig = useCallback(
    async (channelId: string, updates: Partial<ChannelConfig>) => {
      if (!service) return;
      setError(null);

      try {
        await service.updateChannelConfig(channelId, updates);
        const updatedConfigs = await service.getChannelConfigs();
        setChannelConfigs(updatedConfigs);
      } catch {
        setError('Error al actualizar la configuración del canal.');
        throw new Error('Error al actualizar la configuración del canal.');
      }
    },
    [service],
  );

  const sendBatch = useCallback(
    async (targetStudents: Student[], templateId: TemplateId, channelId?: string): Promise<BatchSendResult> => {
      if (!service) throw new Error('Servicio no inicializado.');
      setError(null);

      // ─── Modo API: el envío de email se hace vía SES en el backend. ───
      if (isApiMode()) {
        try {
          const template = templates?.[templateId];
          const recipients = targetStudents
            .filter((s) => s.email && s.email.length > 0)
            .map((s) => ({
              name: `${s.firstName} ${s.lastName}`.trim(),
              email: s.email,
            }));

          const apiResult = await sendApiEmail(templateId, recipients, {}, true);

          // Adapta la respuesta de la API (total/sent/failed/errors) al
          // BatchSendResult que espera la UI.
          const sentEmails = new Set(recipients.map((r) => r.email));
          const result: BatchSendResult = {
            sent: targetStudents
              .filter((s) => sentEmails.has(s.email))
              .slice(0, apiResult.sent)
              .map((s) => ({
                studentId: s.id,
                studentName: `${s.firstName} ${s.lastName}`.trim(),
                channelId: 'email',
                result: { success: true },
              })),
            skipped: targetStudents
              .filter((s) => !s.email || s.email.length === 0)
              .map((s) => ({
                studentId: s.id,
                studentName: `${s.firstName} ${s.lastName}`.trim(),
                channelId: 'email',
                reason: 'Sin email',
              })),
          };
          void template;
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al enviar mensajes.';
          setError(message);
          throw new Error(message);
        }
      }

      try {
        const result = await service.sendBatch(targetStudents, templateId, channelId);
        return result;
      } catch {
        setError('Error al enviar mensajes.');
        throw new Error('Error al enviar mensajes.');
      }
    },
    [service],
  );

  const renderPreview = useCallback(
    (template: MessageTemplate, student: Student): string => {
      if (!service) return template.text;
      return service.renderTemplate(template, student);
    },
    [service],
  );

  return {
    templates,
    channelConfigs,
    channels,
    students,
    loading,
    error,
    updateTemplate,
    updateChannelConfig,
    sendBatch,
    renderPreview,
    refreshData,
  };
}
