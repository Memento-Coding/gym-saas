/**
 * CommunicationPage — Página principal del módulo de comunicación multicanal.
 *
 * Organizada en tres tabs:
 * - Plantillas: edición de plantillas de mensaje con variables dinámicas
 * - Canales: activar/desactivar canales y configurar tipos de notificación
 * - Enviar: selección de plantilla, canal, estudiantes y envío en lote con reporte
 *
 * Requirements: 12.4, 12.6, 12.9, 12.10, 12.12, 12.13, 12.15, 12.16
 */

import { useState, useMemo } from 'react';
import { useCommunication } from '@/hooks/useCommunication';
import { TemplateEditor } from '@/components/communication/TemplateEditor';
import { ChannelSelector } from '@/components/communication/ChannelSelector';
import { MessagePreview } from '@/components/communication/MessagePreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Radio,
  Send,
  Loader2,
  AlertCircle,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TemplateId, MessageTemplate } from '@/types/communication';
import type { Student } from '@/types/student';
import type { BatchSendResult } from '@/services/CommunicationService';

/** Mapa de templateId → etiqueta */
const TEMPLATE_LABELS: Record<TemplateId, string> = {
  warn: 'Aviso de vencimiento',
  overdue: 'Membresía vencida',
  ret: 'Invitación a volver',
  cartera: 'Cuota pendiente',
  bday: 'Feliz cumpleaños',
};

