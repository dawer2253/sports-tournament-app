import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';
import { TournamentPage } from './pages/tournament';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const router = createBrowserRouter([
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
  { path: '/t/:slug', element: <TournamentPage /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
