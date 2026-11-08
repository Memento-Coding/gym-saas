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
        'sidebar-material hidden md:flex flex-col fixed inset-y-0 left-0 z-40',
        'w-[var(--sidebar-width-collapsed)] lg:w-[var(--sidebar-width)]',
        'transition-[width] duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
      )}
    >
      {/* Logo / brand */}
      <div className="flex h-[var(--header-height)] items-center justify-center lg:justify-start lg:px-5 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-white">
            <span className="text-sm font-bold leading-none">G</span>
          </div>
          <span className="hidden lg:inline text-base font-semibold text-sidebar-primary tracking-tight">
            ymOps
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto" aria-label="Navegación principal">
        {navItems.map(({ label, icon: Icon, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                'nav-item flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium',
                'lg:px-3 justify-center lg:justify-start',
                active
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )}
              aria-current={active ? 'page' : undefined}
              title={label}
            >
              <Icon
                className={cn(
                  'size-[18px] shrink-0 transition-colors duration-150',
                  active ? 'text-sidebar-primary' : 'text-sidebar-foreground/70',
                )}
              />
              <span className="hidden lg:inline">{label}</span>
              {/* Active indicator pill — only visible when expanded */}
              {active && (
                <span className="hidden lg:ml-auto lg:block size-1.5 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-sidebar-border/50 p-2">
        {user && (
          <div className="hidden lg:flex flex-col px-3 py-2 mb-1 rounded-xl bg-sidebar-accent/40">
            <span className="text-xs font-semibold text-sidebar-foreground truncate">
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
          className="nav-item w-full justify-center lg:justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/8 rounded-xl"
          onClick={() => logout()}
          title="Cerrar sesión"
        >
          <LogOut className="size-[18px] shrink-0" />
          <span className="hidden lg:inline text-sm">Cerrar sesión</span>
        </Button>
      </div>
    </aside>
  );
}

export { navItems };
