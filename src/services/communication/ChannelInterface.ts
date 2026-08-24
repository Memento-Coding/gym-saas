/**
 * ChannelInterface — Interfaz abstraída de Canal de Comunicación.
 *
 * Define el contrato que cada canal (Email, Telegram, WhatsApp) debe implementar.
 * Permite agregar nuevos canales de forma incremental sin modificar la lógica de
 * plantillas o selección de destinatarios.
 *
 * Requirements: 12.1
 */

import type { Student } from '@/types/student';

/**
 * Resultado de un envío a través de un canal.
 */
export type SendResult =
  | { success: true }
  | { success: false; reason: string }
  | { success: true; action: 'clipboard' | 'link'; data: string };

/**
 * Interfaz que cada canal de comunicación debe implementar.
 */
export interface CommunicationChannel {
  /** Identificador único del canal (e.g. 'email', 'telegram', 'whatsapp') */
  readonly id: string;

  /** Nombre legible del canal para UI */
  readonly name: string;

  /** Fase de implementación (1=Email, 2=Telegram, 3=WhatsApp) */
  readonly phase: number;

  /** Indica si el canal está disponible/configurado en el sistema */
  isAvailable(): boolean;

  /** Determina si se puede enviar un mensaje a este estudiante por este canal */
  canSendTo(student: Student): boolean;

  /** Retorna la razón por la que no se puede enviar, o null si se puede */
  getMissingRequirement(student: Student): string | null;

  /** Envía un mensaje al estudiante a través de este canal */
  send(student: Student, message: string): Promise<SendResult>;
}
