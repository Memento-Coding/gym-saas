/**
 * TelegramChannel — Fase 2 del sistema de comunicación multicanal.
 *
 * Envía mensajes a estudiantes mediante un bot de Telegram integrado.
 * Requiere que el estudiante tenga su cuenta de Telegram vinculada (telegramChatId).
 *
 * Requirements: 12.11, 12.12, 12.13
 */

import type { Student } from '@/types/student';
import type { CommunicationChannel, SendResult } from './ChannelInterface';

/** Configuración del bot de Telegram */
export interface TelegramBotConfig {
  botToken: string;
}

export class TelegramChannel implements CommunicationChannel {
  readonly id = 'telegram';
  readonly name = 'Telegram';
  readonly phase = 2;

  private botConfig: TelegramBotConfig | null = null;

  /**
   * Configura el token del bot de Telegram.
   */
  configure(config: TelegramBotConfig): void {
    this.botConfig = config;
  }

  /**
   * El canal de Telegram está disponible si se ha configurado el bot token.
   */
  isAvailable(): boolean {
    return !!this.botConfig && !!this.botConfig.botToken;
  }

  /**
   * Determina si se puede enviar mensaje al estudiante por Telegram.
   * Requirement 12.13: Si no tiene cuenta vinculada, se omite.
   */
  canSendTo(student: Student): boolean {
    return !!student.telegramChatId && student.telegramChatId.trim().length > 0;
  }

  /**
   * Retorna la razón por la que no se puede enviar, o null si se puede.
   * Requirement 12.13: Informar al administrador si no está vinculado.
   */
  getMissingRequirement(student: Student): string | null {
    if (!student.telegramChatId || student.telegramChatId.trim().length === 0) {
      return 'El estudiante no tiene su cuenta de Telegram vinculada.';
    }
    return null;
  }

  /**
   * Envía mensaje al estudiante vía bot de Telegram.
   * Requirement 12.11: Enviar mensajes mediante bot de Telegram integrado.
   * Requirement 12.12: Usa la plantilla con variables resueltas como contenido.
   */
  async send(student: Student, message: string): Promise<SendResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        reason: 'El canal de Telegram no está configurado (falta token del bot).',
      };
    }

    if (!this.canSendTo(student)) {
      return {
        success: false,
        reason: this.getMissingRequirement(student) ?? 'No se puede enviar por Telegram.',
      };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botConfig!.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: student.telegramChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          reason: `Error al enviar por Telegram: ${(errorData as { description?: string }).description ?? response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        reason: `Error de red al enviar por Telegram: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
