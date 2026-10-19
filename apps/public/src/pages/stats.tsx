import { LoadError, NoStats, StatsLoading, StatsScreen, type StatBoard } from '@tournament/ui/public';
import { useSearchParams } from 'react-router';
import { useLeaderboards } from '../lib/queries';
import { tabHref, useTournament } from './tournament-layout';

/**
 * Statystyki (#207, #294): zakładki z `PublicTournament.stats`, klasyfikacja
 * wybranej statystyki i boczna kolumna z liderami pozostałych. Wybór siedzi
 * w adresie (`?stat=yellowCards`), więc link do „kartek” da się wysłać.
 *
 * Kod spoza statystyk turnieju (stary link, inny sport) traktujemy jak brak
 * parametru i nie wysyłamy go do API, które odpowiedziałoby `422`. Każda
 * statystyka ma stale jedno zapytanie (pierwsza bez parametru: domyślną
 * wybiera serwer), a główna klasyfikacja i boczna kolumna biorą z nich, więc
 * zmiana zakładki nie wysyła żądania.
 */
export function StatsPage() {
  const { slug, stats } = useTournament();
  const [searchParams, setSearchParams] = useSearchParams();
  const leaderboards = useLeaderboards(
    slug,
    stats.map((stat) => stat.code),
  );
  const requested = searchParams.get('stat');
  const index = Math.max(
    0,
    stats.findIndex((stat) => stat.code === requested),
  );
  const selected = stats[index];

  if (!selected) return <NoStats />;

  const first = stats[0]!.code;
  const statHref = (code: string) => (code === first ? tabHref(slug, 'stats') : `${tabHref(slug, 'stats')}?stat=${code}`);
  // Pierwsza statystyka to domyślna: adres zostaje bez parametru, żeby jedna
  // klasyfikacja nie miała dwóch adresów.
  const select = (code: string) => setSearchParams(code === first ? {} : { stat: code });

  const main = leaderboards[index]!;
  if (!main.data) {
    if (main.error) {
      return <LoadError title="Statystyki" label="klasyfikacji" message={main.error.message} onRetry={() => void main.refetch()} />;
    }
    return <StatsLoading />;
  }

  const boards = Object.fromEntries(
    stats.map((stat, position): [string, StatBoard] => {
      const query = leaderboards[position]!;
      if (query.data) return [stat.code, { status: 'ready', leaderboard: query.data }];
      if (query.error) {
        return [stat.code, { status: 'error', message: query.error.message, onRetry: () => void query.refetch() }];
      }
      return [stat.code, { status: 'loading' }];
    }),
  );

  return (
    <StatsScreen
      stats={stats}
      value={selected.code}
      leaderboard={main.data}
      boards={boards}
      statHref={statHref}
      onValueChange={select}
    />
  );
}
