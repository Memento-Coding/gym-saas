/**
 * CommunicationService — Gestión de comunicación multicanal.
 *
 * Responsabilidades:
 * - Gestionar canales de comunicación (Email, Telegram, WhatsApp)
 * - Mantener plantillas editables con variables dinámicas
 * - Motor de plantillas (TemplateEngine) para resolución de variables
 * - Configurar canales activos por tipo de notificación
 * - Enviar mensajes resolviendo plantillas con datos del estudiante
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.11, 12.14
 */

import type { StorageService } from '@/services/storage/StorageService';
import type {
  CommunicationConfig,
  ChannelConfig,
  MessageTemplate,
  TemplateId,
} from '@/types/communication';
import type { Student } from '@/types/student';
import type { CommunicationChannel, SendResult } from './communication/ChannelInterface';
import { EmailChannel } from './communication/EmailChannel';
import { TelegramChannel } from './communication/TelegramChannel';
import { WhatsAppChannel } from './communication/WhatsAppChannel';

/** Storage key for communication configuration */
const COMMUNICATION_CONFIG_KEY = 'communication_config';

/**
 * Resultado del envío en lote a múltiples estudiantes.
 */
export interface BatchSendResult {
  sent: Array<{ studentId: string; studentName: string; channelId: string; result: SendResult }>;
  skipped: Array<{ studentId: string; studentName: string; channelId: string; reason: string }>;
}

/**
 * Variables disponibles para el motor de plantillas.
 */
export interface TemplateVariables {
  nombre: string;
  fecha_vencimiento: string;
  monto: string;
  edad: string;
}

/** Default templates para cada tipo de notificación */
const DEFAULT_TEMPLATES: Record<TemplateId, MessageTemplate> = {
  warn: {
    id: 'warn',
    label: 'Aviso de vencimiento próximo',
    description: 'Se envía cuando la membresía está por vencer',
    vars: [
      { key: 'nombre', desc: 'Nombre completo del estudiante' },
      { key: 'fecha_vencimiento', desc: 'Fecha de vencimiento de la membresía' },
    ],
    text: 'Hola {{nombre}}, te recordamos que tu membresía vence el {{fecha_vencimiento}}. ¡Renueva a tiempo para no perder tu continuidad!',
  },
  overdue: {
    id: 'overdue',
    label: 'Membresía vencida',
    description: 'Se envía cuando la membresía ya expiró',
    vars: [
      { key: 'nombre', desc: 'Nombre completo del estudiante' },
      { key: 'fecha_vencimiento', desc: 'Fecha en que venció la membresía' },
      { key: 'monto', desc: 'Monto de la mensualidad' },
    ],
    text: 'Hola {{nombre}}, tu membresía venció el {{fecha_vencimiento}}. El valor de renovación es ${{monto}}. ¡Te esperamos de vuelta!',
  },
  ret: {
    id: 'ret',
    label: 'Invitación a volver',
    description: 'Se envía a estudiantes inactivos para invitarlos a regresar',
    vars: [
      { key: 'nombre', desc: 'Nombre completo del estudiante' },
    ],
    text: 'Hola {{nombre}}, te extrañamos en la academia. ¡Vuelve a entrenar con nosotros! Contáctanos para conocer las opciones disponibles.',
  },
  cartera: {
    id: 'cartera',
    label: 'Cuota pendiente de cartera',
    description: 'Se envía cuando hay una cuota de crédito pendiente',
    vars: [
      { key: 'nombre', desc: 'Nombre completo del estudiante' },
      { key: 'monto', desc: 'Monto de la cuota pendiente' },
      { key: 'fecha_vencimiento', desc: 'Fecha límite de pago de la cuota' },
    ],
    text: 'Hola {{nombre}}, tienes una cuota pendiente por ${{monto}} con vencimiento el {{fecha_vencimiento}}. Por favor realiza el pago a tiempo.',
  },
  bday: {
    id: 'bday',
    label: 'Feliz cumpleaños',
    description: 'Se envía en el cumpleaños del estudiante',
    vars: [
      { key: 'nombre', desc: 'Nombre completo del estudiante' },
      { key: 'edad', desc: 'Edad del estudiante' },
    ],
    text: '¡Feliz cumpleaños {{nombre}}! 🎉 Esperamos que disfrutes tus {{edad}} años. ¡Nos vemos en el tatami!',
  },
};

/** Default channel configuration */
const DEFAULT_CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    channelId: 'email',
    enabled: true,
    notificationTypes: ['warn', 'overdue', 'ret', 'cartera', 'bday'],
  },
  {
    channelId: 'telegram',
    enabled: false,
    notificationTypes: ['warn', 'overdue', 'ret', 'cartera', 'bday'],
  },
  {
    channelId: 'whatsapp',
    enabled: true,
    notificationTypes: ['warn', 'overdue', 'ret', 'cartera', 'bday'],
  },
];

