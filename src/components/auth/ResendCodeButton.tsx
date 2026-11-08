import { useEffect, useState } from 'react';

const COOLDOWN_SECONDS = 30;

interface ResendCodeButtonProps {
  /** Devuelve true si se envió; el padre muestra el error si falló. */
  onResend: () => Promise<boolean>;
}

export function ResendCodeButton({ onResend }: ResendCodeButtonProps) {
  // Arranca en espera: al llegar a esta pantalla acaba de enviarse un código.
  const [seconds, setSeconds] = useState(COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function handleClick() {
    setSending(true);
    setSent(false);
    const ok = await onResend();
    setSending(false);
    if (ok) {
      setSent(true);
      setSeconds(COOLDOWN_SECONDS);
    }
  }

  const waiting = seconds > 0;

  return (
    <p className="text-center text-sm text-muted-foreground">
      {sent && <span role="status" className="block mb-1 text-success-700">Te enviamos un código nuevo.</span>}
      <button
        type="button"
        disabled={waiting || sending}
        onClick={handleClick}
        className="text-primary underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
      >
        {sending ? 'Enviando...' : waiting ? `Reenviar código en ${seconds} s` : 'Reenviar código'}
      </button>
    </p>
  );
}
