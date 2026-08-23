/**
 * StudentProfile — Panel lateral (Sheet) con el detalle del estudiante (Req 3.8).
 *
 * Muestra los datos principales y expone las acciones:
 *  - Editar
 *  - Congelar / Descongelar (con un diálogo para razón y días al congelar)
 *  - Eliminar (con diálogo de confirmación previo)
 *
 * Si el estudiante está congelado, muestra freezeReason y freezeEndDate.
 * Usa framer-motion para feedback de press en los botones de acción.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Snowflake, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Student } from '@/types/student';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PAYMENT_LABELS,
  STATUS_LABELS,
  derivePaymentStatus,
  formatDate,
  paymentBadgeStyle,
  statusBadgeStyle,
  statusDotStyle,
} from './studentStatus';

/** Botón con feedback de press (Apple fluid). */
const MotionButton = motion.create(Button);

export interface StudentProfileProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (student: Student) => void;
  onFreeze: (id: string, reason: string, days: number) => Promise<void>;
  onUnfreeze: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function StudentProfile({
  student,
  open,
  onOpenChange,
  onEdit,
  onFreeze,
  onUnfreeze,
  onDelete,
  isLoading,
}: StudentProfileProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeDays, setFreezeDays] = useState('30');

  if (!student) return null;

  const isFrozen = student.status === 'frozen';
  const payment = derivePaymentStatus(student);

  const handleConfirmFreeze = async () => {
    const days = Number(freezeDays);
    if (!freezeReason.trim()) {
      toast.error('Indica el motivo del congelamiento.');
      return;
    }
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Los días deben ser un número positivo.');
      return;
    }
    await onFreeze(student.id, freezeReason.trim(), days);
    setFreezeDialogOpen(false);
    setFreezeReason('');
    setFreezeDays('30');
  };

  const handleConfirmDelete = async () => {
    await onDelete(student.id);
    setConfirmDeleteOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg">
                {student.firstName} {student.lastName}
              </SheetTitle>
              <Badge
                className="gap-1.5 border-transparent"
                style={statusBadgeStyle(student.status)}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={statusDotStyle(student.status)}
                />
                {STATUS_LABELS[student.status]}
              </Badge>
            </div>
            <SheetDescription>
              Documento: {student.documentId || '—'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {isFrozen && (
              <div
                className="space-y-1 rounded-lg p-3 text-sm"
                style={statusBadgeStyle('frozen')}
              >
                <p className="flex items-center gap-1.5 font-medium">
                  <Snowflake className="size-4" /> Membresía congelada
                </p>
                <p>Motivo: {student.freezeReason || '—'}</p>
                <p>Reactivación: {formatDate(student.freezeEndDate)}</p>
              </div>
            )}

            <DetailRow label="Plan" value={student.planName || '—'} />
            <DetailRow
              label="Vencimiento"
              value={formatDate(student.subscriptionEndDate)}
            />
            <DetailRow
              label="Estado de pago"
              value={
                <Badge
                  className="border-transparent"
                  style={paymentBadgeStyle(payment)}
                >
                  {PAYMENT_LABELS[payment]}
                </Badge>
              }
            />
            <DetailRow label="Teléfono" value={student.phone || '—'} />
            <DetailRow label="Email" value={student.email || '—'} />
            <DetailRow
              label="Edad"
              value={student.isMinor ? 'Menor de edad' : 'Adulto'}
            />
            {student.isMinor && (
              <DetailRow
                label="Acudiente"
                value={
                  student.guardianName
                    ? `${student.guardianName} (${student.guardianDocument || 's/d'})`
                    : '—'
                }
              />
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 border-t p-4">
            <MotionButton
              whileTap={{ scale: 0.97 }}
              variant="outline"
              onClick={() => onEdit(student)}
              disabled={isLoading}
            >
              <Pencil /> Editar
            </MotionButton>

            {isFrozen ? (
              <MotionButton
                whileTap={{ scale: 0.97 }}
                variant="outline"
                onClick={() => onUnfreeze(student.id)}
                disabled={isLoading}
              >
                <Sun /> Descongelar
              </MotionButton>
            ) : (
              <MotionButton
                whileTap={{ scale: 0.97 }}
                variant="outline"
                onClick={() => setFreezeDialogOpen(true)}
                disabled={isLoading}
              >
                <Snowflake /> Congelar
              </MotionButton>
            )}

            <MotionButton
              whileTap={{ scale: 0.97 }}
              variant="destructive"
              className="ml-auto"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={isLoading}
            >
              <Trash2 /> Eliminar
            </MotionButton>
          </div>
        </SheetContent>
      </Sheet>

      {/* Diálogo de congelamiento */}
      <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Congelar membresía</DialogTitle>
            <DialogDescription>
              El vencimiento se extenderá automáticamente por la misma cantidad
              de días.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="freeze-reason">Motivo</Label>
              <Textarea
                id="freeze-reason"
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder="Ej. Lesión, viaje, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="freeze-days">Días de congelamiento</Label>
              <Input
                id="freeze-days"
                type="number"
                min={1}
                value={freezeDays}
                onChange={(e) => setFreezeDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFreezeDialogOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmFreeze} disabled={isLoading}>
              Congelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar estudiante</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar a {student.firstName}{' '}
              {student.lastName}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isLoading}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
