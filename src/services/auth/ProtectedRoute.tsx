/**
 * ProtectedRoute — Componente wrapper para rutas que requieren autenticación.
 *
 * - Si el estado de auth está cargando, muestra un indicador de carga.
 * - Si el usuario NO está autenticado, redirige a /login.
 * - Si el usuario está autenticado, renderiza las rutas hijas (Outlet).
 *
 * @see Requirement 16.4: redirigir a login cuando usuario no autenticado accede a ruta protegida.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
