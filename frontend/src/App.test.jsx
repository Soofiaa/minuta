import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    // Sin backend en los tests: el historial falla en silencio y la app sigue.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin backend'))));
  });

  it('muestra el título Minuta y el banner de consentimiento', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Minuta' })).toBeInTheDocument();
    expect(
      screen.getByText(/Usa Minuta solo con grabaciones o transcripciones hechas con aviso/),
    ).toBeInTheDocument();
  });
});
