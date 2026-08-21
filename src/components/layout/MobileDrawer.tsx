/**
 * MobileDrawer — Drawer de navegación para mobile (< md).
 *
 * Usa el componente Sheet de shadcn/ui con slide desde la izquierda.
 */

import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { useAuth } from '@/services/auth';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { navItems } from './Sidebar';

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-lg font-bold text-primary">
            GymOps
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto" aria-label="Navegación principal">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                to={href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="mt-auto border-t border-border p-3">
          {user && (
            <div className="flex flex-col px-3 py-2 mb-1">
              <span className="text-sm font-medium truncate">
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
            className="w-full justify-start gap-3 text-foreground hover:text-destructive"
            onClick={() => {
              logout();
              onOpenChange(false);
            }}
          >
            <LogOut className="size-5 shrink-0" />
            <span className="text-sm">Cerrar sesión</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
