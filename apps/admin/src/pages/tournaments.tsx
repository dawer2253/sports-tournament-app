import { useMutation, useQuery } from '@tanstack/react-query';
import { AdminShell, TournamentsTable, type AdminNavKey } from '@tournament/ui';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { endSession } from '../lib/session';

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

  /**
   * Wylogowanie unieważnia token po stronie API, a nie tylko zapomina go
   * lokalnie: `POST /logout` kasuje w Sanctumie dokładnie ten token, którym
   * poszło żądanie. Bez tego „Wyloguj" zostawia ważne poświadczenie w rękach
   * każdego, kto je przechwycił.
   *
   * Żądanie musi wyjść, *zanim* zniknie token, bo inaczej idzie bez nagłówka
   * `Authorization` i nie unieważnia niczego. Sesję zamyka `endSession()`
   * z `onSettled`, czyli niezależnie od wyniku: padnięta sieć ani 500 nie mogą
   * zatrzymać organizera w panelu.
   */
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST('/logout');
      if (error) throw new Error(error.message);
    },
    onSettled: endSession,
  });

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
      // Drugi klik przed odpowiedzią wysłałby drugie `/logout`, a to już na
      // unieważnionym tokenie — czyli 401 i przekierowanie w poprzek pierwszego.
      onLogout={() => {
        if (!logout.isPending) logout.mutate();
      }}
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