export function CommunicationPage() {
  const {
    templates,
    channelConfigs,
    channels,
    students,
    loading,
    error,
    updateTemplate,
    updateChannelConfig,
    sendBatch,
    renderPreview,
  } = useCommunication();

  // Estado para el tab de envío
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | ''>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchSendResult | null>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  // Estudiantes seleccionados
  const selectedStudents = useMemo(
    () => students.filter((s) => selectedStudentIds.has(s.id)),
    [students, selectedStudentIds],
  );

  // Plantilla actual seleccionada
  const currentTemplate: MessageTemplate | null = useMemo(
    () => (templates && selectedTemplateId ? templates[selectedTemplateId] : null),
    [templates, selectedTemplateId],
  );

  // Mensaje previsualizado
  const previewMessage = useMemo(() => {
    if (!currentTemplate || !previewStudent) return '';
    return renderPreview(currentTemplate, previewStudent);
  }, [currentTemplate, previewStudent, renderPreview]);

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleSend = async () => {
    if (!selectedTemplateId || selectedStudents.length === 0) return;

    setSending(true);
    setBatchResult(null);

    try {
      const result = await sendBatch(
        selectedStudents,
        selectedTemplateId,
        selectedChannelId || undefined,
      );
      setBatchResult(result);

      if (result.sent.length > 0) {
        toast.success(`${result.sent.length} mensaje(s) enviado(s) correctamente.`);
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} estudiante(s) omitido(s) por falta de contacto.`);
      }
    } catch {
      toast.error('Error al enviar los mensajes.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async (templateId: string, newText: string) => {
    try {
      await updateTemplate(templateId as TemplateId, newText);
      toast.success('Plantilla actualizada correctamente.');
    } catch {
      toast.error('Error al guardar la plantilla.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando módulo de comunicación...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Comunicación</h1>
        <p className="text-muted-foreground">
          Gestión de plantillas, canales y envío de mensajes a estudiantes.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="plantillas">
        <TabsList>
          <TabsTrigger value="plantillas">
            <FileText className="size-4 mr-1.5" />
            Plantillas
          </TabsTrigger>
          <TabsTrigger value="canales">
            <Radio className="size-4 mr-1.5" />
            Canales
          </TabsTrigger>
          <TabsTrigger value="enviar">
            <Send className="size-4 mr-1.5" />
            Enviar
          </TabsTrigger>
        </TabsList>

        {/* Tab: Plantillas */}
        <TabsContent value="plantillas">
          <div className="flex flex-col gap-4">
            {templates &&
              (Object.keys(templates) as TemplateId[]).map((templateId) => (
                <TemplateEditor
                  key={templateId}
                  template={templates[templateId]}
                  onSave={handleSaveTemplate}
                />
              ))}
          </div>
        </TabsContent>

        {/* Tab: Canales */}
        <TabsContent value="canales">
          <ChannelSelector
            channels={channels}
            configs={channelConfigs}
            onUpdate={updateChannelConfig}
          />
        </TabsContent>

        {/* Tab: Enviar */}
        <TabsContent value="enviar">
          <div className="flex flex-col gap-4">
            {/* Selección de plantilla y canal */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración del envío</CardTitle>
                <CardDescription>
                  Selecciona la plantilla, el canal y los estudiantes destinatarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Selector de plantilla */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="template-select">
                      Plantilla
                    </label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={(v) => setSelectedTemplateId(v as TemplateId)}
                    >
                      <SelectTrigger id="template-select" aria-label="Seleccionar plantilla">
                        <SelectValue placeholder="Seleccionar plantilla..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TEMPLATE_LABELS) as TemplateId[]).map((id) => (
                          <SelectItem key={id} value={id}>
                            {TEMPLATE_LABELS[id]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selector de canal */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium" htmlFor="channel-select">
                      Canal (opcional)
                    </label>
                    <Select
                      value={selectedChannelId}
                      onValueChange={setSelectedChannelId}
                    >
                      <SelectTrigger id="channel-select" aria-label="Seleccionar canal">
                        <SelectValue placeholder="Todos los canales activos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los canales activos</SelectItem>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selección de estudiantes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Destinatarios</CardTitle>
                    <CardDescription>
                      {selectedStudentIds.size} de {students.length} estudiante(s) seleccionado(s)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    <Users className="size-4 mr-1" />
                    {selectedStudentIds.size === students.length
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No hay estudiantes registrados.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border rounded-md border">
                    {students.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedStudentIds.has(student.id)}
                          onCheckedChange={() => handleToggleStudent(student.id)}
                          aria-label={`Seleccionar ${student.firstName} ${student.lastName}`}
                        />
                        <div className="flex flex-1 items-center justify-between min-w-0">
                          <span className="text-sm font-medium truncate">
                            {student.firstName} {student.lastName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {student.email && (
                              <Badge variant="outline" className="text-xs">
                                Email
                              </Badge>
                            )}
                            {student.phone && (
                              <Badge variant="outline" className="text-xs">
                                WhatsApp
                              </Badge>
                            )}
                            {student.telegramChatId && (
                              <Badge variant="outline" className="text-xs">
                                Telegram
                              </Badge>
                            )}
                          </div>
                        </div>
                        {/* Preview button */}
                        {currentTemplate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setPreviewStudent(student);
                            }}
                            aria-label={`Previsualizar mensaje para ${student.firstName}`}
                            className="shrink-0"
                          >
                            Vista previa
                          </Button>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Previsualización */}
            {previewMessage && previewStudent && (
              <MessagePreview
                message={previewMessage}
                channelId={selectedChannelId && selectedChannelId !== 'all' ? selectedChannelId : undefined}
                student={previewStudent}
              />
            )}

            {/* Botón de envío */}
            <div className="flex justify-end">
              <Button
                onClick={handleSend}
                disabled={!selectedTemplateId || selectedStudents.length === 0 || sending}
                size="lg"
              >
                {sending ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Send className="size-4 mr-2" />
                )}
                {sending
                  ? 'Enviando...'
                  : `Enviar a ${selectedStudents.length} estudiante(s)`}
              </Button>
            </div>

            {/* Resultados del envío */}
            {batchResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Resultado del envío</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* Enviados */}
                  {batchResult.sent.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <CheckCircle2 className="size-4" />
                        Enviados ({batchResult.sent.length})
                      </div>
                      <div className="rounded-md border divide-y divide-border">
                        {batchResult.sent.map((item, idx) => (
                          <div
                            key={`${item.studentId}-${item.channelId}-${idx}`}
                            className="flex items-center justify-between px-3 py-2 text-sm"
                          >
                            <span>{item.studentName}</span>
                            <Badge variant="secondary">{item.channelId}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Omitidos */}
                  {batchResult.skipped.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                        <XCircle className="size-4" />
                        Omitidos ({batchResult.skipped.length})
                      </div>
                      <div className="rounded-md border divide-y divide-border">
                        {batchResult.skipped.map((item, idx) => (
                          <div
                            key={`${item.studentId}-${item.channelId}-${idx}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{item.studentName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs">
                                {item.reason}
                              </span>
                              <Badge variant="outline">{item.channelId}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {batchResult.sent.length === 0 && batchResult.skipped.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No se procesaron mensajes. Verifica la configuración de canales.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
