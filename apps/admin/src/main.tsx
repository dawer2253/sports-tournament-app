import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@tournament/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';
import { routes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// PROTOTYP (#277): panel budowany z `--base=/admin/` stoi pod prefiksem,
// więc router musi znać ten prefiks. Bez tego trasy `/login` i `/tournaments`
// działają tylko w korzeniu origin, a `BASE_URL` z Vite to `/` w dev.
const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Jeden na cały panel, poza routerem: toast po zapisie przeżywa zamknięcie
          okna i przejście na inną trasę (po usunięciu drużyny panel wraca na listę). */}
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
