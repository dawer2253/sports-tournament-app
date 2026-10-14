import type { RouteObject } from 'react-router';
import { BracketPage } from './pages/bracket';
import { FixturesPage } from './pages/fixtures';
import { MatchPage } from './pages/match';
import { NotFoundPage } from './pages/not-found';
import { OverviewPage } from './pages/overview';
import { ResultsPage } from './pages/results';
import { StandalonePage } from './pages/standalone-page';
import { StandingsPage } from './pages/standings';
import { StatsPage } from './pages/stats';
import { TournamentLayout, type TabHandle } from './pages/tournament-layout';

/**
 * Drzewo tras strony publicznej, osobno od `main.tsx`: testy renderują
 * dokładnie to drzewo w routerze pamięciowym. Trasy po polsku (#192).
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
        .
      </main>
    ),
  },
  {
    // Trasa-rodzic wczytuje turniej raz dla wszystkich zakładek.
    path: '/t/:slug',
    element: <TournamentLayout />,
    children: [
      { index: true, element: <OverviewPage />, handle: { tab: 'home' } satisfies TabHandle },
      { path: 'tabela', element: <StandingsPage />, handle: { tab: 'standings' } satisfies TabHandle },
      { path: 'drabinka', element: <BracketPage />, handle: { tab: 'bracket' } satisfies TabHandle },
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
