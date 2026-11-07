/**
 * MainLayout — Layout principal de la aplicación autenticada.
 *
 * Incluye Sidebar (desktop/tablet), MobileHeader + MobileDrawer (mobile),
 * y un area de contenido que renderiza las rutas hijas via <Outlet />.
 *
 * @see Requirement 1.6: enrutamiento con sidebar para módulos principales.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileDrawer } from './MobileDrawer';

export function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop/Tablet sidebar */}
      <Sidebar />

      {/* Mobile header */}
      <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Main content area */}
      <main
        className={
          'pt-[var(--header-height-mobile)] md:pt-0 ' +
          'md:ml-[var(--sidebar-width-collapsed)] lg:ml-[var(--sidebar-width)] ' +
          'transition-[margin-left] duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ' +
          'p-4 md:p-6 lg:p-8 min-h-screen'
        }
      >
        <div className="page-enter max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