/**
 * Motor de plantillas — reemplaza variables dinámicas en plantillas de texto.
 *
 * Requirement 12.5: Soporta variables dinámicas: nombre, fecha_vencimiento, monto, edad.
 * Requirement 12.7: Genera texto final reemplazando variables con datos reales.
 */
export class TemplateEngine {
  /** Patrón para detectar variables: {{variable}} */
  private static readonly VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

  /**
   * Renderiza una plantilla reemplazando todas las variables con sus valores.
   */
  render(template: string, variables: Record<string, string>): string {
    return template.replace(TemplateEngine.VARIABLE_PATTERN, (match, key: string) => {
      return key in variables ? variables[key] : match;
    });
  }

  /**
   * Extrae los nombres de todas las variables de una plantilla.
   */
  getVariables(template: string): string[] {
    const vars: string[] = [];
    let match: RegExpExecArray | null;
    const pattern = new RegExp(TemplateEngine.VARIABLE_PATTERN.source, 'g');

    while ((match = pattern.exec(template)) !== null) {
      if (!vars.includes(match[1])) {
        vars.push(match[1]);
      }
    }
    return vars;
  }

  /**
   * Valida que todas las variables en la plantilla estén disponibles.
   * Retorna las variables no disponibles (si hay alguna).
   */
  validate(template: string, availableVars: string[]): { valid: boolean; missing: string[] } {
    const usedVars = this.getVariables(template);
    const missing = usedVars.filter((v) => !availableVars.includes(v));
    return { valid: missing.length === 0, missing };
  }

  /**
   * Construye el mapa de variables a partir de los datos de un estudiante.
   */
  buildVariablesFromStudent(student: Student): Record<string, string> {
    const age = this.calculateAge(student.dateOfBirth);
    return {
      nombre: `${student.firstName} ${student.lastName}`.trim(),
      fecha_vencimiento: student.subscriptionEndDate || '',
      monto: student.monthlyFee?.toLocaleString('es-CO') ?? '0',
      edad: age.toString(),
    };
  }

  /**
   * Calcula la edad a partir de la fecha de nacimiento.
   */
  private calculateAge(dateOfBirth: string): number {
    if (!dateOfBirth) return 0;
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

export class CommunicationService {
  private storageService: StorageService;
  private channels: Map<string, CommunicationChannel>;
  private templateEngine: TemplateEngine;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
    this.channels = new Map();
    this.templateEngine = new TemplateEngine();

    // Registrar canales por defecto
    this.registerChannel(new EmailChannel());
    this.registerChannel(new TelegramChannel());
    this.registerChannel(new WhatsAppChannel());
  }

  /**
   * Registra un canal de comunicación en el servicio.
   * Requirement 12.1: Permite agregar nuevos canales de forma incremental.
   */
  registerChannel(channel: CommunicationChannel): void {
    this.channels.set(channel.id, channel);
  }

  /**
   * Obtiene un canal registrado por su id.
   */
  getChannel(channelId: string): CommunicationChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Retorna todos los canales registrados.
   * Requirement 12.3: Muestra canales disponibles según fase implementada.
   */
  getAllChannels(): CommunicationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Retorna la instancia del TemplateEngine.
   */
  getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }

  /**
   * Obtiene la configuración completa de comunicación (canales + plantillas).
   * Retorna configuración por defecto si no existe.
   */
  async getConfig(): Promise<CommunicationConfig> {
    const config = await this.storageService.get<CommunicationConfig>(COMMUNICATION_CONFIG_KEY);
    if (config) return config;

    const defaultConfig: CommunicationConfig = {
      channels: DEFAULT_CHANNEL_CONFIGS,
      templates: { ...DEFAULT_TEMPLATES },
    };
    return defaultConfig;
  }

  /**
   * Obtiene la configuración de canales.
   * Requirement 12.2: Configurar canales activos por tipo de notificación.
   */
  async getChannelConfigs(): Promise<ChannelConfig[]> {
    const config = await this.getConfig();
    return config.channels;
  }

  /**
   * Actualiza la configuración de un canal (activar/desactivar, tipos de notificación).
   * Requirement 12.2: Permite configurar cuáles canales están activos por tipo.
   * Requirement 12.3: Permite activar o desactivar cada canal individualmente.
   */
  async updateChannelConfig(channelId: string, updates: Partial<ChannelConfig>): Promise<void> {
    const config = await this.getConfig();
    const channelIndex = config.channels.findIndex((c) => c.channelId === channelId);

    if (channelIndex === -1) {
      // Agregar nueva configuración si no existe
      config.channels.push({
        channelId,
        enabled: updates.enabled ?? false,
        notificationTypes: updates.notificationTypes ?? [],
      });
    } else {
      config.channels[channelIndex] = {
        ...config.channels[channelIndex],
        ...updates,
      };
    }

    await this.storageService.set<CommunicationConfig>(COMMUNICATION_CONFIG_KEY, config);
  }

