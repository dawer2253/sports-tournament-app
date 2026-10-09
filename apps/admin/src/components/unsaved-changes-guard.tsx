import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tournament/ui';
import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * Pytanie o niezapisane zmiany przed wyjściem z ekranu formularza.
 *
 * Nawigację wewnątrz panelu (karty sekcji, sidebar, „Wstecz") łapie
 * `useBlocker` i pyta oknem panelu. Zamknięcie i przeładowanie karty łapie
 * `beforeunload`, a tam przeglądarka pokazuje wyłącznie własne okno.
 *
 * `useBlocker` działa tylko pod routerem danych (`createBrowserRouter`,
 * w testach `createMemoryRouter`), więc ekran z tym strażnikiem testuje się
 * na drzewie `routes`, a nie w `MemoryRouter`.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  // Zmiana samego zapytania albo kotwicy nie zdejmuje ekranu, więc nie pyta.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Starsze przeglądarki pytają dopiero po ustawieniu `returnValue`.
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Masz niezapisane zmiany</DialogTitle>
          <DialogDescription>Jeśli wyjdziesz teraz, zmiany w formularzu przepadną.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => blocker.reset?.()}>
            Zostań
          </Button>
          <Button variant="destructive" onClick={() => blocker.proceed?.()}>
            Wyjdź bez zapisywania
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
