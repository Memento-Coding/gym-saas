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
      <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
        <SheetHeader className="border-b border-border/50 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-white">
              <span className="text-sm font-bold leading-none">G</span>
            </div>
            <SheetTitle className="text-base font-semibold text-primary tracking-tight">
              ymOps
            </SheetTitle>
          </div>
        </SheetHeader>

        <nav className="flex-1 flex flex-col gap-0.5 p-2.5 overflow-y-auto" aria-label="Navegación principal">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                to={href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent/60 hover:text-accent-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'size-[18px] shrink-0',
                    active ? 'text-primary' : 'text-foreground/60',
                  )}
                />
                <span>{label}</span>
                {active && (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="mt-auto border-t border-border/50 p-2.5">
          {user && (
            <div className="flex flex-col px-3 py-2 mb-1 rounded-xl bg-muted/50">
              <span className="text-xs font-semibold truncate">
                {user.name ?? user.email ?? 'Usuario'}
              </span>
              {user.name && user.email && (
                <span className="text-xs text-muted-foreground truncate">
                  {user.email}
                </span>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            className="nav-item w-full justify-start gap-3 text-foreground/70 hover:text-destructive hover:bg-destructive/8 rounded-xl"
            onClick={() => {
              logout();
              onOpenChange(false);
            }}
          >
            <LogOut className="size-[18px] shrink-0" />
            <span className="text-sm">Cerrar sesión</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
