import { useQuery } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import { Button, Card, CardContent, EmptyState, Skeleton } from '@tournament/ui';
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { api } from '../lib/api';
import { ApiError, isNotFound } from '../lib/api-error';
import { parseRouteId } from '../lib/route-id';

/**
 * Trasa-rodzic `/tournaments/:id`: wejście z listy przez „Otwórz" (#46)
 * i wspólny grunt wszystkich sekcji turnieju (#85).
 *
 * Turniej wczytuje się tu raz i schodzi do sekcji przez `Outlet`, więc
 * przejście między kartami nie pyta API od nowa, a nieprawidłowe id, 403, 404
 * i błąd obsługuje jedno miejsce zamiast każdej sekcji z osobna. Dopóki
 * turnieju nie ma, sekcja się nie renderuje: shell stoi wtedy bez kontekstu
 * turnieju, bo nie ma czego w nim pokazać.
 */
export function TournamentLayout() {
  const navigate = useNavigate();
  const params = useParams();
  const id = parseRouteId(params.id);

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

  const notFound = id === null || isNotFound(tournament.error);

  let content;
  if (notFound) {
    content = (
      <EmptyState
        title="Nie ma takiego turnieju"
        description="Mógł zostać usunięty albo należy do innego organizatora."
        action={<Button onClick={goToList}>Wróć do listy turniejów</Button>}
      />
    );
  } else if (tournament.data) {
    // Dane przed błędem: nieudane odświeżenie w tle (np. po unieważnieniu
    // `['tournament', id]` przy zmianie drużyn) nie zdejmuje otwartej sekcji
    // razem z oknem, w którym organizer właśnie pracuje. Zostaje ostatni
    // wczytany turniej, a następne odświeżenie spróbuje znowu.
    return <Outlet context={tournament.data} />;
  } else if (tournament.isError) {
    content = (
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
    );
  } else {
    content = (
      <Card aria-busy="true" aria-label="Wczytywanie turnieju">
        <CardContent>
          <Skeleton className="h-5 w-80" />
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminPage active="dashboard" title="Turniej">
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
