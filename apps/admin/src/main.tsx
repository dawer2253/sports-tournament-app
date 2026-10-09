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

const router = createBrowserRouter(routes);

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
