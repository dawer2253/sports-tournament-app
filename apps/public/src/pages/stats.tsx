import { EmptyState, Heading, LeaderboardTable, StatSwitcher } from '@tournament/ui';
import { Trophy } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useLeaderboard } from '../lib/queries';
import { QueryState } from './query-state';
import { useTournament } from './tournament-layout';

/**
 * Statystyki (#207): przełącznik z `PublicTournament.stats` i klasyfikacja
 * wybranej statystyki. Wybór siedzi w adresie (`?stat=yellowCards`), więc
 * link do „kartek” da się wysłać.
 *
 * Kod spoza statystyk turnieju (stary link, inny sport) traktujemy jak brak
 * parametru i nie wysyłamy go do API, które odpowiedziałoby `422`. Bez
 * parametru zapytanie też idzie bez niego: domyślną statystykę wybiera
 * serwer, ta sama co pierwsza w `stats`.
 */
export function StatsPage() {
  const { slug, stats } = useTournament();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('stat');
  const stat = stats.some((option) => option.code === requested) ? (requested ?? undefined) : undefined;
  const leaderboard = useLeaderboard(slug, stat);
  const selected = stat ?? stats[0]?.code;

  if (!selected) {
    return <EmptyState icon={<Trophy />} title="Ten turniej nie ma statystyk" />;
  }

  return (
    <StatSwitcher
      stats={stats}
      value={selected}
      // Pierwsza statystyka to domyślna: adres zostaje bez parametru,
      // żeby jedna klasyfikacja nie miała dwóch adresów.
      onValueChange={(code) => setSearchParams(code === stats[0]?.code ? {} : { stat: code })}
    >
      {leaderboard.data ? (
        <section className="space-y-3">
          <Heading level="section">{leaderboard.data.label}</Heading>
          <LeaderboardTable leaderboard={leaderboard.data} />
          {leaderboard.data.rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Klasyfikacja obejmuje mecze zakończone ze wszystkich faz turnieju. Zawodnicy z równą wartością dzielą
              miejsce.
            </p>
          )}
        </section>
      ) : (
        <QueryState error={leaderboard.error} label="klasyfikacji" onRetry={() => void leaderboard.refetch()} />
      )}
    </StatSwitcher>
  );
}
