import { useQuery } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import { Button, Card, CardContent, EmptyState, Skeleton } from '@tournament/ui';
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { api } from '../lib/api';

/** Błąd API razem z kodem HTTP: 403 i 404 znaczą co innego niż padnięty serwer. */
class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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
  // Adres z paska przeglądarki, więc może być czymkolwiek. Id, które nie jest
  // dodatnią liczbą całkowitą, nie idzie do API, tylko od razu kończy się
  // stanem „nie ma" — takiego turnieju i tak nie ma w bazie. Sprawdzamy zapis,
  // a nie samą wartość po `Number()`, bo ten przyjmuje też `1e3` czy `0x10`
  // i zapytałby API o zupełnie inny turniej niż ten z adresu.
  const id = Number(params.id);
  const validId = /^[1-9]\d*$/.test(params.id ?? '') && Number.isSafeInteger(id);

  const tournament = useQuery({
    queryKey: ['tournament', id],
    enabled: validId,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}', {
        params: { path: { tournament: id } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });

  function goToList() {
    void navigate('/');
  }

  // 403 to cudzy turniej: organizer nie dowie się z panelu, czy taki istnieje,
  // więc oba przypadki wyglądają tak samo. Ponawianie niczego tu nie zmieni.
  const httpStatus = tournament.error instanceof ApiError ? tournament.error.status : null;
  const notFound = !validId || httpStatus === 403 || httpStatus === 404;

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
