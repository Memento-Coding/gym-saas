/**
 * BirthdayNotification — Alerta visual especial para cumpleaños del día.
 *
 * Resalta a los estudiantes activos que cumplen años hoy, con opción de enviar
 * una felicitación a través del canal de comunicación activo (Req 10.4). La
 * acción de envío se delega vía callback (la integración con el módulo de
 * comunicación se conecta en la Fase 2).
 *
 * Requirements: 10.4
 */

import { Cake, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BirthdayStudent {
  id: string;
  name: string;
}

interface BirthdayNotificationProps {
  students: BirthdayStudent[];
  /** Callback para enviar felicitación (conexión con comunicación en Fase 2). */
  onSendGreeting?: (student: BirthdayStudent) => void;
}

export function BirthdayNotification({ students, onSendGreeting }: BirthdayNotificationProps) {
  if (students.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl bg-accent-50 p-4 ring-1 ring-accent-400/40 sm:flex-row sm:items-center sm:justify-between"
      style={{ background: 'var(--color-accent-50)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--color-accent-100)' }}
        >
          <Cake className="size-5" style={{ color: 'var(--color-accent-600)' }} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-accent-600)' }}>
            {students.length === 1
              ? '¡Hoy es un cumpleaños!'
              : `¡Hoy hay ${students.length} cumpleaños!`}
          </p>
          <p className="text-sm text-secondary-700">
            {students.map((s) => s.name).join(', ')}
          </p>
        </div>
      </div>

      {onSendGreeting && (
        <div className="flex flex-wrap gap-2">
          {students.map((student) => (
            <Button
              key={student.id}
              size="sm"
              variant="outline"
              onClick={() => onSendGreeting(student)}
            >
              <Send className="size-3.5" />
              Felicitar a {student.name.split(' ')[0]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
