import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';
import { ProtoFixtures, ProtoHome, ProtoMatchPage, ProtoResults, ProtoStandings } from './prototype/pages';

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
        . Prototyp strony meczu (#205):{' '}
        <a className="underline" href="/t/liga-osiedlowa-2026/mecze/1">
          /t/liga-osiedlowa-2026/mecze/1
        </a>
        .
      </main>
    ),
  },
  // PROTOTYP (#205): trasy turnieju na danych demo, żeby sprawdzić wejście na
  // stronę meczu i powrót. Prawdziwy Przegląd (`TournamentPage`) wraca w #206.
  { path: '/t/:slug', element: <ProtoHome /> },
  { path: '/t/:slug/tabela', element: <ProtoStandings /> },
  { path: '/t/:slug/terminarz', element: <ProtoFixtures /> },
  { path: '/t/:slug/wyniki', element: <ProtoResults /> },
  { path: '/t/:slug/mecze/:matchId', element: <ProtoMatchPage /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
