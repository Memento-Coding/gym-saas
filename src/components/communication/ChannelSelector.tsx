/**
 * ChannelSelector — Configuración de canales de comunicación.
 *
 * Permite al administrador:
 * - Ver todos los canales registrados con su estado de disponibilidad
 * - Activar o desactivar cada canal individualmente
 * - Configurar qué tipos de notificación maneja cada canal (checkboxes)
 *
 * Requirements: 12.2, 12.3
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, Phone, Power, PowerOff } from 'lucide-react';
import type { CommunicationChannel } from '@/services/communication/ChannelInterface';
import type { ChannelConfig, TemplateId } from '@/types/communication';

interface ChannelSelectorProps {
  channels: CommunicationChannel[];
  configs: ChannelConfig[];
  onUpdate: (channelId: string, updates: Partial<ChannelConfig>) => Promise<void>;
}

/** Map de templateId → etiqueta legible */
const NOTIFICATION_TYPE_LABELS: Record<TemplateId, string> = {
  warn: 'Aviso de vencimiento',
  overdue: 'Membresía vencida',
  ret: 'Invitación a volver',
  cartera: 'Cuota pendiente',
  bday: 'Feliz cumpleaños',
};

const ALL_NOTIFICATION_TYPES: TemplateId[] = ['warn', 'overdue', 'ret', 'cartera', 'bday'];

/** Iconos para cada canal */
function getChannelIcon(channelId: string) {
  switch (channelId) {
    case 'email':
      return <Mail className="size-5" />;
    case 'telegram':
      return <MessageCircle className="size-5" />;
    case 'whatsapp':
      return <Phone className="size-5" />;
    default:
      return <Mail className="size-5" />;
  }
}

export function ChannelSelector({ channels, configs, onUpdate }: ChannelSelectorProps) {
  const [updatingChannel, setUpdatingChannel] = useState<string | null>(null);

  const getConfigForChannel = (channelId: string): ChannelConfig => {
    return (
      configs.find((c) => c.channelId === channelId) ?? {
        channelId,
        enabled: false,
        notificationTypes: [],
      }
    );
  };

  const handleToggleEnabled = async (channelId: string, currentEnabled: boolean) => {
    setUpdatingChannel(channelId);
    try {
      await onUpdate(channelId, { enabled: !currentEnabled });
    } finally {
      setUpdatingChannel(null);
    }
  };

  const handleToggleNotificationType = async (
    channelId: string,
    typeId: TemplateId,
    currentTypes: TemplateId[],
  ) => {
    setUpdatingChannel(channelId);
    const newTypes = currentTypes.includes(typeId)
      ? currentTypes.filter((t) => t !== typeId)
      : [...currentTypes, typeId];
    try {
      await onUpdate(channelId, { notificationTypes: newTypes });
    } finally {
      setUpdatingChannel(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {channels.map((channel) => {
        const config = getConfigForChannel(channel.id);
        const isAvailable = channel.isAvailable();
        const isUpdating = updatingChannel === channel.id;

        return (
          <Card key={channel.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    {getChannelIcon(channel.id)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{channel.name}</CardTitle>
                    <CardDescription>
                      Fase {channel.phase}
                      {!isAvailable && ' — No configurado'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isAvailable ? 'default' : 'secondary'}>
                    {isAvailable ? 'Disponible' : 'No disponible'}
                  </Badge>
                  <Button
                    variant={config.enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleEnabled(channel.id, config.enabled)}
                    disabled={isUpdating || !isAvailable}
                    aria-label={`${config.enabled ? 'Desactivar' : 'Activar'} canal ${channel.name}`}
                  >
                    {config.enabled ? (
                      <Power className="size-4 mr-1" />
                    ) : (
                      <PowerOff className="size-4 mr-1" />
                    )}
                    {config.enabled ? 'Activo' : 'Inactivo'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {config.enabled && (
              <CardContent>
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Tipos de notificación habilitados:
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ALL_NOTIFICATION_TYPES.map((typeId) => {
                      const isChecked = config.notificationTypes.includes(typeId);
                      return (
                        <label
                          key={typeId}
                          className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              handleToggleNotificationType(
                                channel.id,
                                typeId,
                                config.notificationTypes,
                              )
                            }
                            disabled={isUpdating}
                            aria-label={`${NOTIFICATION_TYPE_LABELS[typeId]} para ${channel.name}`}
                          />
                          <span className="text-sm">{NOTIFICATION_TYPE_LABELS[typeId]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
