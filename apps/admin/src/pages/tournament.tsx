import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  MetaList,
  Skeleton,
  TournamentStatusBadge,
} from '@tournament/ui';
import { useNavigate, useParams } from 'react-router';
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
 * Ekran turnieju: wejście z listy przez „Otwórz" (#46).
 *
 * Na razie sam nagłówek z tym, co mówi `GET /tournaments/{id}`. Sekcje turnieju
 * (terminarz, drużyny, tabela) dochodzą tu jako kolejne kawałki — terminarz
 * w design systemie jest jeszcze statycznym demo, bez danych z API.
 */
export function TournamentPage() {
  const navigate = useNavigate();
  const params = useParams();
  // Adres z paska przeglądarki, więc może być czymkolwiek. Id, które nie jest
  // dodatnią liczbą całkowitą, nie idzie do API, tylko od razu kończy się
  // stanem „nie ma" — takiego turnieju i tak nie ma w bazie.
  const id = Number(params.id);
  const validId = Number.isSafeInteger(id) && id > 0;

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
  } else if (tournament.isPending) {
    content = (
      <Card aria-busy="true" aria-label="Wczytywanie turnieju">
        <CardContent>
          <Skeleton className="h-5 w-80" />
        </CardContent>
      </Card>
    );
  } else {
    const t = tournament.data;
    content = (
      <Card>
        <CardContent>
          <MetaList className="text-sm text-muted-foreground">
            <TournamentStatusBadge status={t.status} />
            {t.sport.name}
            {`Drużyny: ${t.teamsCount}`}
            {`/t/${t.slug}`}
          </MetaList>
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminPage active="dashboard" title={tournament.data?.name ?? 'Turniej'}>
      {content}
    </AdminPage>
  );
}
