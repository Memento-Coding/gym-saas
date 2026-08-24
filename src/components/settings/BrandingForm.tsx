/**
 * BrandingForm — Formulario para configuración de marca visual.
 *
 * Permite editar:
 * - Logo (carga de imagen como base64 data URL)
 * - Wordmark (texto)
 * - Tagline (texto)
 *
 * Requirements: 15.1
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePlus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BrandingConfig } from '@/types/settings';

interface BrandingFormProps {
  branding: BrandingConfig | null;
  onSave: (config: BrandingConfig) => Promise<void>;
}

export function BrandingForm({ branding, onSave }: BrandingFormProps) {
  const [logo, setLogo] = useState<string | null>(branding?.logo ?? null);
  const [wordmark, setWordmark] = useState(branding?.wordmark ?? '');
  const [tagline, setTagline] = useState(branding?.tagline ?? '');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        logo,
        wordmark: wordmark.trim() || null,
        tagline: tagline.trim() || null,
      });
      toast.success('Configuración de marca guardada.');
    } catch {
      toast.error('Error al guardar la configuración de marca.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marca Visual</CardTitle>
        <CardDescription>
          Personaliza el logo, nombre y eslogan de tu academia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Logo Upload */}
        <div className="flex flex-col gap-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {logo ? (
              <div className="relative size-20 overflow-hidden rounded-lg border">
                <img
                  src={logo}
                  alt="Logo de la academia"
                  className="size-full object-contain"
                />
              </div>
            ) : (
              <div className="flex size-20 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <ImagePlus className="size-6" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {logo ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              {logo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
          <p className="text-xs text-muted-foreground">
            Formatos: PNG, JPG, SVG. Máximo 2 MB.
          </p>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="wordmark">Nombre (Wordmark)</Label>
          <Input
            id="wordmark"
            placeholder="Nombre de la academia"
            value={wordmark}
            onChange={(e) => setWordmark(e.target.value)}
          />
        </div>

        {/* Tagline */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="tagline">Eslogan (Tagline)</Label>
          <Input
            id="tagline"
            placeholder="Tu eslogan aquí"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="self-start">
          <Save className="size-4 mr-1.5" />
          {saving ? 'Guardando...' : 'Guardar marca'}
        </Button>
      </CardContent>
    </Card>
  );
}
