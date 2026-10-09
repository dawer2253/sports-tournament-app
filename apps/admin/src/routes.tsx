import { Navigate, type RouteObject } from 'react-router';
import { getToken } from './lib/session';
import { LoginPage } from './pages/login';
import { TeamPage } from './pages/team';
import { TeamsPage } from './pages/teams';
import { TournamentCreatePage } from './pages/tournament-create';
import { TournamentLayout } from './pages/tournament-layout';
import { TournamentSectionPlaceholder } from './pages/tournament-section-placeholder';
import { TournamentSettingsPage } from './pages/tournament-settings';
import { TournamentsPage } from './pages/tournaments';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

/**
 * Drzewo tras panelu, osobno od `main.tsx`: testy renderują dokładnie to
 * drzewo w routerze pamięciowym, więc przekierowania i zagnieżdżenia
 * sprawdzają się na tym samym kodzie, który chodzi w przeglądarce.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <TournamentsPage />
      </RequireAuth>
    ),
  },
  // `new` stoi przed `:id`, żeby kolejność czytała się tak samo jak dopasowanie:
  // router i tak stawia segment stały nad dynamicznym, ale czytelnik nie musi
  // tego wiedzieć, żeby zobaczyć, że kreator nie wpada pod ekran turnieju.
  {
    path: '/tournaments/new',
    element: (
      <RequireAuth>
        <TournamentCreatePage />
      </RequireAuth>
    ),
  },
  // Trasa-rodzic wczytuje turniej raz dla wszystkich sekcji (#85). Po id, nie
  // po slugu, bo slug organizer może zmienić w ustawieniach. Terminarz,
  // Drabinka i Statystyki dostaną trasy razem ze swoimi ekranami.
  {
    path: '/tournaments/:id',
    element: (
      <RequireAuth>
        <TournamentLayout />
      </RequireAuth>
    ),
    children: [
      // Po założeniu turnieju pierwszą rzeczą jest dodanie drużyn, a osobny
      // „przegląd" bez meczów byłby pusty.
      { index: true, element: <Navigate to="teams" replace /> },
      { path: 'teams', element: <TeamsPage /> },
      // Skład jest dzieckiem turnieju, a nie listy: lista nie ma `Outlet`, a skład
      // zastępuje ją w całości, z tą samą aktywną kartą „Drużyny” (#89 pkt 3).
      { path: 'teams/:teamId', element: <TeamPage /> },
      { path: 'venues', element: <TournamentSectionPlaceholder section="venues" /> },
      { path: 'settings', element: <TournamentSettingsPage /> },
    ],
  },
];
