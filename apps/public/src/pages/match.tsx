import { LoadError, MatchLoading, MatchNotFound, MatchScreen } from '@tournament/ui/public';
import { useNavigate, useParams } from 'react-router';
import { usePublicMatch } from '../lib/queries';
import { loadErrorMessage } from '../lib/api-error';
import { tabHref, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';

/**
 * Strona meczu (#210, wygląd #295): pobiera mecz i wybiera stan — wczytywanie,
 * błąd, brak meczu — a resztę (powrót według stanu meczu, tablica, relacja)
 * rysuje `MatchScreen`. Odpytuje jak pozostałe trasy.
 */
export function MatchPage() {
  const { slug } = useTournament();
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(matchId);
  const match = usePublicMatch(slug, id);
  // Etykieta pozycji w pucharze wynika z krawędzi (ADR-0004), więc tablica
  // potrzebuje kompletu meczów fazy: „Mecz o 3. miejsce”, a nie „Finał” (#234).
  const bracket = useBracket();

  // Adres z nie-liczbą nie trafi w żaden mecz: 404 od razu, nie po odpowiedzi
  // API (zapytanie i tak idzie, bo hooka nie da się wołać warunkowo).
  if (!Number.isInteger(id) || id < 1 || match.data === null) {
    const fixtures = tabHref(slug, 'fixtures');
    return <MatchNotFound fixturesHref={fixtures} onNavigate={() => void navigate(fixtures)} />;
  }

  if (!match.data) {
    if (match.error) return <LoadError label="meczu" message={loadErrorMessage(match.error)} onRetry={() => void match.refetch()} />;
    return <MatchLoading />;
  }

  return (
    <MatchScreen
      match={bracket.withBracket(match.data)}
      backHref={(tab) => tabHref(slug, tab)}
      onNavigate={(tab) => void navigate(tabHref(slug, tab))}
    />
  );
}
