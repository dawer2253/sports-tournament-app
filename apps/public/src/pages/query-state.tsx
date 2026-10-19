import { LoadError, LoadingScreen } from '@tournament/ui/public';

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
  /** Nazwa wczytywanej treści w dopełniaczu, np. „terminarza”. */
  label: string;
  onRetry: () => void;
}) {
  if (error) return <LoadError label={label} message={error.message} onRetry={onRetry} />;
  return <LoadingScreen label={label} />;
}
