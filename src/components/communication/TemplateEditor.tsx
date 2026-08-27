/**
 * TemplateEditor — Editor de plantillas de mensaje con soporte para variables dinámicas.
 *
 * Permite al administrador:
 * - Ver y editar el texto de la plantilla en un textarea
 * - Insertar variables disponibles haciendo clic en badges
 * - Previsualizar el texto renderizado con datos de ejemplo
 * - Guardar cambios que persisten para comunicaciones futuras
 *
 * Requirements: 12.4, 12.5, 12.6
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Save, RotateCcw, Eye, EyeOff } from 'lucide-react';
import type { MessageTemplate } from '@/types/communication';

interface TemplateEditorProps {
  template: MessageTemplate;
  onSave: (templateId: string, newText: string) => Promise<void>;
}

/** Datos de ejemplo para previsualización */
const SAMPLE_VARIABLES: Record<string, string> = {
  nombre: 'Juan Pérez',
  fecha_vencimiento: '15/02/2025',
  monto: '110,000',
  edad: '25',
};

export function TemplateEditor({ template, onSave }: TemplateEditorProps) {
  const [text, setText] = useState(template.text);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasChanges = text !== template.text;

  const handleInsertVariable = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const variable = `{{${key}}}`;

    const newText = text.slice(0, start) + variable + text.slice(end);
    setText(newText);

    // Restore cursor position after the inserted variable
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + variable.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(template.id, text);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setText(template.text);
  };

  /** Renderiza el texto reemplazando variables con datos de ejemplo */
  const renderPreview = (templateText: string): string => {
    return templateText.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return key in SAMPLE_VARIABLES ? SAMPLE_VARIABLES[key] : match;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{template.label}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            aria-label={showPreview ? 'Ocultar previsualización' : 'Mostrar previsualización'}
          >
            {showPreview ? <EyeOff className="size-4 mr-1" /> : <Eye className="size-4 mr-1" />}
            {showPreview ? 'Editar' : 'Vista previa'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Variables disponibles */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Variables disponibles (clic para insertar):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {template.vars.map((v) => (
              <Badge
                key={v.key}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => handleInsertVariable(v.key)}
                title={v.desc}
                role="button"
                aria-label={`Insertar variable ${v.key}: ${v.desc}`}
              >
                {`{{${v.key}}}`}
              </Badge>
            ))}
          </div>
        </div>

        {/* Editor o previsualización */}
        {showPreview ? (
          <div className="rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap">
            {renderPreview(text)}
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="resize-y font-mono text-sm"
            aria-label={`Texto de plantilla: ${template.label}`}
          />
        )}

        {/* Acciones */}
        <div className="flex items-center gap-2 justify-end">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              aria-label="Descartar cambios"
            >
              <RotateCcw className="size-4 mr-1" />
              Descartar
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            aria-label="Guardar plantilla"
          >
            <Save className="size-4 mr-1" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
