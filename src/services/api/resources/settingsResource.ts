/**
 * settingsResource — Handler REST para las claves de configuración (/settings).
 *
 * La API expone un ÚNICO objeto de settings (GET/PUT /settings) con secciones:
 *   { branding, plans[], formFields[], communicationConfig, consentConfig }.
 *
 * El frontend, en cambio, persiste esas secciones bajo claves separadas:
 *   'branding'            → BrandingConfig
 *   'costs' / 'gymops_costs_config' → CostsConfig { memberships[], personalized[] }
 *   'formFields'          → FormFieldConfig[]
 *
 * Este recurso cachea el objeto /settings completo y mapea cada clave del
 * frontend a su sección. En set(), aplica el cambio sobre la sección
 * correspondiente y hace PUT del objeto completo (la API espera el objeto entero).
 *
 * @see gym-sass-infra/docs/API.md — Settings Lambda
 */

import { api } from '../apiClient';
import type { BrandingConfig, FormFieldConfig } from '@/types/settings';
import type { CostsConfig, MembershipPlan } from '@/types/membership';

interface ApiPlan {
  id: string;
  name: string;
  price: number;
  category?: 'membership' | 'personal';
  single?: boolean;
  classesPerMonth?: number;
}

interface ApiFormField {
  name: string;
  type: string;
  required: boolean;
  label?: string;
  options?: string[];
}

interface ApiSettings {
  branding?: { logo?: string; wordmark?: string; tagline?: string };
  plans?: ApiPlan[];
  formFields?: ApiFormField[];
  communicationConfig?: Record<string, unknown>;
  consentConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

export class SettingsResource {
  private cache: ApiSettings | null = null;

  /** Carga (con cache) el objeto /settings completo. */
  private async load(): Promise<ApiSettings> {
    if (this.cache) return this.cache;
    const settings = await api.get<ApiSettings>('/settings');
    this.cache = settings ?? {};
    return this.cache;
  }

  /** Persiste el objeto /settings completo y refresca la cache. */
  private async save(next: ApiSettings): Promise<void> {
    await api.put('/settings', next);
    this.cache = next;
  }

  // ─── Lectura por clave ───────────────────────────────────────────────────────

  async getKey<T>(key: string): Promise<T | null> {
    const settings = await this.load();

    switch (key) {
      case 'branding':
        return this.readBranding(settings) as T;
      case 'costs':
      case 'gymops_costs_config':
        return this.readCosts(settings) as T;
      case 'formFields':
        return this.readFormFields(settings) as T;
      default:
        return null;
    }
  }

  // ─── Escritura por clave ───────────────────────────────────────────────────────

  async setKey<T>(key: string, value: T): Promise<void> {
    const settings = { ...(await this.load()) };

    switch (key) {
      case 'branding':
        settings.branding = this.writeBranding(value as BrandingConfig);
        break;
      case 'costs':
      case 'gymops_costs_config':
        settings.plans = this.writeCosts(value as CostsConfig);
        break;
      case 'formFields':
        settings.formFields = this.writeFormFields(value as FormFieldConfig[]);
        break;
      default:
        return;
    }

    await this.save(settings);
  }

  async deleteKey(_key: string): Promise<void> {
    // No se borran secciones de settings individualmente; no-op.
    void _key;
  }

  // ─── Mapeo de secciones ────────────────────────────────────────────────────────

  private readBranding(s: ApiSettings): BrandingConfig {
    return {
      logo: s.branding?.logo ?? null,
      wordmark: s.branding?.wordmark ?? null,
      tagline: s.branding?.tagline ?? null,
    };
  }

  private writeBranding(b: BrandingConfig): ApiSettings['branding'] {
    return {
      logo: b.logo ?? '',
      wordmark: b.wordmark ?? '',
      tagline: b.tagline ?? '',
    };
  }

  private readCosts(s: ApiSettings): CostsConfig {
    const plans = s.plans ?? [];
    const toPlan = (p: ApiPlan): MembershipPlan => ({
      id: p.id,
      name: p.name,
      price: p.price,
      single: p.single,
      classesPerMonth: p.classesPerMonth,
    });
    return {
      memberships: plans.filter((p) => p.category !== 'personal').map(toPlan),
      personalized: plans.filter((p) => p.category === 'personal').map(toPlan),
    };
  }

  private writeCosts(costs: CostsConfig): ApiPlan[] {
    const memberships: ApiPlan[] = costs.memberships.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: 'membership',
      single: p.single,
      classesPerMonth: p.classesPerMonth,
    }));
    const personalized: ApiPlan[] = costs.personalized.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: 'personal',
      single: p.single,
      classesPerMonth: p.classesPerMonth,
    }));
    return [...memberships, ...personalized];
  }

  private readFormFields(s: ApiSettings): FormFieldConfig[] {
    return (s.formFields ?? []).map((f, index) => ({
      id: f.name ?? `field_${index}`,
      name: f.name ?? '',
      label: f.label ?? f.name ?? '',
      type: this.toFieldType(f.type),
      required: f.required ?? false,
      options: f.options,
      isBuiltIn: true,
    }));
  }

  private writeFormFields(fields: FormFieldConfig[]): ApiFormField[] {
    return fields.map((f) => ({
      name: f.name,
      type: f.type,
      required: f.required,
      label: f.label,
      options: f.options,
    }));
  }

  private toFieldType(type: string): FormFieldConfig['type'] {
    if (type === 'number' || type === 'date' || type === 'select') return type;
    return 'text';
  }
}
