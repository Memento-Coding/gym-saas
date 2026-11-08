import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { RegisterPage } from './RegisterPage';

const register = vi.fn();
const resendCode = vi.fn();

vi.mock('@/services/auth', () => ({
  useAuth: () => ({ register, confirmRegistration: vi.fn(), resendCode }),
}));

function renderPage(state?: object) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/registro', state }]}>
      <RegisterPage />
    </MemoryRouter>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'ana@test.com');
  await user.type(document.querySelector('#password')!, 'Clave1234');
  await user.type(document.querySelector('#confirm-password')!, 'Clave1234');
}

beforeEach(() => {
  vi.clearAllMocks();
  register.mockResolvedValue({ isSignUpComplete: false });
  resendCode.mockResolvedValue(undefined);
});

describe('RegisterPage', () => {
  it('no registra sin aceptar las condiciones', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(register).not.toHaveBeenCalled();
    expect(screen.getByText(/debes aceptar las condiciones/i)).toBeInTheDocument();
  });

  it('registra al aceptar las condiciones', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(register).toHaveBeenCalledWith('ana@test.com', 'Clave1234');
  });

  it('desde el login abre la verificación y reenvía el código una sola vez', () => {
    renderPage({ email: 'ana@test.com', verify: true });

    expect(screen.getByLabelText(/código de verificación/i)).toBeInTheDocument();
    expect(resendCode).toHaveBeenCalledTimes(1);
    expect(resendCode).toHaveBeenCalledWith('ana@test.com');
  });

  it('muestra el ojo y los requisitos de la contraseña', async () => {
    const user = userEvent.setup();
    renderPage();
    const password = document.querySelector<HTMLInputElement>('#password')!;

    await user.click(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0]);
    expect(password.type).toBe('text');

    await user.type(password, 'a');
    expect(screen.getByText('una minúscula').parentElement).toHaveTextContent('(cumplido)');
    expect(screen.getByText('al menos 8 caracteres').parentElement).toHaveTextContent('(pendiente)');
  });
});
