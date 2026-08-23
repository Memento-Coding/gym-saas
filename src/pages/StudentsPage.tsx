/**
 * StudentsPage — Vista principal del módulo de Estudiantes (Issue 8.1).
 *
 * Orquesta limpiamente los sub-componentes:
 *  - Cabecera con título y botón "Nuevo Estudiante" (abre StudentForm en un Sheet).
 *  - Barra de búsqueda en tiempo real (studentService.search).
 *  - StudentFilters (estado de pago + edad).
 *  - StudentList (tabla con congelados agrupados al final).
 *  - StudentProfile (panel lateral con acciones editar/congelar/eliminar).
 *
 * El estado de datos vive en el hook useStudents; esta página solo compone la UI
 * y aplica búsqueda/filtrado sobre la colección en memoria.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import type { Student } from '@/types/student';
import { studentService, type StudentFilterCriteria } from '@/services/StudentService';
import { useStudents } from '@/hooks/useStudents';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { StudentFilters, ALL } from '@/components/students/StudentFilters';
import type {
  AgeFilterValue,
  PaymentFilterValue,
} from '@/components/students/StudentFilters';
import { StudentList } from '@/components/students/StudentList';
import { StudentProfile } from '@/components/students/StudentProfile';
import { StudentForm } from '@/components/students/StudentForm';
import {
  DEFAULT_STUDENT_FIELDS,
  buildStudentDefaults,
} from '@/components/students/studentFormFields';

const MotionButton = motion.create(Button);

export function StudentsPage() {
  const { students, isLoading, create, update, remove, freeze, unfreeze } =
    useStudents();

  // Búsqueda y filtros.
  const [query, setQuery] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentFilterValue>(ALL);
  const [ageGroup, setAgeGroup] = useState<AgeFilterValue>(ALL);

  // Colección visible tras aplicar búsqueda + filtros.
  const [visible, setVisible] = useState<Student[]>([]);

  // Sheet del formulario (crear/editar).
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  // Panel de perfil.
  const [profileOpen, setProfileOpen] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);

  // Recalcula la lista visible cuando cambian datos, búsqueda o filtros.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const searched = await studentService.search(query, students);
      const criteria: StudentFilterCriteria = {};
      if (paymentStatus !== ALL) criteria.paymentStatus = paymentStatus;
      if (ageGroup !== ALL) criteria.ageGroup = ageGroup;
      const filtered = await studentService.filter(criteria, searched);
      if (!cancelled) setVisible(filtered);
    })();

    return () => {
      cancelled = true;
    };
  }, [students, query, paymentStatus, ageGroup]);

  // Mantiene sincronizado el estudiante seleccionado con los datos frescos.
  const selectedFresh = useMemo(
    () => (selected ? students.find((s) => s.id === selected.id) ?? null : null),
    [selected, students],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setProfileOpen(false);
    setFormOpen(true);
  };

  const handleSelect = (student: Student) => {
    setSelected(student);
    setProfileOpen(true);
  };

  const handleSubmit = async (data: Partial<Student>) => {
    if (editing) {
      const result = await update(editing.id, data);
      if (result.success) {
        toast.success('Estudiante actualizado.');
        setFormOpen(false);
      } else {
        toast.error(result.error);
      }
      return;
    }

    // Creación: completa los campos requeridos del modelo con los defaults.
    const payload = { ...buildStudentDefaults(), ...data };
    const result = await create(payload);
    if (result.success) {
      toast.success('Estudiante registrado.');
      setFormOpen(false);
    } else {
      toast.error(result.error);
    }
  };

  const handleFreeze = async (id: string, reason: string, days: number) => {
    const result = await freeze(id, reason, days);
    if (result.success) toast.success('Membresía congelada.');
    else toast.error(result.error);
  };

  const handleUnfreeze = async (id: string) => {
    const result = await unfreeze(id);
    if (result.success) toast.success('Membresía reactivada.');
    else toast.error(result.error);
  };

  const handleDelete = async (id: string) => {
    const result = await remove(id);
    if (result.success) toast.success('Estudiante eliminado.');
    else toast.error(result.error);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estudiantes</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de estudiantes del gimnasio.
          </p>
        </div>
        <MotionButton whileTap={{ scale: 0.97 }} onClick={openCreate}>
          <Plus /> Nuevo Estudiante
        </MotionButton>
      </header>

      {/* Búsqueda + filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, documento o teléfono"
            className="pl-8"
          />
        </div>
        <StudentFilters
          paymentStatus={paymentStatus}
          ageGroup={ageGroup}
          onPaymentStatusChange={setPaymentStatus}
          onAgeGroupChange={setAgeGroup}
        />
      </div>

      {/* Lista */}
      <StudentList
        students={visible}
        isLoading={isLoading}
        onSelect={handleSelect}
      />

      {/* Perfil */}
      <StudentProfile
        student={selectedFresh}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onEdit={openEdit}
        onFreeze={handleFreeze}
        onUnfreeze={handleUnfreeze}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      {/* Formulario crear/editar */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>
              {editing ? 'Editar estudiante' : 'Nuevo estudiante'}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? 'Actualiza la información del estudiante.'
                : 'Completa los datos para registrar un nuevo estudiante.'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <StudentForm
              key={editing?.id ?? 'new'}
              fields={DEFAULT_STUDENT_FIELDS}
              defaultValues={editing ?? undefined}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              onCancel={() => setFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
