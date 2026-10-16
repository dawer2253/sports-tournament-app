// PROTOTYP (#251) — wspólne kawałki karty Terminarz fazy grupowej (#249). Nie do main.
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormDialog,
  Heading,
  MatchRow,
  cn,
  matchDays,
  toast,
  type RoundSummary,
} from '@tournament/ui';
import { CalendarClock, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ChoiceCards } from '../components/choice-cards';
import { GROUPS, MATCHES, ROUNDS, plural } from '../lib/plural';
import {
  groupStageStarted,
  scheduleSize,
  sim,
  teamById,
  teamsWithoutGroup,
  useGroups,
  type GMatch,
} from './groups-store';
import { GroupBadge, MatchResultDialog, matchRowData } from './shared';

/** Mecze pogrupowane po kolejce fazy; kolejka jest wspólna dla wszystkich grup (#249). */
export function matchesByRound(matches: GMatch[]): Map<number, GMatch[]> {
  const rounds = new Map<number, GMatch[]>();
  for (const match of matches) {
    const list = rounds.get(match.roundOrder) ?? [];
    list.push(match);
    rounds.set(match.roundOrder, list);
  }
  return rounds;
}

export function roundSummaries(matches: GMatch[]): RoundSummary[] {
  return [...matchesByRound(matches).entries()].map(([order, list]) => {
    const date = list[0]!.roundDates.slice(0, 10);
    return {
      id: order,
      name: `Kolejka ${order}`,
      dates: date,
      finished: list.filter((match) => match.status === 'finished').length,
      total: list.length,
    };
  });
}

/** Pasek akcji karty Terminarz: rozkład dat i generowanie. */
export function ScheduleToolbar({ onGenerate }: { onGenerate: () => void }) {
  const state = useGroups();
  const started = groupStageStarted(state);
  if (state.groups.length === 0 || state.matches.length === 0) return null;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => toast.success('Rozłożono daty (atrapa okna z terminarza ligi)')}
      >
        <CalendarClock className="size-4" /> Rozłóż daty
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Więcej akcji terminarza">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem disabled={started} onSelect={onGenerate}>
            <RefreshCw /> Wygeneruj ponownie
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** Okno generowania terminarza fazy grupowej: „raz / dwa razy", z licznikami. */
export function GenerateScheduleDialog({ onClose }: { onClose: () => void }) {
  const state = useGroups();
  const [meetings, setMeetings] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string>();
  const replacing = state.matches.length > 0;
  const missing = teamsWithoutGroup(state);

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (meetings === null) {
          setError('Wybierz, ile razy grają ze sobą drużyny.');
          return;
        }
        sim.generateSchedule(meetings);
        onClose();
      }}
      title={replacing ? 'Wygeneruj terminarz grup ponownie' : 'Wygeneruj terminarz grup'}
      description={`Faza grupowa · ${state.groups.length} ${plural(state.groups.length, GROUPS)}. Kolejka jest wspólna dla wszystkich grup.`}
      submitLabel={replacing ? 'Zastąp terminarz' : 'Wygeneruj'}
      error={error}
    >
      <ChoiceCards
        legend="Każdy z każdym"
        name="meetings"
        options={([1, 2] as const).map((value) => {
          const { roundsCount, matchesCount } = scheduleSize(state.groups, value);
          return {
            value,
            label: value === 1 ? 'Raz' : 'Dwa razy (mecz i rewanż)',
            description: `${roundsCount} ${plural(roundsCount, ROUNDS)}, ${matchesCount} ${plural(matchesCount, MATCHES)}`,
          };
        })}
        value={meetings}
        onChange={(value) => {
          setMeetings(value);
          setError(undefined);
        }}
        errorMessage={error}
        className="gap-3 lg:grid-cols-2"
      />
      {missing.length > 0 && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Drużyna „{missing[0]!.name}" nie ma grupy. Zapisz skład grup od nowa.
        </p>
      )}
      {replacing && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Obecny terminarz grup ({state.matches.length} {plural(state.matches.length, MATCHES)}) zniknie razem z terminami
          i wynikami.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Mecze powstaną bez dat.</p>
    </FormDialog>
  );
}

/**
 * Lista meczów jednej kolejki. `showGroup` dokłada plakietkę grupy obok wiersza
 * — wariant, w którym kolejka miesza grupy, musi je czymś oznaczyć (#249).
 */
export function MatchList({
  matches,
  showGroup,
  onSelect,
}: {
  matches: GMatch[];
  showGroup: boolean;
  onSelect: (match: GMatch) => void;
}) {
  const state = useGroups();
  const oneDay = matchDays(matches.map((match) => match.kickoffAt)).length === 1;
  return (
    <ul className="space-y-2">
      {matches.map((match) => {
        const group = state.groups.find((candidate) => candidate.id === match.groupId);
        return (
          <li key={match.id} className="flex items-start gap-2">
            {showGroup && group && (
              <span className="w-24 shrink-0 pt-2.5">
                <GroupBadge name={group.name} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <MatchRow match={matchRowData(state, match)} showDate={!oneDay} onSelect={() => onSelect(match)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Karta kolejki z nagłówkiem i listą meczów; `title` niesie nazwę grupy w układzie sekcji. */
export function RoundBlock({
  title,
  dates,
  matches,
  showGroup,
  onSelect,
}: {
  title: string;
  dates: string;
  matches: GMatch[];
  showGroup: boolean;
  onSelect: (match: GMatch) => void;
}) {
  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Heading level="card">{title}</Heading>
        <span className="text-sm text-muted-foreground">{dates.slice(0, 10)}</span>
      </div>
      <MatchList matches={matches} showGroup={showGroup} onSelect={onSelect} />
    </section>
  );
}

/** Chipy filtra grup: „Wszystkie" plus grupy fazy. */
export function GroupFilterChips({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const state = useGroups();
  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
      active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
    );
  return (
    <div role="group" aria-label="Filtr grup" className="flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={value === null} className={chip(value === null)} onClick={() => onChange(null)}>
        Wszystkie grupy
      </button>
      {state.groups.map((group) => (
        <button
          key={group.id}
          type="button"
          aria-pressed={value === group.id}
          className={chip(value === group.id)}
          onClick={() => onChange(group.id)}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}

/** Wiersz meczu z uchwytem kliknięcia — wspólny dla widoków po jednej grupie. */
export function TeamMatchRow({ match, onSelect }: { match: GMatch; onSelect: (match: GMatch) => void }) {
  const state = useGroups();
  const home = teamById(state, match.homeId);
  const away = teamById(state, match.awayId);
  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className="flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:shadow-md"
    >
      <span className="min-w-0 flex-1 truncate text-left">{home?.name}</span>
      <span className="shrink-0 tabular-nums">
        {match.homeScore ?? '–'}:{match.awayScore ?? '–'}
      </span>
      <span className="min-w-0 flex-1 truncate text-right">{away?.name}</span>
    </button>
  );
}

export { MatchResultDialog };
