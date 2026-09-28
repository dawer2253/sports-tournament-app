import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';
import { LoginPage } from './pages/login';
import { TournamentCreatePage } from './pages/tournament-create';
import { TournamentsPage } from './pages/tournaments';
import { getToken } from './lib/session';
import { SectionPage, TournamentIndex, TournamentLayout } from './prototype/pages';
import { PrototypeSwitcher } from './prototype/switcher';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// PROTOTYP (#85): korzeń z pływającym przełącznikiem wariantów nad każdą trasą.
function PrototypeRoot() {
  return (
    <>
      <Outlet />
      <PrototypeSwitcher />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <PrototypeRoot />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <TournamentsPage />
          </RequireAuth>
        ),
      },
      {
        path: '/tournaments/new',
        element: (
          <RequireAuth>
            <TournamentCreatePage />
          </RequireAuth>
        ),
      },
      // PROTOTYP (#85): trasy sekcji zagnieżdżone pod turniejem.
      {
        path: '/tournaments/:id',
        element: (
          <RequireAuth>
            <TournamentLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <TournamentIndex /> },
          { path: 'teams', element: <SectionPage section="teams" /> },
          { path: 'venues', element: <SectionPage section="venues" /> },
          { path: 'settings', element: <SectionPage section="settings" /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