  /**
   * Obtiene todas las plantillas de mensajes.
   * Requirement 12.4: Incluye plantillas editables para cada tipo.
   */
  async getTemplates(): Promise<Record<TemplateId, MessageTemplate>> {
    const config = await this.getConfig();
    return config.templates;
  }

  /**
   * Obtiene una plantilla específica por su id.
   */
  async getTemplate(templateId: TemplateId): Promise<MessageTemplate> {
    const templates = await this.getTemplates();
    return templates[templateId];
  }

  /**
   * Actualiza el texto de una plantilla.
   * Requirement 12.6: Persiste cambios y usa en comunicaciones posteriores.
   */
  async updateTemplate(templateId: TemplateId, newText: string): Promise<MessageTemplate> {
    const config = await this.getConfig();
    config.templates[templateId] = {
      ...config.templates[templateId],
      text: newText,
    };

    await this.storageService.set<CommunicationConfig>(COMMUNICATION_CONFIG_KEY, config);
    return config.templates[templateId];
  }

  /**
   * Renderiza una plantilla con los datos de un estudiante.
   * Requirement 12.7: Genera texto final reemplazando variables con datos reales.
   */
  renderTemplate(template: MessageTemplate, student: Student): string {
    const variables = this.templateEngine.buildVariablesFromStudent(student);
    return this.templateEngine.render(template.text, variables);
  }

  /**
   * Renderiza una plantilla con variables personalizadas.
   */
  renderTemplateWithVars(template: MessageTemplate, variables: Record<string, string>): string {
    return this.templateEngine.render(template.text, variables);
  }

  /**
   * Obtiene los canales activos para un tipo de notificación dado.
   * Requirement 12.2: Configurar canales activos por tipo de notificación.
   */
  async getActiveChannelsForType(templateId: TemplateId): Promise<CommunicationChannel[]> {
    const channelConfigs = await this.getChannelConfigs();

    const activeChannels: CommunicationChannel[] = [];
    for (const config of channelConfigs) {
      if (config.enabled && config.notificationTypes.includes(templateId)) {
        const channel = this.channels.get(config.channelId);
        if (channel && channel.isAvailable()) {
          activeChannels.push(channel);
        }
      }
    }

    return activeChannels;
  }

  /**
   * Envía un mensaje a un estudiante a través de un canal específico.
   * Resuelve la plantilla antes de enviar.
   */
  async sendToStudent(
    student: Student,
    templateId: TemplateId,
    channelId: string,
  ): Promise<SendResult> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, reason: `Canal "${channelId}" no encontrado.` };
    }

    if (!channel.isAvailable()) {
      return { success: false, reason: `Canal "${channel.name}" no está disponible.` };
    }

    if (!channel.canSendTo(student)) {
      return {
        success: false,
        reason: channel.getMissingRequirement(student) ?? 'No se puede enviar al estudiante.',
      };
    }

    const template = await this.getTemplate(templateId);
    const message = this.renderTemplate(template, student);

    return channel.send(student, message);
  }

  /**
   * Envía un mensaje en lote a múltiples estudiantes por los canales activos.
   * Reporta cuáles se enviaron y cuáles se omitieron por falta de contacto.
   *
   * Requirement 12.10: Canal_Email omite y reporta si no hay email.
   * Requirement 12.13: Canal_Telegram omite y reporta si no está vinculado.
   * Requirement 12.16: Canal_WhatsApp deshabilita si no hay teléfono.
   */
  async sendBatch(
    students: Student[],
    templateId: TemplateId,
    channelId?: string,
  ): Promise<BatchSendResult> {
    const result: BatchSendResult = { sent: [], skipped: [] };

    // Determinar canales a usar
    let channelsToUse: CommunicationChannel[];
    if (channelId) {
      const channel = this.channels.get(channelId);
      channelsToUse = channel ? [channel] : [];
    } else {
      channelsToUse = await this.getActiveChannelsForType(templateId);
    }

    if (channelsToUse.length === 0) {
      return result;
    }

    const template = await this.getTemplate(templateId);

    for (const student of students) {
      const studentName = `${student.firstName} ${student.lastName}`.trim();

      for (const channel of channelsToUse) {
        if (!channel.canSendTo(student)) {
          result.skipped.push({
            studentId: student.id,
            studentName,
            channelId: channel.id,
            reason: channel.getMissingRequirement(student) ?? 'No se puede enviar.',
          });
          continue;
        }

        const message = this.renderTemplate(template, student);
        const sendResult = await channel.send(student, message);

        if (sendResult.success) {
          result.sent.push({
            studentId: student.id,
            studentName,
            channelId: channel.id,
            result: sendResult,
          });
        } else {
          result.skipped.push({
            studentId: student.id,
            studentName,
            channelId: channel.id,
            reason: sendResult.reason,
          });
        }
      }
    }

    return result;
  }
}
