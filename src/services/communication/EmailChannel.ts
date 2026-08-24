/**
 * EmailChannel — Fase 1 del sistema de comunicación multicanal.
 *
 * Envía notificaciones por correo electrónico usando mailto: como mecanismo
 * de envío (client-side). Requiere que el estudiante tenga email registrado.
 *
 * Requirements: 12.8, 12.9, 12.10
 */

import type { Student } from '@/types/student';
import type { CommunicationChannel, SendResult } from './ChannelInterface';

export class EmailChannel implements CommunicationChannel {
  readonly id = 'email';
  readonly name = 'Email';
  readonly phase = 1;

  /**
   * El canal de email siempre está disponible (usa mailto:).
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Determina si se puede enviar email al estudiante.
   * Requirement 12.10: Si no tiene email, se omite.
   */
  canSendTo(student: Student): boolean {
    return !!student.email && student.email.trim().length > 0;
  }

  /**
   * Retorna la razón por la que no se puede enviar, o null si se puede.
   * Requirement 12.10: Informar al administrador si no hay email.
   */
  getMissingRequirement(student: Student): string | null {
    if (!student.email || student.email.trim().length === 0) {
      return 'El estudiante no tiene email registrado.';
    }
    return null;
  }

  /**
   * Envía email al estudiante usando mailto: como mecanismo client-side.
   * Requirement 12.8: Enviar notificaciones por email.
   * Requirement 12.9: Usa la plantilla con variables resueltas como cuerpo.
   */
  async send(student: Student, message: string): Promise<SendResult> {
    if (!this.canSendTo(student)) {
      return {
        success: false,
        reason: this.getMissingRequirement(student) ?? 'No se puede enviar email.',
      };
    }

    const subject = 'Notificación - Academia';
    const mailtoUrl = `mailto:${encodeURIComponent(student.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

    // Open mailto link (triggers default email client)
    window.open(mailtoUrl, '_blank');

    return { success: true };
  }
}
