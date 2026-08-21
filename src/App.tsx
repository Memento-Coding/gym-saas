/**
 * App — Punto de entrada de la aplicación con enrutamiento.
 *
 * Configura React Router con:
 * - Rutas públicas: /login, /registro, /recuperar-password
 * - Rutas protegidas: todas las demás, envueltas en ProtectedRoute + MainLayout
 *
 * @see Requirement 1.6: enrutamiento del lado del cliente con rutas para cada módulo.
 * @see Requirement 16.1: autenticación requerida antes de acceder a rutas protegidas.
 * @see Requirement 16.4: redirigir a login si no autenticado.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider, ProtectedRoute } from '@/services/auth';
import { MainLayout } from '@/components/layout';

// Public pages
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';

// Protected pages
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { StudentProfilePage } from '@/pages/StudentProfilePage';
import { FinancePage } from '@/pages/FinancePage';
import { CourtesiesPage } from '@/pages/CourtesiesPage';
import { CommunicationPage } from '@/pages/CommunicationPage';
import { ConsentPage } from '@/pages/ConsentPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no authentication required */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/recuperar-password" element={<ForgotPasswordPage />} />

          {/* Protected routes — require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/estudiantes" element={<StudentsPage />} />
              <Route path="/estudiantes/:id" element={<StudentProfilePage />} />
              <Route path="/finanzas" element={<FinancePage />} />
              <Route path="/cortesias" element={<CourtesiesPage />} />
              <Route path="/comunicacion" element={<CommunicationPage />} />
              <Route path="/consentimiento" element={<ConsentPage />} />
              <Route path="/ajustes" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
