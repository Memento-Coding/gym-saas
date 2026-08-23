/**
 * useStudents — Custom hook de conexión entre la UI y el StudentService.
 *
 * Centraliza el estado de la colección de estudiantes y expone acciones
 * asíncronas (recargar, crear, actualizar, eliminar, congelar, descongelar)
 * que delegan en el studentService y sincronizan el estado local tras cada
 * mutación exitosa.
 *
 * Todas las acciones retornan el ServiceResult del servicio para que el
 * llamador pueda reaccionar a éxito/error (por ejemplo, mostrar un toast).
 */

import { useCallback, useEffect, useState } from 'react';

import type { Student } from '@/types/student';
import {
  studentService,
  type ServiceResult,
  type StudentRegistration,
} from '@/services/StudentService';

export interface UseStudentsResult {
  /** Colección de estudiantes con status ya evaluado por el servicio. */
  students: Student[];
  /** true mientras hay una operación de lectura/escritura en curso. */
  isLoading: boolean;
  /** Último error de carga, si lo hubo. */
  error: string | null;
  /** Recarga la lista completa desde el almacenamiento. */
  reload: () => Promise<void>;
  /** Registra un nuevo estudiante. */
  create: (data: StudentRegistration) => Promise<ServiceResult<Student>>;
  /** Actualiza un estudiante existente. */
  update: (
    id: string,
    data: Partial<Student>,
  ) => Promise<ServiceResult<Student>>;
  /** Elimina un estudiante. */
  remove: (id: string) => Promise<ServiceResult<string>>;
  /** Congela la membresía de un estudiante. */
  freeze: (
    id: string,
    reason: string,
    days: number,
  ) => Promise<ServiceResult<Student>>;
  /** Descongela la membresía de un estudiante. */
  unfreeze: (id: string) => Promise<ServiceResult<Student>>;
}

export function useStudents(): UseStudentsResult {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /** Carga inicial y recarga bajo demanda. */
  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentService.getAll();
      setStudents(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron cargar los estudiantes.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Ejecuta una mutación del servicio y, si tiene éxito, recarga la lista para
   * mantener sincronizados los estados evaluados (frozen/active/inactive).
   */
  const runMutation = useCallback(
    async <T>(action: () => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> => {
      setIsLoading(true);
      try {
        const result = await action();
        if (result.success) {
          await reload();
        }
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [reload],
  );

  const create = useCallback(
    (data: StudentRegistration) => runMutation(() => studentService.register(data)),
    [runMutation],
  );

  const update = useCallback(
    (id: string, data: Partial<Student>) =>
      runMutation(() => studentService.update(id, data)),
    [runMutation],
  );

  const remove = useCallback(
    (id: string) => runMutation(() => studentService.delete(id)),
    [runMutation],
  );

  const freeze = useCallback(
    (id: string, reason: string, days: number) =>
      runMutation(() => studentService.freezeStudent(id, reason, days)),
    [runMutation],
  );

  const unfreeze = useCallback(
    (id: string) => runMutation(() => studentService.unfreezeStudent(id)),
    [runMutation],
  );

  return {
    students,
    isLoading,
    error,
    reload,
    create,
    update,
    remove,
    freeze,
    unfreeze,
  };
}
