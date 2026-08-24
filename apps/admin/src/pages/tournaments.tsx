import {
  Badge,
  Button,
  Heading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tournament/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { clearToken } from '../lib/session';

const STATUS_LABEL = {
  draft: 'Szkic',
  active: 'W trakcie',
  finished: 'Zakończony',
} as const;

export function TournamentsPage() {
  const navigate = useNavigate();

  const { data, isPending, error } = useQuery({
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

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <Heading>Turnieje</Heading>
        <Button variant="outline" onClick={handleLogout}>
          Wyloguj
        </Button>
      </div>

      {isPending ? <p className="text-muted-foreground">Wczytywanie...</p> : null}
      {error ? <p className="text-destructive">{error.message}</p> : null}

      {data ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nazwa</TableHead>
              <TableHead>Sport</TableHead>
              <TableHead>Drużyny</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Adres publiczny</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((tournament) => (
              <TableRow key={tournament.id}>
                <TableCell className="font-medium">{tournament.name}</TableCell>
                <TableCell>{tournament.sport.name}</TableCell>
                <TableCell>{tournament.teamsCount}</TableCell>
                <TableCell>
                  <Badge>{STATUS_LABEL[tournament.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">/t/{tournament.slug}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </main>
  );
}
