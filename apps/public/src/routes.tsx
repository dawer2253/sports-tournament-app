import type { RouteObject } from 'react-router';
import { FixturesPage } from './pages/fixtures';
import { MatchPage } from './pages/match';
import { NotFoundPage } from './pages/not-found';
import { OverviewPage } from './pages/overview';
import { ResultsPage } from './pages/results';
import { StandalonePage } from './pages/standalone-page';
import { StandingsPage } from './pages/standings';
import { StatsPage } from './pages/stats';
import { TournamentLayout, type TabHandle } from './pages/tournament-layout';
import { ProtoBracketPage, ProtoFixtures, ProtoMatchPage, ProtoOverview, ProtoResults, ProtoStats } from './prototype/pages';

/**
 * Drzewo tras strony publicznej, osobno od `main.tsx`: testy renderują
 * dokładnie to drzewo w routerze pamięciowym. Trasy po polsku (#192).
 * Drabinka (S4) dołoży tu swoje.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <main className="p-8 text-muted-foreground">
        Turniej otwiera się pod adresem <code>/t/{'{slug}'}</code>, na przykład{' '}
        <a className="underline" href="/t/liga-osiedlowa-2026">
          /t/liga-osiedlowa-2026
        </a>
        . PROTOTYP drabinki (#218):{' '}
        <a className="underline" href="/t/puchar-demo/drabinka?variant=A">
          /t/puchar-demo/drabinka
        </a>
        .
      </main>
    ),
  },
  // PROTOTYP (#218): puchar na danych w pamięci. Statyczny segment wygrywa
  // z `:slug`, więc prawdziwe trasy turnieju zostają bez zmian.
  { path: '/t/puchar-demo', element: <ProtoOverview /> },
  { path: '/t/puchar-demo/drabinka', element: <ProtoBracketPage /> },
  { path: '/t/puchar-demo/terminarz', element: <ProtoFixtures /> },
  { path: '/t/puchar-demo/wyniki', element: <ProtoResults /> },
  { path: '/t/puchar-demo/statystyki', element: <ProtoStats /> },
  { path: '/t/puchar-demo/mecze/:matchId', element: <ProtoMatchPage /> },
  {
    // Trasa-rodzic wczytuje turniej raz dla wszystkich zakładek.
    path: '/t/:slug',
    element: <TournamentLayout />,
    children: [
      { index: true, element: <OverviewPage />, handle: { tab: 'home' } satisfies TabHandle },
      { path: 'tabela', element: <StandingsPage />, handle: { tab: 'standings' } satisfies TabHandle },
      { path: 'terminarz', element: <FixturesPage />, handle: { tab: 'fixtures' } satisfies TabHandle },
      { path: 'wyniki', element: <ResultsPage />, handle: { tab: 'results' } satisfies TabHandle },
      { path: 'statystyki', element: <StatsPage />, handle: { tab: 'stats' } satisfies TabHandle },
      // Strona meczu (#210) nie jest zakładką: shell niczego nie podświetla.
      { path: 'mecze/:matchId', element: <MatchPage /> },
      // Nieznana podtrasa: 404 aplikacji pod nagłówkiem turnieju, bez aktywnej zakładki.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '*',
    element: (
      <StandalonePage>
        <NotFoundPage />
      </StandalonePage>
    ),
  },
];
