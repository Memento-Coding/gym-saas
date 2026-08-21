/**
 * StudentProfilePage — Perfil individual de un estudiante.
 * Placeholder hasta implementación del módulo Estudiantes.
 */

import { useParams } from 'react-router-dom';

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Perfil del Estudiante</h1>
      <p className="text-muted-foreground">
        Detalle del estudiante con ID: {id}
      </p>
    </div>
  );
}
