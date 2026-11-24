import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentViewer, DEFAULT_ADULT_TEXT, DEFAULT_MINOR_TEXT } from './ConsentViewer';

const empty = { version: 1, updatedDate: '2026-11-01', text: '', minorText: '' };

const save = () => screen.getByRole('button', { name: /guardar nueva versión/i });

describe('ConsentViewer — edición', () => {
  it('sin textos propone el borrador por defecto y permite guardarlo', () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<ConsentViewer config={empty} onUpdateVersion={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));

    expect(screen.getByRole('textbox')).toHaveValue(DEFAULT_ADULT_TEXT);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(save());
    expect(onUpdate).toHaveBeenCalledWith(DEFAULT_ADULT_TEXT, DEFAULT_MINOR_TEXT);
  });

  it('no reemplaza un texto que el gimnasio ya escribió', () => {
    render(<ConsentViewer config={{ ...empty, text: 'propio', minorText: 'menor' }} onUpdateVersion={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByRole('textbox')).toHaveValue('propio');
  });

  it('@adversarial con un texto vacío avisa y no guarda', () => {
    const onUpdate = vi.fn();
    render(<ConsentViewer config={empty} onUpdateVersion={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    expect(screen.getByRole('alert')).toHaveTextContent('adultos y menores');
    expect(save()).toBeDisabled();
    fireEvent.click(save());
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
