// PROTOTYP (#251) — wariant C: „Grupy przy drużynach, tabela zbiorcza". Nie do main.
//
// Skład grup ustala się przy liście drużyn: kolumna „Grupa" w wierszu każdej
// drużyny. Osobna karta Grupy pokazuje tylko podgląd. Tabela jest jedna,
// zbiorcza — sekcje grup pod sobą, a liczbę wychodzących ustawia się wprost
// przy nazwie grupy. Rozstawienie pokazuje się kolumnami par 1. rundy
// (`SeedingColumns`), bez listy z ↑/↓.
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Heading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@tournament/ui';
import { CalendarDays, Layers, RefreshCw, Users } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { GROUPS, TEAMS, plural } from '../lib/plural';
import { useTournament } from '../pages/tournament-layout';
import { CompositionEditor } from './composition';
import { scoreLabel, sim, standingsFor, teamById, useGroups, type GMatch, type Group } from './groups-store';
import { BracketView, InlineSeeding } from './qualification';
import { GenerateScheduleDialog, RoundBlock, ScheduleToolbar, roundSummaries } from './schedule';
import { GroupBadge, MatchResultDialog, UnassignedTeamsNotice, UnfinishedGroupsNotice } from './shared';

/** Liczba wychodzących ustawiana wprost przy nazwie grupy (`PATCH /groups/{group}`). */
function GroupQualifiersSelect({ group }: { group: Group }) {
  const options = Math.max(group.teamIds.length, 1);
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      wychodzi
      <Select value={String(group.qualifiers)} onValueChange={(value) => sim.setGroupQualifiers(group.id, Number(value))}>
        <SelectTrigger size="sm" className="w-16" aria-label={`Ile drużyn wychodzi z grupy ${group.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: options }, (_, i) => i + 1).map((count) => (
            <SelectItem key={count} value={String(count)}>
              {count}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Skład grup przy drużynach: ten sam edytor co warianty A i B, ale w układzie
 * wierszami, bo tu zastępuje listę drużyn turnieju. Grupa jest kolumną wiersza.
 */
export function TeamsScreenC() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="teams">
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          W tym układzie grupę każdej drużyny ustawia się tutaj, przy liście drużyn — nie ma osobnego kroku ani okna.
          Zapis składu dzieje się raz, dla całej fazy grupowej.
        </p>
        <CompositionEditor layout="rows" />
        {state.groups.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Zapisany skład: {state.groups.length} {plural(state.groups.length, GROUPS)} ·{' '}
            {state.groups.map((group) => `${group.name} (${group.teamIds.length})`).join(', ')}
          </p>
        )}
      </div>
    </AdminPage>
  );
}

/** Karta Grupy tylko czyta skład: zmienia się go przy Drużynach. */
export function GroupsScreenC() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="groups">
      <UnassignedTeamsNotice />
      {state.groups.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="Grupy powstaną z listy drużyn"
          description="W tym układzie nie ma osobnego ekranu składu — grupy ustala się przy drużynach."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/teams`}>Przejdź do drużyn</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Podgląd zapisanego składu. Drużyna wchodzi do grupy na ekranie Drużyn.
            </p>
            <Button asChild variant="outline" className="ml-auto">
              <Link to={`/tournaments/${tournament.id}/teams`}>Zmień skład w Drużynach</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.groups.map((group) => {
              const table = standingsFor(state, group);
              return (
                <Card key={group.id}>
                  <CardContent className="grid gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <GroupBadge name={group.name} />
                      <span className="text-xs text-muted-foreground">
                        wychodzi {group.qualifiers} z {group.teamIds.length}
                      </span>
                    </div>
                    <ul className="grid gap-1 text-sm">
                      {group.teamIds.map((teamId) => {
                        const row = table.find((candidate) => candidate.team.id === teamId);
                        return (
                          <li key={teamId} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate">{teamById(state, teamId)?.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {row ? `${row.position}. · ${row.points} pkt` : '—'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </AdminPage>
  );
}

/**
 * Terminarz jednym pionowym ciągiem kolejek (bez listy kolejek z boku), a grupa
 * filtruje się `Select`em, nie chipami. Kolejka jest wspólna dla grup (#249),
 * więc plakietka grupy stoi przy każdym wierszu.
 */
export function ScheduleScreenC() {
  const tournament = useTournament();
  const state = useGroups();
  const [generating, setGenerating] = useState(false);
  const [openMatch, setOpenMatch] = useState<GMatch | null>(null);
  const [groupFilter, setGroupFilter] = useState('all');

  const groupId = groupFilter === 'all' ? null : Number(groupFilter);
  const rounds = roundSummaries(state.matches)
    .map((summary) => ({
      summary,
      matches: state.matches.filter(
        (match) => match.roundOrder === summary.id && (groupId === null || match.groupId === groupId),
      ),
    }))
    .filter((round) => round.matches.length > 0);

  return (
    <AdminPage
      tournament={tournament}
      section="schedule"
      actions={<ScheduleToolbar onGenerate={() => setGenerating(true)} />}
    >
      <UnassignedTeamsNotice />
      {state.groups.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Najpierw ustal skład grup"
          description="Faza grupowa powstaje z grup, a te ustala się przy drużynach."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/teams`}>Przejdź do drużyn</Link>
            </Button>
          }
        />
      ) : state.matches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Terminarz grup nie jest jeszcze wygenerowany"
          description={`${state.groups.length} ${plural(state.groups.length, GROUPS)}, każdy z każdym w swojej grupie. Kolejka zbiera mecze wszystkich grup.`}
          action={
            <Button onClick={() => setGenerating(true)}>
              <RefreshCw className="size-4" /> Wygeneruj terminarz
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <label className="flex w-fit items-center gap-2 text-sm">
            Grupa
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-48" aria-label="Filtr grup">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie grupy</SelectItem>
                {state.groups.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="grid gap-6">
            {rounds.map(({ summary, matches }) => (
              <RoundBlock
                key={summary.id}
                title={summary.name}
                dates={summary.dates}
                matches={matches}
                showGroup
                onSelect={setOpenMatch}
              />
            ))}
          </div>
        </div>
      )}
      {generating && state.groups.length > 0 && <GenerateScheduleDialog onClose={() => setGenerating(false)} />}
      {openMatch && <MatchResultDialog match={openMatch} onClose={() => setOpenMatch(null)} />}
    </AdminPage>
  );
}

/**
 * Jedna tabela zbiorcza (#250): grupy idą sekcjami, każda z linią wyjścia
 * i sterowaniem liczbą wychodzących przy nazwie. Miejsca nad przerywaną linią
 * wychodzą z grupy.
 */
function CombinedStandings() {
  const state = useGroups();
  const allowsDraw = state.sport !== 'basketball';
  const columns = allowsDraw ? 9 : 8;

  return (
    <Card>
      <CardContent className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>Drużyna</TableHead>
              <TableHead className="w-10 text-center">M</TableHead>
              <TableHead className="w-10 text-center">W</TableHead>
              {allowsDraw && <TableHead className="w-10 text-center">R</TableHead>}
              <TableHead className="w-10 text-center">P</TableHead>
              <TableHead className="w-24 text-center">{scoreLabel(state.sport)}</TableHead>
              <TableHead className="w-12 text-center">+/-</TableHead>
              <TableHead className="w-12 text-center">Pkt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.groups.map((group) => {
              const rows = standingsFor(state, group);
              const lastQualifierIndex = group.qualifiers - 1;
              return (
                <Fragment key={group.id}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={columns} className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <GroupBadge name={group.name} />
                        <span className="text-xs text-muted-foreground">{group.teamIds.length} {plural(group.teamIds.length, TEAMS)}</span>
                        <span className="ml-auto">
                          <GroupQualifiersSelect group={group} />
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {rows.map((row, index) => (
                    <TableRow
                      key={row.team.id}
                      className={cn(
                        row.qualifies && 'bg-primary/5',
                        index === lastQualifierIndex && 'border-b-2 border-dashed border-b-primary/40',
                      )}
                    >
                      <TableCell
                        className={cn('text-right tabular-nums', row.qualifies && 'border-l-2 border-l-primary font-semibold')}
                      >
                        {row.position}
                      </TableCell>
                      <TableCell className="min-w-40">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{row.team.name}</span>
                          {row.tied && (
                            <span className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                              remis na linii
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{row.played}</TableCell>
                      <TableCell className="text-center tabular-nums">{row.won}</TableCell>
                      {allowsDraw && <TableCell className="text-center tabular-nums">{row.drawn}</TableCell>}
                      <TableCell className="text-center tabular-nums">{row.lost}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.scoreFor}:{row.scoreAgainst}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference}
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">{row.points}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns} className="text-center text-sm text-muted-foreground">
                        Grupa nie ma jeszcze drużyn.
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function StandingsScreenC() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="standings">
      {state.groups.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Tabele grup pojawią się razem z grupami"
          description="Grupy ustala się przy drużynach."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/teams`}>Przejdź do drużyn</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {state.matches.length === 0 && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Terminarz grup nie jest wygenerowany, więc tabele stoją na zerach.
            </p>
          )}
          <CombinedStandings />
          <p className="text-xs text-muted-foreground">
            Miejsca nad przerywaną linią wychodzą z grupy, a liczbę wychodzących ustawia się przy nazwie grupy. Remis na
            linii rozstrzyga organizer przy generowaniu drabinki.
          </p>
        </div>
      )}
    </AdminPage>
  );
}

export function BracketScreenC() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="bracket">
      <UnfinishedGroupsNotice />
      <div className="grid gap-4">
        <InlineSeeding layout="columns" />
        {state.knockout.length > 0 && <BracketView />}
        {state.knockout.length === 0 && state.groups.length > 0 && (
          <div className="grid gap-1 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Heading level="card">Rozstawienie kolumnami</Heading>
            </span>
            <p>
              Pary 1. rundy stoją obok siebie od lewej; drużynę podmienia się wprost w slocie. Po wygenerowaniu drabinka
              pojawi się nad tą kartą.
            </p>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
