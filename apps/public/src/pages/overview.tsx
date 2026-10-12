import {
  Button,
  LiveMatchTile,
  MatchRow,
  PublicSection,
  StandingsSnippet,
  latestRoundMatches,
  nextRoundMatches,
} from '@tournament/ui';
import { CalendarClock, ChevronRight, History, ListOrdered, Radio } from 'lucide-react';
import { Link } from 'react-router';
import { useFixtures, useResults, useStandings } from '../lib/queries';
import { QueryState } from './query-state';
import { tabHref, useTournament } from './tournament-layout';

function SectionLink({ to, children }: { to: string; children: string }) {
  return (
    <Button asChild variant="link" size="sm" className="px-0">
      <Link to={to}>
        {children}
        <ChevronRight />
      </Link>
    </Button>
  );
}

/**
 * Przegląd (#206), od góry: Na żywo, Najbliższe mecze, Ostatnie wyniki,
 * Tabela (skrót). Sekcja bez meczów znika. Turniej `finished` niczego nie
 * dokłada — kafel „Zwycięzca” jest w future work.
 *
 * Trzy zapytania stoją niezależnie: sekcje z jednego źródła pokazują się,
 * gdy ono dotrze, a jego błąd nie zdejmuje pozostałych.
 */
export function OverviewPage() {
  const { slug } = useTournament();
  const fixtures = useFixtures(slug);
  const results = useResults(slug);
  const standings = useStandings(slug);

  const live = fixtures.data?.filter((match) => match.status === 'live') ?? [];
  const upcoming = fixtures.data ? nextRoundMatches(fixtures.data) : [];
  const latest = results.data ? latestRoundMatches(results.data) : [];
  const table = standings.data?.[0];

  const fixturesHref = tabHref(slug, 'fixtures');

  return (
    <div className="grid gap-6">
      {!fixtures.data && <QueryState error={fixtures.error} label="meczów" onRetry={() => void fixtures.refetch()} />}
      {live.length > 0 && (
        <PublicSection title="Na żywo" icon={<Radio />}>
          {live.map((match) => (
            <LiveMatchTile
              key={match.id}
              match={match}
              action={
                <Button asChild size="sm" className="w-full">
                  <Link to={fixturesHref}>
                    <Radio className="size-4" />
                    Śledź na żywo
                  </Link>
                </Button>
              }
            />
          ))}
        </PublicSection>
      )}
      {upcoming.length > 0 && (
        <PublicSection
          title="Najbliższe mecze"
          icon={<CalendarClock />}
          action={<SectionLink to={fixturesHref}>Cały terminarz</SectionLink>}
        >
          {upcoming.map((match) => (
            <MatchRow key={match.id} match={match} statusDisplay="live" />
          ))}
        </PublicSection>
      )}
      {latest.length > 0 && (
        <PublicSection
          title="Ostatnie wyniki"
          icon={<History />}
          action={<SectionLink to={tabHref(slug, 'results')}>Wszystkie wyniki</SectionLink>}
        >
          {latest.map((match) => (
            <MatchRow key={match.id} match={match} statusDisplay="live" />
          ))}
        </PublicSection>
      )}
      {!results.data && results.error && (
        <QueryState error={results.error} label="wyników" onRetry={() => void results.refetch()} />
      )}
      {table ? (
        <PublicSection
          title="Tabela (skrót)"
          icon={<ListOrdered />}
          action={<SectionLink to={tabHref(slug, 'standings')}>Zobacz pełną tabelę</SectionLink>}
        >
          <StandingsSnippet rows={table.rows} />
        </PublicSection>
      ) : (
        !standings.data && <QueryState error={standings.error} label="tabeli" onRetry={() => void standings.refetch()} />
      )}
    </div>
  );
}
