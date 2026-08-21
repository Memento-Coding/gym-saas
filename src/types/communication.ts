/**
 * Tipos para el módulo de comunicación multicanal.
 * Define plantillas, variables, canales y configuración de mensajes.
 */

export interface TemplateVariable {
  key: string;
  desc: string;
}

export type TemplateId = 'warn' | 'overdue' | 'ret' | 'cartera' | 'bday';

export interface MessageTemplate {
  id: string;
  label: string;
  description: string;
  vars: TemplateVariable[];
  text: string;
}

export interface ChannelConfig {
  channelId: string;
  enabled: boolean;
  notificationTypes: TemplateId[];
}

export interface CommunicationConfig {
  channels: ChannelConfig[];
  templates: Record<TemplateId, MessageTemplate>;
}
