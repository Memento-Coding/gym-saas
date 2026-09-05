/**
 * SettingsPage — Página de configuración del sistema.
 *
 * Secciones con tabs:
 * - Marca: logo, wordmark, tagline
 * - Planes: editor de planes de membresía
 * - Formulario: campos dinámicos del formulario de registro
 * - Backup: exportar, importar, reiniciar datos
 * - Comunicación: habilitar/deshabilitar canales
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9
 */

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Palette, BarChart3, FormInput, Database, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { BrandingForm } from '@/components/settings/BrandingForm';
import { PlanEditor } from '@/components/settings/PlanEditor';
import { FormFieldConfigEditor } from '@/components/settings/FormFieldConfig';
import { BackupManager } from '@/components/settings/BackupManager';
import { getStorageService } from '@/services/storage';
import type { CommunicationConfig, ChannelConfig } from '@/types/communication';

const COMMUNICATION_CONFIG_KEY = 'communication_config';

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

export function SettingsPage() {
  const {
    branding,
    costs,
    formFields,
    loading,
    error,
    saveBranding,
    saveCosts,
    saveFormFields,
    exportBackup,
    importBackup,
    resetData,
  } = useSettings();

  // Communication channel state (simple panel)
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

  const loadChannels = useCallback(async () => {
    try {
      const storage = await getStorageService();
      const config = await storage.get<CommunicationConfig>(COMMUNICATION_CONFIG_KEY);
      if (config?.channels) {
        setChannels(config.channels);
      }
    } catch {
      // Silently fail — channels may not be configured yet
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleToggleChannel = async (channelId: string, enabled: boolean) => {
    const updated = channels.map((ch) =>
      ch.channelId === channelId ? { ...ch, enabled } : ch,
    );
    setChannels(updated);

    try {
      const storage = await getStorageService();
      const config = await storage.get<CommunicationConfig>(COMMUNICATION_CONFIG_KEY);
      if (config) {
        await storage.set(COMMUNICATION_CONFIG_KEY, { ...config, channels: updated });
      } else {
        await storage.set(COMMUNICATION_CONFIG_KEY, { channels: updated, templates: {} });
      }
      toast.success(`Canal ${CHANNEL_LABELS[channelId] ?? channelId} ${enabled ? 'activado' : 'desactivado'}.`);
    } catch {
      toast.error('Error al actualizar la configuración del canal.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground">
          Configuración general del sistema, marca y datos.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">
            <Palette className="size-4 mr-1.5" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="plans">
            <BarChart3 className="size-4 mr-1.5" />
            Planes
          </TabsTrigger>
          <TabsTrigger value="form">
            <FormInput className="size-4 mr-1.5" />
            Formulario
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="size-4 mr-1.5" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="communication">
            <MessageSquare className="size-4 mr-1.5" />
            Comunicación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingForm branding={branding} onSave={saveBranding} />
        </TabsContent>

        <TabsContent value="plans">
          <PlanEditor costs={costs} onSave={saveCosts} />
        </TabsContent>

        <TabsContent value="form">
          <FormFieldConfigEditor fields={formFields} onSave={saveFormFields} />
        </TabsContent>

        <TabsContent value="backup">
          <BackupManager
            onExport={exportBackup}
            onImport={importBackup}
            onReset={resetData}
          />
        </TabsContent>

        <TabsContent value="communication">
          <Card>
            <CardHeader>
              <CardTitle>Canales de Comunicación</CardTitle>
              <CardDescription>
                Activa o desactiva los canales de notificación disponibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {channelsLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Cargando canales...</span>
                </div>
              ) : channels.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No hay canales configurados. Los canales se crearán automáticamente desde
                  el módulo de comunicación.
                </p>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.channelId}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {CHANNEL_LABELS[channel.channelId] ?? channel.channelId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {channel.notificationTypes.length} tipos de notificación
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                        {channel.enabled ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Checkbox
                        checked={channel.enabled}
                        onCheckedChange={(checked) =>
                          handleToggleChannel(channel.channelId, checked === true)
                        }
                        aria-label={`Toggle ${CHANNEL_LABELS[channel.channelId] ?? channel.channelId}`}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
