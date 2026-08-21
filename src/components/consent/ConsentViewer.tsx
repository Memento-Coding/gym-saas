/**
 * ConsentViewer — Visualizador y editor de textos de consentimiento.
 *
 * Muestra el texto de consentimiento (versión adultos o menores) con
 * número de versión y fecha. Permite editar y actualizar la versión.
 *
 * Requirement 6.1: Mantiene dos versiones del texto (adultos y menores).
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Save, X } from 'lucide-react';
import type { ConsentConfig } from '@/types/consent';

interface ConsentViewerProps {
  config: ConsentConfig;
  onUpdateVersion: (text: string, minorText: string) => Promise<void>;
}

export function ConsentViewer({ config, onUpdateVersion }: ConsentViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [adultText, setAdultText] = useState(config.text);
  const [minorText, setMinorText] = useState(config.minorText);
  const [saving, setSaving] = useState(false);

  const formattedDate = config.updatedDate
    ? format(new Date(config.updatedDate), "d 'de' MMMM 'de' yyyy", { locale: es })
    : 'Sin fecha';

  const handleEdit = () => {
    setAdultText(config.text);
    setMinorText(config.minorText);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setAdultText(config.text);
    setMinorText(config.minorText);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!adultText.trim() || !minorText.trim()) return;

    setSaving(true);
    try {
      await onUpdateVersion(adultText, minorText);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Texto de Consentimiento</CardTitle>
            <CardDescription>
              Versión {config.version} — Actualizado el {formattedDate}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">v{config.version}</Badge>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="size-4 mr-1" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="adult">
          <TabsList>
            <TabsTrigger value="adult">Adultos</TabsTrigger>
            <TabsTrigger value="minor">Menores</TabsTrigger>
          </TabsList>

          <TabsContent value="adult" className="mt-4">
            {isEditing ? (
              <Textarea
                value={adultText}
                onChange={(e) => setAdultText(e.target.value)}
                placeholder="Texto de consentimiento para adultos..."
                className="min-h-48"
              />
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-4 whitespace-pre-wrap text-sm">
                {config.text || (
                  <span className="text-muted-foreground italic">
                    No hay texto de consentimiento para adultos configurado.
                  </span>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="minor" className="mt-4">
            {isEditing ? (
              <Textarea
                value={minorText}
                onChange={(e) => setMinorText(e.target.value)}
                placeholder="Texto de consentimiento para menores..."
                className="min-h-48"
              />
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-4 whitespace-pre-wrap text-sm">
                {config.minorText || (
                  <span className="text-muted-foreground italic">
                    No hay texto de consentimiento para menores configurado.
                  </span>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {isEditing && (
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="size-4 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !adultText.trim() || !minorText.trim()}
            >
              <Save className="size-4 mr-1" />
              {saving ? 'Guardando...' : 'Guardar nueva versión'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
