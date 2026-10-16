// PROTOTYP (#251) — wariant B: „Skład grup krokami w Terminarzu". Nie do main.
//
// Karta „Grupy" nie prowadzi składu: robi się to krokami w Terminarzu, a kolejki
// stoją sekcjami per grupa. Tabela przełącza się zakładkami grup, a rozstawienie
// widać wprost na Drabince, bez okna.
import { Button, Card, CardContent, EmptyState, Heading, Tabs, TabsContent, TabsList, TabsTrigger } from '@tournament/ui';
import { CalendarDays, GitFork, Info, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { CompositionEditor } from './composition';
import { groupStageStarted, useGroups, type GMatch } from './groups-store';
import { BracketView, InlineSeeding } from './qualification';
import { GenerateScheduleDialog, MatchList, ScheduleToolbar } from './schedule';
import { MatchResultDialog, UnassignedTeamsNotice, UnfinishedGroupsNotice, groupLetter } from './shared';
import { GroupStandings, QualificationLegend } from './standings';
import { useTournament } from '../pages/tournament-layout';

export function GroupsScreenB() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="groups">
      <EmptyState
        icon={<Users />}
        title="W tym układzie skład grup ustala się w Terminarzu"
        description="Terminarz prowadzi przez fazę grupową krokami: najpierw skład grup, potem kolejki."
        action={
          <Button asChild>
            <Link to={`/tournaments/${tournament.id}/schedule`}>Przejdź do Terminarza</Link>
          </Button>
        }
      />
      {state.groups.length > 0 && (
        <Card className="mt-4">
          <CardContent className="grid gap-2">
            <Heading level="card">Zapisany skład grup</Heading>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {state.groups.map((group) => (
                <li key={group.id} className="flex items-center gap-2">
                  <span className="font-medium">{group.name}</span>
                  <span className="text-muted-foreground">
                    {group.teamIds.length} drużyn · wychodzi {group.qualifiers}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}

export function ScheduleScreenB() {
  const tournament = useTournament();
  const state = useGroups();
  const [generating, setGenerating] = useState(false);
  const [openMatch, setOpenMatch] = useState<GMatch | null>(null);
  const step = state.groups.length === 0 || state.draftDirty;

  return (
    <AdminPage
      tournament={tournament}
      section="schedule"
      actions={<ScheduleToolbar onGenerate={() => setGenerating(true)} />}
    >
      <UnassignedTeamsNotice />
      <div className="grid gap-6">
        <Card>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <Heading level="card">Krok 1 · Skład grup</Heading>
              <span className="text-sm text-muted-foreground">
                {step ? 'Zapisz skład, żeby przejść do terminarza' : 'Zapisany — kolejki poniżej'}
              </span>
            </div>
            <CompositionEditor layout="rows" />
          </CardContent>
        </Card>

        {!step && state.matches.length === 0 && (
          <EmptyState
            icon={<CalendarDays />}
            title="Krok 2 · Terminarz grup"
            description={`${state.groups.length} grup, każdy z każdym w swojej grupie. Kolejka zbiera mecze wszystkich grup.`}
            action={<Button onClick={() => setGenerating(true)}>Wygeneruj terminarz</Button>}
          />
        )}

        {!step && state.matches.length > 0 && (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Heading level="card">Krok 2 · Terminarz grup</Heading>
              {groupStageStarted(state) && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="size-3.5" /> skład zamrożony od pierwszego meczu
                </span>
              )}
            </div>
            {state.groups.map((group) => {
              const rounds = [...new Set(state.matches.filter((match) => match.groupId === group.id).map((match) => match.roundOrder))];
              return (
                <section key={group.id} className="grid gap-3 rounded-xl border bg-card/50 p-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Heading level="card">Grupa {groupLetter(group.order)}</Heading>
                    <span className="text-xs text-muted-foreground">
                      {group.teamIds.length} drużyn · wychodzi {group.qualifiers} · {rounds.length} kolejek
                    </span>
                  </div>
                  {rounds.map((order) => (
                    <div key={order} className="grid gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Kolejka {order}</span>
                      <MatchList
                        matches={state.matches.filter((match) => match.groupId === group.id && match.roundOrder === order)}
                        showGroup={false}
                        onSelect={setOpenMatch}
                      />
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {generating && state.groups.length > 0 && <GenerateScheduleDialog onClose={() => setGenerating(false)} />}
      {openMatch && <MatchResultDialog match={openMatch} onClose={() => setOpenMatch(null)} />}
    </AdminPage>
  );
}

export function StandingsScreenB() {
  const tournament = useTournament();
  const state = useGroups();
  const [tab, setTab] = useState(String(state.groups[0]?.id ?? ''));

  return (
    <AdminPage tournament={tournament} section="standings">
      {state.groups.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Tabele grup pojawią się razem z grupami"
          description="Tabelę ma każda grupa fazy grupowej."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/schedule`}>Przejdź do Terminarza</Link>
            </Button>
          }
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {state.groups.map((group) => (
              <TabsTrigger key={group.id} value={String(group.id)}>
                {group.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {state.groups.map((group) => (
            <TabsContent key={group.id} value={String(group.id)} className="grid gap-2">
              <GroupStandings group={group} />
              <QualificationLegend group={group} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AdminPage>
  );
}

export function BracketScreenB() {
  const tournament = useTournament();
  const state = useGroups();
  return (
    <AdminPage tournament={tournament} section="bracket">
      <UnfinishedGroupsNotice />
      <div className="grid gap-4">
        <InlineSeeding />
        {state.knockout.length > 0 && <BracketView onRegenerate={() => undefined} />}
        {state.knockout.length === 0 && state.groups.length > 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <GitFork className="size-4" /> Po wygenerowaniu drabinka stanie nad rozstawieniem.
          </p>
        )}
      </div>
    </AdminPage>
  );
}
