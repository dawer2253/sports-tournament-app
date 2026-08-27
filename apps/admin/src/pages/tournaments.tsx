import { useQuery } from '@tanstack/react-query';
import { AdminShell, TournamentsTable, type AdminNavKey } from '@tournament/ui';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { clearToken } from '../lib/session';

/**
 * Pozycje nawigacji, które mają już swój ekran. Reszta zostaje nieczynna,
 * dopóki nie powstanie odpowiedni widok.
 */
const NAV_ROUTES: Partial<Record<AdminNavKey, string>> = {
  dashboard: '/',
};

export function TournamentsPage() {
  const navigate = useNavigate();

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error) throw new Error(error.message);
      return data.data;
    },
  });

  // Kontrakt stronicuje listę (domyślnie 20 na stronę). Panel pokazuje na
  // razie pierwszą stronę i mówi wprost, ile turniejów jest w sumie.
  const tournaments = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments');
      if (error) throw new Error(error.message);
      return data;
    },
  });

  function handleLogout() {
    clearToken();
    void navigate('/login');
  }

  const rows = tournaments.data?.data ?? [];
  const total = tournaments.data?.meta.total ?? 0;

  return (
    <AdminShell
      active="dashboard"
      title="Twoje turnieje"
      subtitle="Zarządzaj ligami i turniejami"
      // Trzy stany, nie dwa: `/me` w drodze to nie to samo co `/me` po błędzie.
      // Nazwy zastępczej nie podstawiamy — wyglądałaby jak prawdziwe konto.
      user={me.data ?? (me.isPending ? 'pending' : null)}
      navHref={(key) => NAV_ROUTES[key]}
      onNavigate={(key) => {
        const route = NAV_ROUTES[key];
        if (route) void navigate(route);
      }}
      onLogout={handleLogout}
    >
      <TournamentsTable
        status={tournaments.status}
        tournaments={rows}
        total={total}
        errorMessage={tournaments.error?.message}
        onRetry={() => void tournaments.refetch()}
      />
    </AdminShell>
  );
}
