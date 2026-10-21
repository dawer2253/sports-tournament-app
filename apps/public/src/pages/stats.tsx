import { LoadError, NoStats, StatsLoading, StatsScreen, type StatBoard } from '@tournament/ui/public';
import { useSearchParams } from 'react-router';
import { useLeaderboards, useResults } from '../lib/queries';
import { loadErrorMessage } from '../lib/api-error';
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
  // Pusta klasyfikacja przy zakończonych meczach ma inny tekst niż przed
  // pierwszym meczem (#306); `/results` to te same dane co zakładka Wyniki.
  const results = useResults(slug);
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
      return <LoadError title="Statystyki" label="klasyfikacji" message={loadErrorMessage(main.error)} onRetry={() => void main.refetch()} />;
    }
    return <StatsLoading />;
  }
  // Pusta klasyfikacja czeka na wyniki, żeby nie mignąć tekstem „ruszy po pierwszym meczu”;
  // ich błąd zostawia ten tekst zamiast zasłaniać ekran.
  if (main.data.rows.length === 0 && results.data === undefined && !results.error) return <StatsLoading />;

  const boards = Object.fromEntries(
    stats.map((stat, position): [string, StatBoard] => {
      const query = leaderboards[position]!;
      if (query.data) return [stat.code, { status: 'ready', leaderboard: query.data }];
      if (query.error) {
        return [stat.code, { status: 'error', message: loadErrorMessage(query.error), onRetry: () => void query.refetch() }];
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
      hasFinishedMatches={(results.data?.length ?? 0) > 0}
    />
  );
}
