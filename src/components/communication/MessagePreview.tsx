/**
 * MessagePreview — Previsualización del mensaje resuelto con variables.
 *
 * Muestra el texto final con las variables reemplazadas por datos reales del estudiante.
 * Adapta la previsualización según el canal seleccionado:
 * - WhatsApp: muestra enlace wa.me
 * - Email: muestra formato de correo
 * - Telegram: muestra formato de mensaje
 *
 * Requirements: 12.7, 12.14, 12.15
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Mail, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import type { Student } from '@/types/student';

interface MessagePreviewProps {
  message: string;
  channelId?: string;
  student?: Student;
}

function getChannelIcon(channelId: string) {
  switch (channelId) {
    case 'email':
      return <Mail className="size-4" />;
    case 'telegram':
      return <MessageCircle className="size-4" />;
    case 'whatsapp':
      return <Phone className="size-4" />;
    default:
      return null;
  }
}

function getChannelLabel(channelId: string) {
  switch (channelId) {
    case 'email':
      return 'Email';
    case 'telegram':
      return 'Telegram';
    case 'whatsapp':
      return 'WhatsApp';
    default:
      return channelId;
  }
}

export function MessagePreview({ message, channelId, student }: MessagePreviewProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Mensaje copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  const generateWhatsAppUrl = (): string | null => {
    if (!student?.phone) return null;
    const cleanPhone = student.phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const whatsappUrl = channelId === 'whatsapp' ? generateWhatsAppUrl() : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Previsualización del mensaje</CardTitle>
          <div className="flex items-center gap-2">
            {channelId && (
              <Badge variant="outline" className="gap-1">
                {getChannelIcon(channelId)}
                {getChannelLabel(channelId)}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              aria-label="Copiar mensaje al portapapeles"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Destinatario */}
        {student && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Para:</span>
            <span>
              {student.firstName} {student.lastName}
              {channelId === 'email' && student.email && ` (${student.email})`}
              {channelId === 'whatsapp' && student.phone && ` (${student.phone})`}
              {channelId === 'telegram' && student.telegramChatId && ` (Telegram vinculado)`}
            </span>
          </div>
        )}

        {/* Contenido del mensaje */}
        <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {message}
        </div>

        {/* Acción específica del canal */}
        {channelId === 'whatsapp' && whatsappUrl && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir enlace de WhatsApp"
              >
                <ExternalLink className="size-4 mr-1" />
                Abrir en WhatsApp
              </a>
            </Button>
            <span className="text-xs text-muted-foreground truncate max-w-xs">
              {whatsappUrl}
            </span>
          </div>
        )}

        {channelId === 'email' && student?.email && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href={`mailto:${encodeURIComponent(student.email)}?subject=${encodeURIComponent('Notificación - Academia')}&body=${encodeURIComponent(message)}`}
                aria-label="Abrir cliente de correo"
              >
                <Mail className="size-4 mr-1" />
                Abrir correo
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
