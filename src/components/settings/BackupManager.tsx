/**
 * BackupManager — Gestión de respaldo y reinicio de datos.
 *
 * Permite:
 * - Exportar backup (descarga JSON)
 * - Importar backup (selección de archivo + validación)
 * - Reiniciar datos (con confirmación explícita)
 *
 * Requirements: 15.2, 15.3, 15.4, 15.5
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Download, Upload, RotateCcw, AlertTriangle, FileJson } from 'lucide-react';
import { toast } from 'sonner';

interface BackupManagerProps {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<{ success: boolean; errors?: string[] }>;
  onReset: () => Promise<void>;
}

export function BackupManager({ onExport, onImport, onReset }: BackupManagerProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport();
      toast.success('Backup descargado exitosamente.');
    } catch {
      toast.error('Error al descargar el backup.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Por favor selecciona un archivo JSON.');
      return;
    }

    setImporting(true);
    try {
      const result = await onImport(file);

      if (result.success) {
        toast.success('Datos importados exitosamente.');
      } else {
        const errorMsg = result.errors?.join(' ') ?? 'Error desconocido.';
        toast.error(`Error al importar: ${errorMsg}`);
      }
    } catch {
      toast.error('Error inesperado al importar.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = async () => {
    if (confirmText !== 'REINICIAR') return;

    setResetting(true);
    try {
      await onReset();
      setResetDialogOpen(false);
      setConfirmText('');
      toast.success('Datos reiniciados. Se preservó la configuración de precios y consentimiento.');
    } catch {
      toast.error('Error al reiniciar los datos.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Respaldo y Datos</CardTitle>
          <CardDescription>
            Exporta, importa o reinicia los datos del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Export */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Download className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Exportar backup</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Descarga todos los datos de la aplicación en un archivo JSON.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={handleExport}
              disabled={exporting}
            >
              <FileJson className="size-4 mr-1.5" />
              {exporting ? 'Exportando...' : 'Descargar backup'}
            </Button>
          </div>

          {/* Import */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Upload className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Importar backup</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Restaura los datos desde un archivo JSON de respaldo. Esto sobrescribirá los datos actuales.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="size-4 mr-1.5" />
              {importing ? 'Importando...' : 'Seleccionar archivo'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Reset */}
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Reiniciar datos</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Elimina estudiantes, inventario, ventas y finanzas. Se preservan precios,
              consentimiento y configuración de marca.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="self-start"
              onClick={() => setResetDialogOpen(true)}
            >
              <RotateCcw className="size-4 mr-1.5" />
              Reiniciar sistema
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Confirmar reinicio
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará permanentemente todos los estudiantes, inventario,
              ventas y movimientos financieros. La configuración de precios, consentimiento
              y marca se preservará.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Escribe <span className="font-mono font-bold text-foreground">REINICIAR</span> para
              confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="REINICIAR"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResetDialogOpen(false);
                  setConfirmText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={confirmText !== 'REINICIAR' || resetting}
              >
                {resetting ? 'Reiniciando...' : 'Confirmar reinicio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
