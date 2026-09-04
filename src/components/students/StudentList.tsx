/**
 * StudentList — Tabla de estudiantes (Req 11.4).
 *
 * Columnas: Nombre, Documento, Plan, Vencimiento, Estado de pago.
 *
 * La columna "Estado de pago" muestra el estado calculado en cliente a partir
 * de subscriptionEndDate (derivePaymentStatus), usando los tokens semánticos
 * --payment-*-bg/text del Design System. Esto garantiza que el badge sea
 * consistente con el filtro de StudentFilters, que también filtra por estado
 * de pago (no por student.status).
 *
 * Los estudiantes congelados (status === 'frozen') se agrupan visualmente al
 * final de la lista, bajo una fila separadora, según indica el diseño.
 * Cada fila es clickeable y abre el StudentProfile del estudiante.
 * Se usa framer-motion para dar feedback sutil al presionar (whileTap).
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Snowflake } from 'lucide-react';

import type { Student } from '@/types/student';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PAYMENT_LABELS,
  formatDate,
  paymentBadgeStyle,
  derivePaymentStatus,
} from './studentStatus';

export interface StudentListProps {
  students: Student[];
  isLoading?: boolean;
  onSelect: (student: Student) => void;
}

export function StudentList({ students, isLoading, onSelect }: StudentListProps) {
  // Separa activos/inactivos de congelados y ubica los congelados al final.
  const { regular, frozen } = useMemo(() => {
    const regular: Student[] = [];
    const frozen: Student[] = [];
    for (const s of students) {
      (s.status === 'frozen' ? frozen : regular).push(s);
    }
    return { regular, frozen };
  }, [students]);

  if (isLoading && students.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        Cargando estudiantes...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No hay estudiantes que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Estado de pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regular.map((student) => (
            <StudentRow key={student.id} student={student} onSelect={onSelect} />
          ))}

          {frozen.length > 0 && (
            <>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="bg-muted/40 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Snowflake className="size-3.5" />
                    Membresías congeladas
                  </span>
                </TableCell>
              </TableRow>
              {frozen.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  onSelect={onSelect}
                />
              ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function StudentRow({
  student,
  onSelect,
}: {
  student: Student;
  onSelect: (student: Student) => void;
}) {
  // Estado de pago calculado desde subscriptionEndDate — consistente con el
  // filtro de StudentFilters y con StudentService.filter().
  const paymentStatus = derivePaymentStatus(student);

  return (
      <motion.tr
        data-slot="table-row"
        whileTap={{ scale: 0.99 }}
        onClick={() => onSelect(student)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(student);
          }
        }}
        className="cursor-pointer border-b transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <TableCell className="font-medium">
          {student.firstName} {student.lastName}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {student.documentId || '—'}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {student.planName || '—'}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(student.subscriptionEndDate)}
        </TableCell>
        <TableCell>
          <Badge
            className="border-transparent"
            style={paymentBadgeStyle(paymentStatus)}
            data-testid={`payment-badge-${student.id}`}
          >
            {PAYMENT_LABELS[paymentStatus]}
          </Badge>
        </TableCell>
      </motion.tr>
  );
}
