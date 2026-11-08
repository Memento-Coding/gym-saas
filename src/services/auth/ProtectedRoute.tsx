/**
 * ProtectedRoute — Componente wrapper para rutas que requieren autenticación.
 *
 * - Si el estado de auth está cargando, muestra un indicador de carga.
 * - Si el usuario NO está autenticado, redirige a /login.
 * - Si el usuario está autenticado, renderiza las rutas hijas (Outlet).
 *
 * @see Requirement 16.4: redirigir a login cuando usuario no autenticado accede a ruta protegida.
 */

import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { clearReturnPath, peekReturnPath } from './returnPath';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Se borra en un efecto: un render puede repetirse y debe ver la misma ruta guardada.
  useEffect(() => {
    if (isAuthenticated) clearReturnPath();
  }, [isAuthenticated]);

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
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const returnPath = peekReturnPath();
  if (returnPath && returnPath !== location.pathname + location.search) {
    return <Navigate to={returnPath} replace />;
  }

  return <Outlet />;
}
