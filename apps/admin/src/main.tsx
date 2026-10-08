import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@tournament/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';
import { LoginPage } from './pages/login';
import { TournamentPage } from './pages/tournament';
import { TournamentCreatePage } from './pages/tournament-create';
import { TournamentsPage } from './pages/tournaments';
import { getToken } from './lib/session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

const router = createBrowserRouter([
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
  {
    path: '/tournaments/:id',
    element: (
      <RequireAuth>
        <TournamentPage />
      </RequireAuth>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Jeden na cały panel, poza routerem: toast po zapisie przeżywa zamknięcie
          okna i przejście na inną trasę (usunięcie drużyny wraca na listę). */}
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
