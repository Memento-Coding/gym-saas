/**
 * StudentProfile — Modal centrado con el detalle del estudiante (Req 3.8).
 *
 * Migrado de Sheet (panel lateral) a Dialog (modal centrado) según
 * STEERING_FORMS §6: formularios largos con múltiples secciones y acciones
 * usan Dialog para mejor aprovechamiento del espacio en pantallas grandes.
 *
 * Muestra los datos principales y expone las acciones:
 *  - Editar
 *  - Congelar / Descongelar (con un diálogo anidado para razón y días)
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PAYMENT_LABELS,
  derivePaymentStatus,
  formatDate,
  paymentBadgeStyle,
  statusBadgeStyle,
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
  // El congelamiento solo está disponible para cuentas activas y al día / por vencer.
  const canFreeze =
    student.status === 'active' && (payment === 'al_dia' || payment === 'por_vencer');

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
      {/* ── Modal principal del perfil ─────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
          {/* Cabecera */}
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg">
                {student.firstName} {student.lastName}
              </DialogTitle>
              {/* Badge de estado de pago — coherente con la tabla */}
              <Badge
                className="border-transparent"
                style={paymentBadgeStyle(payment)}
                data-testid="profile-payment-badge"
              >
                {PAYMENT_LABELS[payment]}
              </Badge>
            </div>
            <DialogDescription>
              Documento: {student.documentId || '—'}
            </DialogDescription>
          </DialogHeader>

          {/* Cuerpo con scroll */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
          <div className="flex flex-wrap gap-2 border-t px-6 py-4">
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
              <div className="flex flex-col gap-1">
                <MotionButton
                  whileTap={canFreeze ? { scale: 0.97 } : undefined}
                  variant="outline"
                  onClick={() => canFreeze && setFreezeDialogOpen(true)}
                  disabled={isLoading || !canFreeze}
                  title={
                    !canFreeze
                      ? student.status === 'inactive'
                        ? 'No se puede congelar una cuenta inactiva'
                        : 'No se puede congelar una cuenta con pago vencido'
                      : undefined
                  }
                >
                  <Snowflake /> Congelar
                </MotionButton>
                {!canFreeze && (
                  <p className="text-xs text-muted-foreground">
                    {student.status === 'inactive'
                      ? 'Cuenta inactiva — debe renovar primero.'
                      : 'Pago vencido — debe renovar primero.'}
                  </p>
                )}
              </div>
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
        </DialogContent>
      </Dialog>

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
