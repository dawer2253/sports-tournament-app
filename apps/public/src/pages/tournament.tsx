import {
  Heading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tournament/ui';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { POLL_INTERVAL_MS, api } from '../lib/api';

export function TournamentPage() {
  const { slug = '' } = useParams();

  const tournament = useQuery({
    queryKey: ['public', slug],
    queryFn: async () => {
      const { data, error } = await api.GET('/public/t/{slug}', {
        params: { path: { slug } },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const standings = useQuery({
    queryKey: ['public', slug, 'standings'],
    queryFn: async () => {
      const { data, error } = await api.GET('/public/t/{slug}/standings', {
        params: { path: { slug } },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  if (tournament.isPending) {
    return <p className="p-8 text-muted-foreground">Wczytywanie...</p>;
  }

  if (tournament.error) {
    return <p className="p-8 text-destructive">{tournament.error.message}</p>;
  }

  return (
    <main
      className="mx-auto flex max-w-4xl flex-col gap-8 p-8"
      style={{ '--brand': tournament.data.branding.primaryColor } as React.CSSProperties}
    >
      <header className="flex flex-col gap-1">
        <Heading>{tournament.data.name}</Heading>
        <p className="text-muted-foreground">{tournament.data.sport.name}</p>
      </header>

      {standings.data?.map((table) => (
        <section key={`${table.stageId}-${table.groupId ?? 'all'}`} className="flex flex-col gap-3">
          <Heading level="section">
            {table.groupName ?? table.stageName}
          </Heading>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Drużyna</TableHead>
                <TableHead className="text-right">M</TableHead>
                <TableHead className="text-right">Z</TableHead>
                <TableHead className="text-right">R</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">{table.scoreLabel}</TableHead>
                <TableHead className="text-right">Pkt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row) => (
                <TableRow key={row.team.id}>
                  <TableCell>{row.position}</TableCell>
                  <TableCell className="font-medium">{row.team.name}</TableCell>
                  <TableCell className="text-right">{row.played}</TableCell>
                  <TableCell className="text-right">{row.won}</TableCell>
                  <TableCell className="text-right">{row.drawn}</TableCell>
                  <TableCell className="text-right">{row.lost}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.scoreFor}:{row.scoreAgainst}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{row.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </main>
  );
}
