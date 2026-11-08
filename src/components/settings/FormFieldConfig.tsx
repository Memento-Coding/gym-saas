/**
 * FormFieldConfig — Configuración de campos dinámicos del formulario de registro.
 *
 * Permite:
 * - Elegir qué campos del sistema pide el gimnasio y cuáles son obligatorios
 * - Agregar nuevos campos personalizados
 * - Editar nombre, opciones y obligatoriedad
 * - Eliminar campos (con confirmación)
 *
 * Requirements: 15.6, 15.7, 15.8, 15.9
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import type { FormFieldConfig as FormFieldConfigType } from '@/types/settings';
import {
  LOCKED_STUDENT_FIELDS,
  STUDENT_FIELD_CATALOG,
  resolveStudentFields,
} from '@/components/students/studentFormFields';

interface FormFieldConfigProps {
  fields: FormFieldConfigType[];
  onSave: (fields: FormFieldConfigType[]) => Promise<void>;
}

const FIELD_TYPE_LABELS: Record<FormFieldConfigType['type'], string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Fecha',
  select: 'Selección',
  email: 'Email',
  tel: 'Teléfono',
};

function generateId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** El prefijo evita chocar con claves del estudiante; sin puntos, que RHF lee como rutas. */
function fieldKey(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug && `custom_${slug}`;
}

function parseOptions(text: string): string[] {
  return [...new Set(text.split(',').map((o) => o.trim()).filter(Boolean))];
}

