/**
 * consentResource — Handler REST para la clave 'consent_config' (/consent).
 *
 * El frontend guarda un ConsentConfig único { version, updatedDate, text,
 * minorText }. La API versiona por audiencia (adult/minor) de forma separada.
 *
 * Lectura: GET /consent?active=true → toma la versión activa de cada audiencia
 *   y compone el ConsentConfig (text = adulto, minorText = menor, version = la
 *   mayor de ambas).
 *
 * Escritura: al cambiar los textos, publica nuevas versiones con
 *   POST /consent/versions (una por audiencia). El backend auto-incrementa el
 *   número y desactiva la versión anterior.
 *
 * Nota: las FIRMAS de consentimiento por estudiante viven embebidas en Student
 * en el frontend; su sincronización (POST /consent/{studentId}/sign) se maneja
 * en el flujo de estudiantes, no aquí.
 *
 * @see gym-sass-infra/docs/API.md — Consent Lambda
 */

import { api } from '../apiClient';
import type { ResourceHandler } from './types';
import type { ConsentConfig } from '@/types/consent';

interface ApiConsentVersion {
  audience?: 'adult' | 'minor';
  version?: number;
  title?: string;
  body?: string;
  active?: boolean;
  createdAt?: string;
}

export class ConsentResource implements ResourceHandler {
  /** Snapshot del último config leído, para detectar cambios en set(). */
  private last: ConsentConfig | null = null;

  async get<T>(): Promise<T | null> {
    const versions = await api.get<ApiConsentVersion[]>('/consent', {
      query: { active: 'true' },
    });
    const list = Array.isArray(versions) ? versions : [];

    const adult = list.find((v) => v.audience === 'adult');
    const minor = list.find((v) => v.audience === 'minor');

    const config: ConsentConfig = {
      version: Math.max(adult?.version ?? 1, minor?.version ?? 1),
      updatedDate:
        adult?.createdAt ?? minor?.createdAt ?? new Date().toISOString(),
      text: adult?.body ?? '',
      minorText: minor?.body ?? '',
    };

    this.last = config;
    return config as T;
  }

  async set<T>(value: T): Promise<void> {
    const next = value as ConsentConfig;
    const prev = this.last;

    // Publica nueva versión de adulto si cambió el texto.
    if (!prev || prev.text !== next.text) {
      await api.post('/consent/versions', {
        audience: 'adult',
        title: 'Consentimiento informado',
        body: next.text,
      });
    }

    // Publica nueva versión de menor si cambió el texto.
    if (!prev || prev.minorText !== next.minorText) {
      await api.post('/consent/versions', {
        audience: 'minor',
        title: 'Consentimiento informado (menor)',
        body: next.minorText,
      });
    }

    this.last = next;
  }

  async remove(): Promise<void> {
    // No se eliminan versiones de consentimiento; no-op.
  }
}
