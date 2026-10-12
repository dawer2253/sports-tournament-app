import { EmptyState } from '@tournament/ui';

/** Strona 404 aplikacji: nieznany adres, także nieznana podtrasa turnieju. */
export function NotFoundPage() {
  return (
    <EmptyState
      title="Nie ma takiej strony"
      description="Sprawdź adres albo wróć do zakładek turnieju."
    />
  );
}
