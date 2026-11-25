import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Student } from '@/types/student';

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

const signConsent = vi.fn();
const generatePDF = vi.fn();
const pending = [{
  id: 's1', firstName: 'Ana', lastName: 'Ruiz', documentId: '123', isMinor: false,
  consent: { signed: false },
}] as unknown as Student[];

vi.mock('@/hooks/useConsent', () => ({
  useConsent: () => ({
    config: { currentVersion: 1, currentText: 'a', currentMinorText: 'b', updatedDate: '2026-11-01', history: [] },
    pendingStudents: pending,
    loading: false,
    error: null,
    updateVersion: vi.fn(),
    signConsent,
    deferConsent: vi.fn(),
    generatePDF,
  }),
}));

vi.mock('@/components/consent/SignatureCanvas', () => ({
  SignatureCanvas: ({ onSignature }: { onSignature: (d: string) => void }) => (
    <button onClick={() => onSignature('data:image/png;base64,x')}>firma-falsa</button>
  ),
}));

vi.mock('@/components/consent/ConsentViewer', () => ({ ConsentViewer: () => null }));

import { ConsentPage } from './ConsentPage';

describe('ConsentPage — PDF tras firmar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ofrece descargar el PDF del alumno recién firmado', async () => {
    const signed = { ...pending[0], consent: { signed: true } };
    signConsent.mockResolvedValue(signed);
    render(<ConsentPage />);

    fireEvent.click(screen.getByRole('button', { name: /firmar/i }));
    fireEvent.click(await screen.findByText('firma-falsa'));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    const [msg, opts] = toastSuccess.mock.calls[0];
    expect(msg).toContain('Ana Ruiz');
    opts.action.onClick();
    expect(generatePDF).toHaveBeenCalledWith(signed);
  });

  it('si la firma falla no ofrece PDF', async () => {
    signConsent.mockRejectedValue(new Error('red'));
    render(<ConsentPage />);

    fireEvent.click(screen.getByRole('button', { name: /firmar/i }));
    fireEvent.click(await screen.findByText('firma-falsa'));

    await waitFor(() => expect(signConsent).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
