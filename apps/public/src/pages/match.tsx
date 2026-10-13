import { BackLink, EmptyState, MatchRelation } from '@tournament/ui';
import { MatchHeader } from '@tournament/ui/components/data/match-header.tsx';
import { useNavigate, useParams } from 'react-router';
import { usePublicMatch } from '../lib/queries';
import { QueryState } from './query-state';
import { tabHref, useTournament } from './tournament-layout';

/**
 * Strona meczu (#210): powrót, pas i relacja, w tej kolejności także na
 * telefonie. Powrót idzie według stanu meczu — „Terminarz” przed meczem,
 * „Wyniki” w trakcie i po nim — a nie historią przeglądarki, bo kibic
 * z zewnętrznego linku nie ma dokąd wrócić. Odpytuje jak pozostałe trasy.
 */
export function MatchPage() {
  const { slug, sport, branding } = useTournament();
  const { matchId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(matchId);
  const match = usePublicMatch(slug, id);

  // Adres z nie-liczbą nie trafi w żaden mecz: 404 od razu, nie po odpowiedzi
  // API (zapytanie i tak idzie, bo hooka nie da się wołać warunkowo).
  if (!Number.isInteger(id) || id < 1 || match.data === null) {
    return (
      <EmptyState
        title="Nie ma takiego meczu"
        description="Sprawdź adres. Mecz mógł zostać usunięty albo należy do innego turnieju."
      />
    );
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
      <MatchHeader match={match.data} sport={sport.code} brandColor={branding.primaryColor} />
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
