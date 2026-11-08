import { Check, Circle } from 'lucide-react';

import { passwordSchema } from '@/utils/validation';

function unmetRules(password: string): string[] {
  const result = passwordSchema().safeParse(password);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

// Una cadena vacía incumple todas las reglas: así la lista siempre coincide con el schema.
const ALL_RULES = unmetRules('');

function ruleLabel(rule: string): string {
  return rule.replace(/^La contraseña debe (tener|incluir) /, '').replace(/\.$/, '');
}

export function PasswordRequirements({ password }: { password: string }) {
  const unmet = unmetRules(password);

  return (
    <div className="text-xs text-muted-foreground">
      <p className="mb-1">Tu contraseña necesita:</p>
      <ul className="flex flex-col gap-0.5">
        {ALL_RULES.map((rule) => {
          const met = !unmet.includes(rule);
          const Icon = met ? Check : Circle;
          return (
            <li key={rule} className={`flex items-center gap-1.5 ${met ? 'text-success-700' : ''}`}>
              <Icon className="size-3 shrink-0" aria-hidden />
              <span>{ruleLabel(rule)}</span>
              <span className="sr-only">{met ? '(cumplido)' : '(pendiente)'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
