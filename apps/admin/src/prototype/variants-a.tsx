// PROTOTYP (#251) — wariant A: „Grupy osobną kartą". Nie do main.
//
// Skład grup ustala się na karcie „Grupy", a Terminarz, Tabela i Drabinka tylko
// z niego korzystają. Terminarz filtruje kolejki chipami po grupie, Tabela stawia
// tabele grup jedna pod drugą, a rozstawienie idzie w oknie „Rozstaw i wygeneruj".
import { Button, Card, CardContent, EmptyState, Heading } from '@tournament/ui';
import { CalendarDays, GitFork, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { GROUPS, plural } from '../lib/plural';
import { CompositionEditor } from './composition';
import { proposalFor, useGroups, type GMatch } from './groups-store';
import { BracketView, PairPreview, SeedingDialog } from './qualification';
import { GenerateScheduleDialog, GroupFilterChips, MatchList, ScheduleToolbar, roundSummaries } from './schedule';
import { DivergenceNotice, MatchResultDialog, UnassignedTeamsNotice, UnfinishedGroupsNotice } from './shared';
import { GroupStandings, QualificationLegend } from './standings';
import { useTournament } from '../pages/tournament-layout';

export function GroupsScreenA() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="groups">
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Skład grup zastępuje się w całości: każda drużyna turnieju dokładnie raz, co najmniej dwie drużyny w grupie.
          Zapis kasuje terminarz grup.
        </p>
        <CompositionEditor layout="columns" />
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

export function ScheduleScreenA() {
  const tournament = useTournament();
  const state = useGroups();
  const [generating, setGenerating] = useState(false);
  const [openMatch, setOpenMatch] = useState<GMatch | null>(null);
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [round, setRound] = useState<number | null>(null);

  const rounds = roundSummaries(state.matches);
  const current = rounds.find((candidate) => candidate.id === round) ?? rounds[0];
  const visible = current
    ? state.matches.filter((match) => match.roundOrder === current.id && (groupFilter === null || match.groupId === groupFilter))
    : [];

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
          description="Faza grupowa powstaje z grup. Skład ustala karta Grupy."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/groups`}>Przejdź do grup</Link>
            </Button>
          }
        />
      ) : state.matches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Terminarz grup nie jest jeszcze wygenerowany"
          description={`${state.groups.length} ${plural(state.groups.length, GROUPS)}, każdy z każdym w swojej grupie. Kolejka jest wspólna dla wszystkich grup.`}
          action={
            <Button onClick={() => setGenerating(true)}>
              <RefreshCw className="size-4" /> Wygeneruj terminarz
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <GroupFilterChips value={groupFilter} onChange={setGroupFilter} />
          <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <ul className="space-y-0.5 rounded-xl border bg-card p-1.5">
              {rounds.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    aria-current={candidate.id === current?.id ? 'true' : undefined}
                    onClick={() => setRound(candidate.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted aria-[current]:bg-muted"
                  >
                    <span className="truncate">{candidate.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {candidate.finished}/{candidate.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <section className="min-w-0 space-y-2">
              <Heading level="card">{current?.name ?? 'Kolejka'}</Heading>
              <MatchList matches={visible} showGroup={groupFilter === null} onSelect={setOpenMatch} />
            </section>
          </div>
        </div>
      )}
      {generating && state.groups.length > 0 && <GenerateScheduleDialog onClose={() => setGenerating(false)} />}
      {openMatch && <MatchResultDialog match={openMatch} onClose={() => setOpenMatch(null)} />}
    </AdminPage>
  );
}

export function StandingsScreenA() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="standings">
      {state.groups.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Tabele grup pojawią się razem z grupami"
          description="Tabelę ma każda grupa fazy grupowej."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/groups`}>Przejdź do grup</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {state.matches.length === 0 && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Terminarz grup nie jest wygenerowany, więc tabele stoją na zerach.
            </p>
          )}
          {state.groups.map((group) => (
            <div key={group.id} className="grid gap-2">
              <GroupStandings group={group} />
              <QualificationLegend group={group} />
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}

export function BracketScreenA() {
  const tournament = useTournament();
  const state = useGroups();
  const [seeding, setSeeding] = useState(false);
  const canGenerate = state.groups.length > 0 && proposalFor(state).length >= 2;

  return (
    <AdminPage
      tournament={tournament}
      section="bracket"
      actions={
        state.knockout.length > 0 && (
          <>
            <Button variant="outline" onClick={() => setSeeding(true)}>
              <RefreshCw className="size-4" /> Wygeneruj ponownie
            </Button>
          </>
        )
      }
    >
      <UnfinishedGroupsNotice />
      {state.knockout.length === 0 ? (
        <div className="grid gap-4">
          <DivergenceNotice />
          <EmptyState
            icon={<GitFork />}
            title="Drabinka nie jest jeszcze wygenerowana"
            description={
              canGenerate
                ? 'Rozstawienie liczy się z tabel grup; pary możesz poprawić przed wygenerowaniem.'
                : 'Drabinka powstaje z wyjścia z grup. Najpierw ustal skład grup.'
            }
            action={
              <Button onClick={() => setSeeding(true)} disabled={!canGenerate}>
                <RefreshCw className="size-4" /> Rozstaw i wygeneruj
              </Button>
            }
          />
          {canGenerate && (
            <Card>
              <CardContent className="grid gap-3">
                <Heading level="card">Propozycja rozstawienia z tabel</Heading>
                <PairPreview list={proposalFor(state)} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <BracketView onRegenerate={() => setSeeding(true)} />
      )}
      {seeding && <SeedingDialog onClose={() => setSeeding(false)} />}
    </AdminPage>
  );
}
