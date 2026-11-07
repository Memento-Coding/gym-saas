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
    <header className="mobile-header-material md:hidden fixed top-0 inset-x-0 z-40 flex items-center h-[var(--header-height-mobile)] px-3">
      <Button
        variant="ghost"
        size="icon"
        className="pressable rounded-xl text-foreground/70 hover:text-foreground hover:bg-muted/60"
        onClick={onMenuOpen}
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </Button>
      <div className="flex items-center gap-2 ml-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-white">
          <span className="text-xs font-bold leading-none">G</span>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">ymOps</span>
      </div>
    </header>
  );
}
