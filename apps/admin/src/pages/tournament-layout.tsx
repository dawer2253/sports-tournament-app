import { useQuery } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import { Button, Card, CardContent, EmptyState, Skeleton } from '@tournament/ui';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { api } from '../lib/api';
import { ApiError, isNotFound } from '../lib/api-error';
import { parseRouteId } from '../lib/route-id';
import { sectionFromPath } from '../lib/section-route';

/**
 * Trasa-rodzic `/tournaments/:id`: wejście z listy przez „Otwórz" (#46)
 * i wspólny grunt wszystkich sekcji turnieju (#85).
 *
 * Turniej wczytuje się tu raz i schodzi do sekcji przez `Outlet`, więc
 * przejście między kartami nie pyta API od nowa, a nieprawidłowe id, 403, 404
 * i błąd obsługuje jedno miejsce zamiast każdej sekcji z osobna.
 *
 * Dopóki turnieju nie ma, shell **nie** wychodzi z turnieju: zna `id` z adresu,
 * więc trzyma karty sekcji i nie podświetla „Turnieje" — inaczej przełączenie
 * A → B migałoby shellem dashboardu (#262). Nazwę, status i sport dokłada
 * `AdminPage` z listy bieżących z sidebaru, a gdy i jej nie ma — szkieletem.
 */
export function TournamentLayout() {
  const navigate = useNavigate();
  const params = useParams();
  const { pathname } = useLocation();
  const id = parseRouteId(params.id);
  const section = sectionFromPath(pathname);

  const tournament = useQuery({
    queryKey: ['tournament', id],
    enabled: id !== null,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}', {
        params: { path: { tournament: id! } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });

  function goToList() {
    void navigate('/');
  }

  if (id === null || isNotFound(tournament.error)) {
    // Wspólny stan dla 403 i 404, bez przepuszczania komunikatu z API.
    return (
      <AdminPage active="dashboard" title="Turniej">
        <EmptyState
          title="Nie ma takiego turnieju"
          description="Mógł zostać usunięty albo należy do innego organizatora."
          action={<Button onClick={goToList}>Wróć do listy turniejów</Button>}
        />
      </AdminPage>
    );
  }

  if (tournament.data) {
    // Dane przed błędem: nieudane odświeżenie w tle (np. po unieważnieniu
    // `['tournament', id]` przy zmianie drużyn) nie zdejmuje otwartej sekcji
    // razem z oknem, w którym organizer właśnie pracuje. Zostaje ostatni
    // wczytany turniej, a następne odświeżenie spróbuje znowu.
    return <Outlet context={tournament.data} />;
  }

  const content = tournament.isError ? (
    <EmptyState
      variant="error"
      title="Nie udało się wczytać turnieju"
      description={tournament.error.message}
      action={
        <Button variant="outline" onClick={() => void tournament.refetch()}>
          Spróbuj ponownie
        </Button>
      }
    />
  ) : (
    <Card aria-busy="true" aria-label="Wczytywanie turnieju">
      <CardContent>
        <Skeleton className="h-5 w-80" />
      </CardContent>
    </Card>
  );

  return (
    <AdminPage tournamentId={id} section={section}>
      {content}
    </AdminPage>
  );
}

/** Turniej wczytany przez `TournamentLayout`, dla ekranów sekcji. */
export function useTournament(): Tournament {
  const tournament = useOutletContext<Tournament | undefined>();
  // Bez tego ekran wpięty poza trasą `/tournaments/:id` dostałby `undefined`
  // otypowane jako turniej i wywróciłby się dopiero na pierwszym polu.
  if (!tournament) {
    throw new Error('useTournament() działa tylko w sekcji pod TournamentLayout.');
  }
  return tournament;
}
