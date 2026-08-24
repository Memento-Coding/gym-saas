/**
 * WhatsAppChannel — Fase 3 del sistema de comunicación multicanal.
 *
 * Genera el texto final de la plantilla y ofrece la opción de copiar al portapapeles
 * o abrir un enlace directo de WhatsApp con el mensaje prellenado.
 * Requiere que el estudiante tenga número de teléfono registrado.
 *
 * Requirements: 12.14, 12.15, 12.16
 */

import type { Student } from '@/types/student';
import type { CommunicationChannel, SendResult } from './ChannelInterface';

export class WhatsAppChannel implements CommunicationChannel {
  readonly id = 'whatsapp';
  readonly name = 'WhatsApp';
  readonly phase = 3;

  /**
   * El canal de WhatsApp siempre está disponible (usa enlaces wa.me).
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Determina si se puede enviar mensaje al estudiante por WhatsApp.
   * Requirement 12.16: Si no tiene teléfono, se deshabilita.
   */
  canSendTo(student: Student): boolean {
    return !!student.phone && student.phone.trim().length > 0;
  }

  /**
   * Retorna la razón por la que no se puede enviar, o null si se puede.
   * Requirement 12.16: Deshabilitar opción si no tiene teléfono.
   */
  getMissingRequirement(student: Student): string | null {
    if (!student.phone || student.phone.trim().length === 0) {
      return 'El estudiante no tiene número de teléfono registrado.';
    }
    return null;
  }

  /**
   * Genera el enlace de WhatsApp con el mensaje prellenado.
   * Requirement 12.14: Generar texto final y ofrecer copiar o abrir enlace.
   * Requirement 12.15: Usar el teléfono para generar enlace wa.me/{phone}?text={msg}.
   */
  async send(student: Student, message: string): Promise<SendResult> {
    if (!this.canSendTo(student)) {
      return {
        success: false,
        reason: this.getMissingRequirement(student) ?? 'No se puede enviar por WhatsApp.',
      };
    }

    // Limpiar número de teléfono: solo dígitos
    const cleanPhone = student.phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    return {
      success: true,
      action: 'link',
      data: whatsappUrl,
    };
  }

  /**
   * Genera la URL de WhatsApp sin enviar (útil para previsualizaciones).
   */
  generateUrl(phone: string, message: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  /**
   * Copia el mensaje al portapapeles como alternativa al enlace.
   */
  async copyToClipboard(message: string): Promise<SendResult> {
    try {
      await navigator.clipboard.writeText(message);
      return {
        success: true,
        action: 'clipboard',
        data: message,
      };
    } catch {
      return {
        success: false,
        reason: 'No se pudo copiar al portapapeles.',
      };
    }
  }
}
