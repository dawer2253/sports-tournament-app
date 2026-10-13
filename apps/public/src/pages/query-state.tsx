import { Button, EmptyState, Skeleton } from '@tournament/ui';

/**
 * Stan zapytania zakładki, zanim są dane: szkielet albo błąd z ponowieniem.
 * Dane wygrywają z błędem — widok rysuje je, dopóki ma ostatnie wczytane,
 * więc tu trafia wyłącznie zapytanie bez danych.
 */
export function QueryState({
  error,
  label,
  onRetry,
}: {
  error: Error | null;
  /** Nazwa wczytywanej treści, np. „terminarza”. */
  label: string;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <EmptyState
        variant="error"
        title={`Nie udało się wczytać ${label}`}
        description={error.message}
        action={
          <Button variant="outline" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        }
      />
    );
  }
  return <Skeleton role="status" aria-label={`Wczytywanie ${label}`} className="h-64 w-full" />;
}
