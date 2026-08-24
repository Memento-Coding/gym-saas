/**
 * CourtesiesPage — Página de gestión de cortesías y bonos.
 *
 * Muestra:
 * - Lista consolidada de bonos agrupados por estudiante
 * - Indicador de estado activo/expirado por bono
 * - Formulario para registrar nuevos bonos
 * - Opción de eliminar bonos existentes
 *
 * Requirements: 13.1, 13.2, 13.3
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCourtesies } from '@/hooks/useCourtesies';
import { useStudents } from '@/hooks/useStudents';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Gift,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  User,
} from 'lucide-react';

export function CourtesiesPage() {
  const { bonusGroups, loading, error, addBonus, removeBonus } = useCourtesies();
  const { students } = useStudents();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formWeeks, setFormWeeks] = useState('');
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const isBonusActive = (endDate: string) => {
    return endDate >= today;
  };

  const totalBonuses = bonusGroups.reduce((sum, g) => sum + g.bonuses.length, 0);
  const activeBonuses = bonusGroups.reduce(
    (sum, g) => sum + g.bonuses.filter((b) => isBonusActive(b.endDate)).length,
    0,
  );

  const handleOpenDialog = () => {
    setFormStudentId('');
    setFormStartDate('');
    setFormWeeks('');
    setFormReason('');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId || !formStartDate || !formWeeks || !formReason) return;

    setSubmitting(true);
    try {
      await addBonus(formStudentId, {
        startDate: formStartDate,
        weeks: parseInt(formWeeks, 10),
        reason: formReason,
      });
      setDialogOpen(false);
    } catch {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (studentId: string, bonusId: string) => {
    try {
      await removeBonus(studentId, bonusId);
    } catch {
      // Error handled by hook
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando módulo de cortesías...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Cortesías</h1>
          <p className="text-muted-foreground">
            Gestión de bonos y cortesías otorgados a estudiantes.
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="size-4 mr-1" />
          Nuevo bono
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Gift className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total bonos</p>
              <p className="text-lg font-semibold">{totalBonuses}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <Calendar className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activos</p>
              <p className="text-lg font-semibold">{activeBonuses}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
              <User className="size-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estudiantes con bono</p>
              <p className="text-lg font-semibold">{bonusGroups.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bonuses grouped by student */}
      {bonusGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Gift className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay bonos de cortesía registrados.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleOpenDialog}>
              <Plus className="size-4 mr-1" />
              Registrar primer bono
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {bonusGroups.map((group) => (
            <Card key={group.studentId}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4 text-muted-foreground" />
                  {group.studentName}
                </CardTitle>
                <CardDescription>
                  {group.bonuses.length} bono{group.bonuses.length !== 1 ? 's' : ''} registrado{group.bonuses.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {group.bonuses.map((bonus) => {
                    const active = isBonusActive(bonus.endDate);
                    return (
                      <div
                        key={bonus.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{bonus.reason}</span>
                            <Badge variant={active ? 'default' : 'secondary'}>
                              {active ? 'Activo' : 'Expirado'}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(bonus.startDate), "d MMM yyyy", { locale: es })}
                            {' → '}
                            {format(new Date(bonus.endDate), "d MMM yyyy", { locale: es })}
                            {' · '}
                            {bonus.weeks} semana{bonus.weeks !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(group.studentId, bonus.id)}
                          title="Eliminar bono"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Bonus Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Bono de Cortesía</DialogTitle>
            <DialogDescription>
              Asigna un bono de cortesía a un estudiante. El bono no modifica la fecha de vencimiento de la membresía.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bonus-student">Estudiante</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger id="bonus-student">
                  <SelectValue placeholder="Seleccionar estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bonus-start-date">Fecha de inicio</Label>
              <Input
                id="bonus-start-date"
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bonus-weeks">Duración (semanas)</Label>
              <Input
                id="bonus-weeks"
                type="number"
                min={1}
                value={formWeeks}
                onChange={(e) => setFormWeeks(e.target.value)}
                placeholder="Ej: 2"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bonus-reason">Razón</Label>
              <Input
                id="bonus-reason"
                type="text"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Ej: Compensación por cierre temporal"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || !formStudentId || !formStartDate || !formWeeks || !formReason}
              >
                {submitting && <Loader2 className="size-4 mr-1 animate-spin" />}
                Registrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
