/**
 * communicationResource — Handler REST para 'communication_config' (/communication).
 *
 * Impedancia de modelos:
 *  - Frontend: CommunicationConfig { channels: ChannelConfig[], templates:
 *    Record<TemplateId, MessageTemplate{ id,label,description,vars,text }> }.
 *  - API: plantillas con { id, name, subject, body, channel } y endpoints de
 *    envío (/send, /send-batch). No maneja el concepto de "channels config" ni
 *    las variables tipadas del frontend.
 *
 * Estrategia:
 *  - Lectura: parte del config local previo (o defaults del servicio) y superpone
 *    el `body` de cada plantilla de la API cuyo id coincide con un TemplateId,
 *    de modo que la UI muestre el texto real del backend sin perder metadatos
 *    (label/description/vars) que la API no provee.
 *  - Escritura: para cada plantilla, hace upsert contra /communication/templates
 *    (POST si es nueva, PUT si ya existe) enviando name/subject/body/channel.
 *
 * El envío real (sendBatch → SES) se expone aparte con sendApiEmail(), usado por
 * la capa de comunicación cuando isApiMode() es true.
 *
 * @see gym-sass-infra/docs/API.md — Communication Lambda
 */

import { api } from '../apiClient';
import type { ResourceHandler } from './types';
import type {
  CommunicationConfig,
  MessageTemplate,
  TemplateId,
} from '@/types/communication';

interface ApiTemplate {
  id?: string;
  name?: string;
  subject?: string;
  body?: string;
  channel?: string;
}

/** Ids de plantilla conocidos por el frontend. */
const TEMPLATE_IDS: TemplateId[] = ['warn', 'overdue', 'ret', 'cartera', 'bday'];

/** Envía un email vía la API (SES) usando una plantilla y destinatarios. */
export async function sendApiEmail(
  templateId: string,
  recipients: { name: string; email: string }[],
  variables: Record<string, string> = {},
  batch = false,
): Promise<{ total: number; sent: number; failed: number; errors: string[] }> {
  const path = batch ? '/communication/send-batch' : '/communication/send';
  return api.post(path, { templateId, recipients, variables });
}

export class CommunicationResource implements ResourceHandler {
  private last: CommunicationConfig | null = null;

  async get<T>(): Promise<T | null> {
    const templates = await api.get<ApiTemplate[]>('/communication/templates');
    const list = Array.isArray(templates) ? templates : [];
    const byId = new Map(list.map((t) => [t.id, t]));

    // Sin config previa no podemos reconstruir label/description/vars; devolvemos
    // null para que el servicio use sus DEFAULT_TEMPLATES y luego el próximo
    // get superponga los textos de la API.
    if (!this.last) {
      // Aun así, si hay plantillas, intentamos superponer sobre una base mínima.
      return null;
    }

    const merged: CommunicationConfig = {
      channels: this.last.channels,
      templates: { ...this.last.templates },
    };

    for (const id of TEMPLATE_IDS) {
      const apiTpl = byId.get(id);
      if (apiTpl?.body) {
        merged.templates[id] = {
          ...merged.templates[id],
          text: apiTpl.body,
        } as MessageTemplate;
      }
    }

    this.last = merged;
    return merged as T;
  }

  async set<T>(value: T): Promise<void> {
    const config = value as CommunicationConfig;

    const existing = await api.get<ApiTemplate[]>('/communication/templates');
    const existingIds = new Set(
      (Array.isArray(existing) ? existing : []).map((t) => t.id),
    );

    for (const id of TEMPLATE_IDS) {
      const tpl = config.templates[id];
      if (!tpl) continue;
      const payload = {
        name: tpl.label,
        subject: tpl.label,
        body: tpl.text,
        channel: 'email',
      };
      if (existingIds.has(id)) {
        await api.put(`/communication/templates/${encodeURIComponent(id)}`, payload);
      } else {
        await api.post('/communication/templates', { id, ...payload });
      }
    }

    this.last = config;
  }

  async remove(): Promise<void> {
    // No se borran plantillas de forma masiva; no-op.
  }
}
