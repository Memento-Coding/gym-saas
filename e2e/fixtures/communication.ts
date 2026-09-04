/**
 * fixtures/communication.ts
 * Datos de prueba reutilizables para el módulo de comunicación.
 */

export const DEFAULT_COMMUNICATION_CONFIG = {
  channels: [
    { channelId: 'email',    enabled: true,  notificationTypes: [] },
    { channelId: 'telegram', enabled: false, notificationTypes: [] },
    { channelId: 'whatsapp', enabled: true,  notificationTypes: [] },
  ],
  templates: {},
};

export const TEMPLATE_NAMES = [
  'Aviso de vencimiento próximo',
  'Membresía vencida',
  'Invitación a volver',
  'Cuota pendiente de cartera',
  'Feliz cumpleaños',
] as const;
