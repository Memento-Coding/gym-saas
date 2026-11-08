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
import { nitSchema, phoneSchema } from '@/utils/validation';

interface BrandingFormProps {
  branding: BrandingConfig | null;
  onSave: (config: BrandingConfig) => Promise<void>;
}

export function BrandingForm({ branding, onSave }: BrandingFormProps) {
  const [logo, setLogo] = useState<string | null>(branding?.logo ?? null);
  const [wordmark, setWordmark] = useState(branding?.wordmark ?? '');
  const [tagline, setTagline] = useState(branding?.tagline ?? '');
  const [taxId, setTaxId] = useState(branding?.taxId ?? '');
  const [address, setAddress] = useState(branding?.address ?? '');
  const [phone, setPhone] = useState(branding?.phone ?? '');
  const [receiptNote, setReceiptNote] = useState(branding?.receiptNote ?? '');
  const [taxIdError, setTaxIdError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen.');
      return;
    }

    // La API limita el cuerpo a 350 KB y el logo viaja en base64 con todos los ajustes.
    if (file.size > 200 * 1024) {
      toast.error('El logo no puede superar 200 KB. Usa una imagen más liviana.');
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
    const parsedTaxId = nitSchema().safeParse(taxId);
    const parsedPhone = phoneSchema('El teléfono').safeParse(phone);
    setTaxIdError(parsedTaxId.success ? '' : parsedTaxId.error.issues[0].message);
    setPhoneError(parsedPhone.success ? '' : parsedPhone.error.issues[0].message);
    if (!parsedTaxId.success || !parsedPhone.success) return;

    setSaving(true);
    try {
      await onSave({
        logo,
        wordmark: wordmark.trim() || null,
        tagline: tagline.trim() || null,
        taxId: parsedTaxId.data || undefined,
        address: address.trim() || undefined,
        phone: parsedPhone.data || undefined,
        receiptNote: receiptNote.trim() || undefined,
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
            Formatos: PNG, JPG, SVG. Máximo 200 KB.
          </p>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="wordmark">Nombre (Wordmark)</Label>
          <Input
            id="wordmark"
            placeholder="Nombre de la academia"
            maxLength={60}
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
            maxLength={120}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        {/* Datos del comprobante */}
        <div className="flex flex-col gap-4 border-t pt-6">
          <div>
            <h3 className="text-base font-semibold">Datos del comprobante</h3>
            <p className="text-sm text-muted-foreground">
              Se imprimen en cada comprobante de pago, junto con el nombre y el logo.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-tax-id">NIT</Label>
              <Input
                id="receipt-tax-id"
                placeholder="900123456-7"
                inputMode="numeric"
                maxLength={20}
                aria-invalid={Boolean(taxIdError)}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value.replace(/[^\d.\s-]/g, ''))}
              />
              {taxIdError && <p className="text-xs font-medium text-destructive">{taxIdError}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-phone">Teléfono</Label>
              <Input
                id="receipt-phone"
                type="tel"
                placeholder="3001234567"
                maxLength={20}
                aria-invalid={Boolean(phoneError)}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+()\s-]/g, ''))}
              />
              {phoneError && <p className="text-xs font-medium text-destructive">{phoneError}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-address">Dirección</Label>
            <Input
              id="receipt-address"
              placeholder="Calle 10 # 20-30, Medellín"
              maxLength={100}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-note">Mensaje al pie</Label>
            <Input
              id="receipt-note"
              placeholder="Gracias por entrenar con nosotros"
              maxLength={120}
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
            />
          </div>
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
