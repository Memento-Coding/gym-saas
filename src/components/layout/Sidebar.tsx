/**
 * Sidebar — Navegación lateral principal.
 *
 * Comportamiento responsivo:
 * - < md (768px): oculto (se usa MobileDrawer)
 * - md-lg (768–1024px): colapsado, solo íconos (64px)
 * - >= lg (1024px): expandido (240px)
 *
 * @see Requirement 1.6: enrutamiento con rutas para cada módulo principal.
 */

import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Gift,
  MessageSquare,
  FileCheck,
  Settings,
  LogOut,
} from 'lucide-react';

import { useAuth } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Estudiantes', icon: Users, href: '/estudiantes' },
  { label: 'Finanzas', icon: Wallet, href: '/finanzas' },
  { label: 'Cortesías', icon: Gift, href: '/cortesias' },
  { label: 'Comunicación', icon: MessageSquare, href: '/comunicacion' },
  { label: 'Consentimiento', icon: FileCheck, href: '/consentimiento' },
  { label: 'Ajustes', icon: Settings, href: '/ajustes' },
] as const;

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        'sidebar-material hidden md:flex flex-col fixed inset-y-0 left-0 z-40 border-r border-sidebar-border',
        'w-[var(--sidebar-width-collapsed)] lg:w-[var(--sidebar-width)]',
        'transition-[width] duration-200 ease-in-out',
      )}
    >
      {/* Logo / brand */}
      <div className="flex h-[var(--header-height)] items-center justify-center lg:justify-start lg:px-6 border-b border-sidebar-border">
        <span className="text-lg font-bold text-sidebar-primary">G</span>
        <span className="hidden lg:inline text-lg font-bold text-sidebar-primary ml-1">
          ymOps
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto" aria-label="Navegación principal">
        {navItems.map(({ label, icon: Icon, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground',
                'lg:px-3 justify-center lg:justify-start',
              )}
              aria-current={active ? 'page' : undefined}
              title={label}
            >
              <Icon className="size-5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-sidebar-border p-2">
        {user && (
          <div className="hidden lg:flex flex-col px-3 py-2 mb-1">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {user.username}
            </span>
            {user.email && (
              <span className="text-xs text-muted-foreground truncate">
                {user.email}
              </span>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-center lg:justify-start gap-3 text-sidebar-foreground hover:text-destructive"
          onClick={() => logout()}
          title="Cerrar sesión"
        >
          <LogOut className="size-5 shrink-0" />
          <span className="hidden lg:inline text-sm">Cerrar sesión</span>
        </Button>
      </div>
    </aside>
  );
}

export { navItems };
