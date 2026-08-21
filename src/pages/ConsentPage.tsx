/**
 * ConsentPage — Página principal de gestión de consentimiento.
 *
 * Muestra:
 * - Información de la versión actual del consentimiento
 * - Visualizador/editor de textos (adultos y menores)
 * - Lista de estudiantes pendientes de firma
 * - Diálogo para capturar firma de un estudiante
 *
 * Requirements: 6.1, 6.4, 6.6
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConsent } from '@/hooks/useConsent';
import { ConsentViewer } from '@/components/consent/ConsentViewer';
import { SignatureCanvas } from '@/components/consent/SignatureCanvas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FileText,
  Users,
  PenTool,
  Clock,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Student } from '@/types/student';

export function ConsentPage() {
  const {
    config,
    pendingStudents,
    loading,
    error,
    updateVersion,
    signConsent,
    deferConsent,
    generatePDF,
  } = useConsent();

  const [signingStudent, setSigningStudent] = useState<Student | null>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signingAsGuardian, setSigningAsGuardian] = useState(false);

  const handleOpenSignDialog = (student: Student) => {
    setSigningStudent(student);
    setSigningAsGuardian(student.isMinor);
    setSignDialogOpen(true);
  };

  const handleSignature = async (dataUrl: string) => {
    if (!signingStudent) return;

    try {
      await signConsent(signingStudent.id, dataUrl, signingAsGuardian);
      setSignDialogOpen(false);
      setSigningStudent(null);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleDefer = async (student: Student) => {
    try {
      await deferConsent(student.id);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleGeneratePDF = async (student: Student) => {
    try {
      await generatePDF(student);
    } catch {
      // Error is handled by the hook
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando módulo de consentimiento...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Consentimiento</h1>
        <p className="text-muted-foreground">
          Gestión de consentimiento informado y autorizaciones.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {config && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Versión actual</p>
                <p className="text-lg font-semibold">v{config.version}</p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Users className="size-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-lg font-semibold">{pendingStudents.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                <Clock className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última actualización</p>
                <p className="text-sm font-medium">
                  {format(new Date(config.updatedDate), "d MMM yyyy", { locale: es })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Consent Text Viewer/Editor */}
      {config && (
        <ConsentViewer config={config} onUpdateVersion={updateVersion} />
      )}

      {/* Pending Students List */}
      <Card>
        <CardHeader>
          <CardTitle>Estudiantes Pendientes de Firma</CardTitle>
          <CardDescription>
            Estudiantes que aún no han firmado la versión actual del consentimiento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingStudents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <PenTool className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Todos los estudiantes han firmado el consentimiento vigente.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {student.firstName} {student.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {student.documentId}
                      {student.isMinor && (
                        <Badge variant="outline" className="ml-2">
                          Menor
                        </Badge>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {student.consent.signed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGeneratePDF(student)}
                        title="Descargar PDF"
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                    {student.isMinor && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDefer(student)}
                      >
                        Diferir
                      </Button>
                    )}
                    <Button size="sm" onClick={() => handleOpenSignDialog(student)}>
                      <PenTool className="size-4 mr-1" />
                      Firmar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Captura de Firma</DialogTitle>
            <DialogDescription>
              {signingStudent && (
                <>
                  Firma para{' '}
                  <span className="font-medium text-foreground">
                    {signingStudent.firstName} {signingStudent.lastName}
                  </span>
                  {signingAsGuardian && ' (firmado por representante legal)'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <SignatureCanvas onSignature={handleSignature} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