export function FormFieldConfigEditor({ fields, onSave }: FormFieldConfigProps) {
  const [localFields, setLocalFields] = useState<FormFieldConfigType[]>(() =>
    resolveStudentFields(fields),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRequired, setEditRequired] = useState(false);
  const [editOptions, setEditOptions] = useState('');

  // Add field state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FormFieldConfigType['type']>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<FormFieldConfigType | null>(null);

  const [saving, setSaving] = useState(false);

  /** Mensaje de error del nombre y las opciones, o null si son válidos. */
  const definitionError = (
    label: string,
    type: FormFieldConfigType['type'],
    options: string[],
    ownId?: string,
  ): string | null => {
    if (!label) return 'El nombre del campo es obligatorio.';
    if (label.length > 40) return 'El nombre del campo no puede superar 40 caracteres.';
    if (!fieldKey(label)) return 'El nombre del campo debe contener letras o números.';
    const taken = localFields.some(
      (f) => f.id !== ownId && f.label.toLowerCase() === label.toLowerCase(),
    );
    if (taken) return 'Ya existe un campo con ese nombre.';
    if (type === 'select' && options.length === 0) {
      return 'Escribe al menos una opción, separadas por comas.';
    }
    return null;
  };

  const handleAddField = () => {
    const label = newName.trim();
    const options = parseOptions(newOptions);
    const problem = definitionError(label, newType, options);
    if (problem) {
      toast.error(problem);
      return;
    }

    const newField: FormFieldConfigType = {
      id: generateId(),
      name: fieldKey(label),
      label,
      type: newType,
      required: newRequired,
      isBuiltIn: false,
      ...(newType === 'select' && { options }),
    };

    const updated = [...localFields, newField];
    setLocalFields(updated);
    setNewName('');
    setNewType('text');
    setNewRequired(false);
    setNewOptions('');
    setShowAddForm(false);

    saveFields(updated);
  };

  const handleStartEdit = (field: FormFieldConfigType) => {
    setEditingId(field.id);
    setEditName(field.label);
    setEditRequired(field.required);
    setEditOptions((field.options ?? []).join(', '));
  };

  const handleSaveEdit = () => {
    const current = localFields.find((f) => f.id === editingId);
    if (!current) return;
    const label = editName.trim();
    const options = parseOptions(editOptions);
    const problem = definitionError(label, current.type, options, current.id);
    if (problem) {
      toast.error(problem);
      return;
    }

    // `name` no cambia: es la clave bajo la que ya están guardados los datos.
    const updated = localFields.map((f) =>
      f.id === editingId
        ? { ...f, label, required: editRequired, ...(f.type === 'select' && { options }) }
        : f,
    );

    setLocalFields(updated);
    setEditingId(null);
    saveFields(updated);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleConfirmDelete = () => {
    if (!fieldToDelete) return;

    const updated = localFields.filter((f) => f.id !== fieldToDelete.id);
    setLocalFields(updated);
    setDeleteDialogOpen(false);
    setFieldToDelete(null);

    saveFields(updated);
    toast.success(`Campo "${fieldToDelete.label}" eliminado.`);
  };

  const handleToggleBuiltIn = (field: FormFieldConfigType, enabled: boolean) => {
    const updated = enabled
      ? [...localFields, field]
      : localFields.filter((f) => f.name !== field.name);
    setLocalFields(updated);
    saveFields(updated);
  };

  const handleToggleRequired = (fieldId: string, checked: boolean) => {
    const updated = localFields.map((f) =>
      f.id === fieldId ? { ...f, required: checked } : f,
    );
    setLocalFields(updated);
    saveFields(updated);
  };

  const saveFields = async (fieldsToSave: FormFieldConfigType[]) => {
    setSaving(true);
    try {
      await onSave(fieldsToSave);
    } catch {
      toast.error('Error al guardar la configuración de campos.');
    } finally {
      setSaving(false);
    }
  };

  const customFields = localFields.filter((f) => !f.isBuiltIn);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Campos del Formulario</CardTitle>
          <CardDescription>
            Elige qué datos pide tu gimnasio al registrar un estudiante.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Campos del sistema: el gimnasio elige cuáles pedir */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Campos del sistema
            </Label>
            {STUDENT_FIELD_CATALOG.map((catalogField) => {
              const active = localFields.find((f) => f.name === catalogField.name);
              const locked = LOCKED_STUDENT_FIELDS.has(catalogField.name);
              return (
                <div
                  key={catalogField.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{catalogField.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {FIELD_TYPE_LABELS[catalogField.type]}
                    </Badge>
                  </div>
                  {locked ? (
                    <span className="text-xs text-muted-foreground">Siempre obligatorio</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id={`enabled-${catalogField.id}`}
                          checked={Boolean(active)}
                          onCheckedChange={(checked) =>
                            handleToggleBuiltIn(catalogField, checked === true)
                          }
                          aria-label={`Pedir ${catalogField.label}`}
                        />
                        <Label htmlFor={`enabled-${catalogField.id}`} className="text-xs">
                          Pedir
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id={`required-${catalogField.id}`}
                          checked={active?.required === true}
                          disabled={!active}
                          onCheckedChange={(checked) =>
                            handleToggleRequired(active?.id ?? '', checked === true)
                          }
                          aria-label={`${catalogField.label} obligatorio`}
                        />
                        <Label htmlFor={`required-${catalogField.id}`} className="text-xs">
                          Obligatorio
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom fields */}
          <div className="flex flex-col gap-2">
            {customFields.length > 0 && (
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Campos personalizados
              </Label>
            )}
            {customFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                {editingId === field.id ? (
                  // Edit mode
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 text-sm"
                      autoFocus
                    />
                    {field.type === 'select' && (
                      <Input
                        value={editOptions}
                        onChange={(e) => setEditOptions(e.target.value)}
                        placeholder="Opciones, separadas por comas"
                        aria-label="Opciones"
                        className="flex-1 text-sm"
                      />
                    )}
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`edit-required-${field.id}`}
                        checked={editRequired}
                        onCheckedChange={(checked) => setEditRequired(checked === true)}
                      />
                      <Label htmlFor={`edit-required-${field.id}`} className="text-xs">
                        Obligatorio
                      </Label>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleSaveEdit}>
                      <Save className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {FIELD_TYPE_LABELS[field.type]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id={`required-${field.id}`}
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            handleToggleRequired(field.id, checked === true)
                          }
                        />
                        <Label htmlFor={`required-${field.id}`} className="text-xs">
                          Obligatorio
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(field)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setFieldToDelete(field);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {customFields.length === 0 && !showAddForm && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay campos personalizados. Agrega uno para ampliar el formulario de registro.
              </p>
            )}
          </div>

          {/* Add new field form */}
          {showAddForm ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
              <Label>Nuevo campo</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Nombre del campo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Select
                  value={newType}
                  onValueChange={(val) => setNewType(val as FormFieldConfigType['type'])}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="date">Fecha</SelectItem>
                    <SelectItem value="select">Selección</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="tel">Teléfono</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newType === 'select' && (
                <Input
                  placeholder="Opciones, separadas por comas (Ej: S, M, L)"
                  aria-label="Opciones"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                />
              )}
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="new-field-required"
                  checked={newRequired}
                  onCheckedChange={(checked) => setNewRequired(checked === true)}
                />
                <Label htmlFor="new-field-required" className="text-sm">
                  Campo obligatorio
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAddField} disabled={saving}>
                  <Plus className="size-3.5 mr-1" />
                  Agregar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName('');
                    setNewType('text');
                    setNewRequired(false);
                    setNewOptions('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="size-3.5 mr-1" />
              Agregar campo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar campo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el campo &quot;{fieldToDelete?.label}&quot;?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
