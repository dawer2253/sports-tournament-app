import { describe, expect, it, vi } from 'vitest';
import { applyApiError } from './form-errors';

const FIELDS = ['name', 'sportId', 'format'] as const;

describe('applyApiError', () => {
  it('sadza błąd 422 przy polu, którego dotyczy', () => {
    const setError = vi.fn();

    applyApiError(
      { message: 'Podane dane są nieprawidłowe.', errors: { name: ['Pole nazwa jest wymagane.'] } },
      FIELDS,
      setError,
    );

    expect(setError).toHaveBeenCalledExactlyOnceWith('name', {
      message: 'Pole nazwa jest wymagane.',
    });
  });

  it('bierze pierwszy komunikat, gdy API przysłało ich kilka dla jednego pola', () => {
    const setError = vi.fn();

    applyApiError(
      { message: 'Podane dane są nieprawidłowe.', errors: { name: ['Pierwszy.', 'Drugi.'] } },
      FIELDS,
      setError,
    );

    expect(setError).toHaveBeenCalledWith('name', { message: 'Pierwszy.' });
  });

  it('rozsadza błędy wielu pól naraz', () => {
    const setError = vi.fn();

    applyApiError(
      {
        message: 'Podane dane są nieprawidłowe.',
        errors: { name: ['Nazwa zajęta.'], sportId: ['Nie ma takiego sportu.'] },
      },
      FIELDS,
      setError,
    );

    expect(setError).toHaveBeenCalledWith('name', { message: 'Nazwa zajęta.' });
    expect(setError).toHaveBeenCalledWith('sportId', { message: 'Nie ma takiego sportu.' });
  });

  it('przy mieszanym 422 nie gubi pola, którego formularz nie zna', () => {
    const setError = vi.fn();

    applyApiError(
      {
        message: 'Podane dane są nieprawidłowe.',
        errors: { name: ['Nazwa zajęta.'], startDate: ['Data jest wymagana.'] },
      },
      FIELDS,
      setError,
    );

    expect(setError).toHaveBeenCalledWith('name', { message: 'Nazwa zajęta.' });
    // Błąd przy polu, którego formularz nie zna, i tak musi być widoczny —
    // inaczej organizer poprawia nazwę i dostaje to samo 422 bez wyjaśnienia.
    expect(setError).toHaveBeenCalledWith('root', { message: 'Data jest wymagana.' });
  });

  it('wrzuca do `root` błąd pola, którego formularz nie zna — komunikat nie może przepaść', () => {
    const setError = vi.fn();

    applyApiError(
      { message: 'Podane dane są nieprawidłowe.', errors: { startDate: ['Data jest wymagana.'] } },
      FIELDS,
      setError,
    );

    expect(setError).toHaveBeenCalledExactlyOnceWith('root', { message: 'Data jest wymagana.' });
  });

  it('zwykły błąd z samym `message` idzie do `root`', () => {
    const setError = vi.fn();

    applyApiError({ message: 'Nie udało się połączyć z serwerem.' }, FIELDS, setError);

    expect(setError).toHaveBeenCalledExactlyOnceWith('root', {
      message: 'Nie udało się połączyć z serwerem.',
    });
  });

  it('podstawia własny komunikat po polsku, gdy API nie przysłało żadnego', () => {
    const setError = vi.fn();

    applyApiError(undefined, FIELDS, setError);

    expect(setError).toHaveBeenCalledExactlyOnceWith('root', {
      message: 'Nie udało się założyć turnieju. Spróbuj ponownie.',
    });
  });

  it('nie zostawia formularza bez komunikatu, gdy 422 przyszło z pustą mapą pól', () => {
    const setError = vi.fn();

    applyApiError({ message: 'Podane dane są nieprawidłowe.', errors: {} }, FIELDS, setError);

    expect(setError).toHaveBeenCalledExactlyOnceWith('root', {
      message: 'Podane dane są nieprawidłowe.',
    });
  });
});
