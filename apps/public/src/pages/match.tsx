import { BackLink, MatchRelation } from '@tournament/ui';
import { MatchHeader } from '@tournament/ui/components/data/match-header.tsx';
import { MatchNotFound } from '@tournament/ui/public';
import { useNavigate, useParams } from 'react-router';
import { usePublicMatch } from '../lib/queries';
import { QueryState } from './query-state';
import { tabHref, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';

/**
 * Strona meczu (#210): powrót, pas i relacja, w tej kolejności także na
 * telefonie. Powrót idzie według stanu meczu — „Terminarz” przed meczem,
 * „Wyniki” w trakcie i po nim — a nie historią przeglądarki, bo kibic
 * z zewnętrznego linku nie ma dokąd wrócić. W pucharze pas podpisuje mecz
 * etykietą pozycji i pokazuje karne (#234). Odpytuje jak pozostałe trasy.
 */
export function MatchPage() {
  const { slug, sport, branding } = useTournament();
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(matchId);
  const match = usePublicMatch(slug, id);
  // Etykieta pozycji w pucharze wynika z krawędzi (ADR-0004), więc pas
  // potrzebuje kompletu meczów fazy: „Mecz o 3. miejsce”, a nie „Finał” (#234).
  const bracket = useBracket();

  // Adres z nie-liczbą nie trafi w żaden mecz: 404 od razu, nie po odpowiedzi
  // API (zapytanie i tak idzie, bo hooka nie da się wołać warunkowo).
  if (!Number.isInteger(id) || id < 1 || match.data === null) {
    const fixtures = tabHref(slug, 'fixtures');
    return <MatchNotFound fixturesHref={fixtures} onNavigate={() => void navigate(fixtures)} />;
  }

  if (!match.data) {
    return <QueryState error={match.error} label="meczu" onRetry={() => void match.refetch()} />;
  }

  const back = match.data.status === 'scheduled' ? 'fixtures' : 'results';

  return (
    <div className="flex flex-col gap-3">
      <BackLink href={tabHref(slug, back)} onNavigate={() => void navigate(tabHref(slug, back))}>
        {back === 'fixtures' ? 'Terminarz' : 'Wyniki'}
      </BackLink>
      <MatchHeader
        match={bracket.withBracket(match.data)}
        sport={sport.code}
        brandColor={branding.primaryColor}
      />
      <MatchRelation
        status={match.data.status}
        homeTeamId={match.data.homeTeam?.id ?? null}
        events={match.data.events}
        periods={match.data.periods}
        className="mx-auto mt-2 w-full max-w-3xl"
      />
    </div>
  );
}
