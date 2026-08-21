/**
 * MobileHeader — Barra superior para dispositivos móviles (< md).
 *
 * Material translúcido (frosted glass) con botón hamburguesa y título de la app.
 */

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  onMenuOpen: () => void;
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  return (
    <header className="mobile-header-material md:hidden fixed top-0 inset-x-0 z-40 flex items-center h-[var(--header-height-mobile)] px-4 border-b border-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuOpen}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </Button>
      <span className="ml-3 text-base font-bold text-foreground">GymOps</span>
    </header>
  );
}
