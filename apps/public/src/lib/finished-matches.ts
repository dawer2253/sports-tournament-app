/**
 * Czy turniej ma już mecz zakończony, z zapytania o `/results` (same mecze
 * `finished`). Od tego zależy tekst pustej klasyfikacji (#306): przed
 * pierwszym meczem „ruszy”, po nim „jest jeszcze pusta”.
 */
interface ResultsQuery {
  data: readonly unknown[] | undefined;
  error: Error | null;
}

export const hasFinishedMatches = (results: ResultsQuery) => (results.data?.length ?? 0) > 0;

/** Wyniki jeszcze w drodze: bez nich nie wiadomo, który tekst pokazać. Błąd ich nie wstrzymuje. */
export const resultsPending = (results: ResultsQuery) => results.data === undefined && !results.error;
