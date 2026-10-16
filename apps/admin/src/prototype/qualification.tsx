// PROTOTYP (#251) — kwalifikacja, rozstawienie krzyżowe i korekta par (#250). Nie do main.
//
// Propozycję rozstawienia liczy `proposalFor` w store (wspinaczka z #250).
// Organizer może podmienić drużynę na inną z tej samej grupy, gdy remis na linii
// rozstrzyga regulamin, a para 1. rundy liczy się z listy na żywo.
import {
  Button,
  EmptyState,
  FormDialog,
  Heading,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from '@tournament/ui';
import { ArrowDown, ArrowUp, GitFork, Info, Shuffle, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { MATCHES, TEAMS, plural } from '../lib/plural';
import {
  bracketSize,
  proposalFor,
  seedPositions,
  sim,
  standingsFor,
  teamById,
  useGroups,
  type SeedEntry,
  type State,
} from './groups-store';
import { DivergenceNotice, UnfinishedGroupsNotice, groupLetter, slotLabel } from './shared';

/** Etykieta pochodzenia drużyny w liście rozstawienia: „1A", „2B". */
function origin(state: State, entry: SeedEntry): string {
  const group = state.groups.find((candidate) => candidate.id === entry.groupId);
  return `${entry.position}${group ? groupLetter(group.order) : '?'}`;
}

/** Pary 1. rundy z listy rozstawienia, z pochodzeniem i wolnymi losami. */
export function seedingPairs(list: SeedEntry[]) {
  if (list.length < 2) return [];
  const size = bracketSize(list.length);
  const positions = seedPositions(size);
  const pairs: { matchNumber: number; home: SeedEntry | null; away: SeedEntry | null }[] = [];
  for (let i = 0; i < size; i += 2) {
    const home = positions[i]! <= list.length ? list[positions[i]! - 1]! : null;
    const away = positions[i + 1]! <= list.length ? list[positions[i + 1]! - 1]! : null;
    if (home === null && away === null) continue;
    pairs.push({ matchNumber: pairs.length + 1, home, away });
  }
  return pairs;
}

/** Lista rozstawienia: ↑/↓, pochodzenie i podmiana drużyny w obrębie grupy. */
export function SeedingRows({
  list,
  onChange,
  showMoves = true,
}: {
  list: SeedEntry[];
  onChange: (next: SeedEntry[]) => void;
  showMoves?: boolean;
}) {
  const state = useGroups();

  function move(from: number, to: number) {
    const next = [...list];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry!);
    onChange(next);
  }

  function swap(index: number, teamId: number) {
    onChange(list.map((entry, i) => (i === index ? { ...entry, teamId } : entry)));
  }

  return (
    <ol className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
      {list.map((entry, index) => {
        const team = teamById(state, entry.teamId);
        const group = state.groups.find((candidate) => candidate.id === entry.groupId);
        const table = group ? standingsFor(state, group) : [];
        return (
          <li key={`${entry.groupId}-${entry.position}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-1">
            <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-primary">
              {origin(state, entry)}
            </span>
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
            <Select value={String(entry.teamId)} onValueChange={(value) => swap(index, Number(value))}>
              <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={`Drużyna na pozycji ${index + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(group?.teamIds ?? [entry.teamId]).map((teamId) => {
                  const candidate = teamById(state, teamId);
                  const place = table.findIndex((row) => row.team.id === teamId) + 1;
                  return (
                    <SelectItem key={teamId} value={String(teamId)}>
                      {candidate?.name ?? `Drużyna ${teamId}`}
                      {place > 0 && place > entry.position ? ` (${place}. w grupie)` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {showMoves && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === 0}
                  aria-label={`Przesuń ${team?.name ?? ''} wyżej`}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === list.length - 1}
                  aria-label={`Przesuń ${team?.name ?? ''} niżej`}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Podgląd par 1. rundy z pochodzeniem („1A – 2B") i wolnymi losami. */
export function PairPreview({ list }: { list: SeedEntry[] }) {
  const state = useGroups();
  const pairs = seedingPairs(list);
  return (
    <div className="grid content-start gap-2">
      <span className="text-sm font-medium">Pary 1. rundy</span>      <ol className="grid gap-1 text-sm">
        {pairs.map((pair) => (
          <li
            key={pair.matchNumber}
            className={cn('flex items-center gap-2 rounded-md border px-2 py-1', (!pair.home || !pair.away) && 'border-dashed')}
          >
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pair.matchNumber}</span>
            <Name entry={pair.home} state={state} />
            <span aria-hidden className="text-xs text-muted-foreground">–</span>
            <Name entry={pair.away} state={state} right />
          </li>
        ))}
        {pairs.length === 0 && <li className="text-xs text-muted-foreground">Potrzeba co najmniej dwóch drużyn.</li>}
      </ol>
      <p className="text-xs text-muted-foreground">
        Kolejność listy to rozstawienie od 1; generator układa pary według standardowej reguły seedów.
      </p>
    </div>
  );
}

function Name({ entry, state, right }: { entry: SeedEntry | null; state: State; right?: boolean }) {
  if (!entry) {
    return <span className={cn('min-w-0 flex-1 text-right text-xs text-muted-foreground', !right && 'text-left')}>wolny los → 2. runda</span>;
  }
  const team = teamById(state, entry.teamId);
  return (
    <span className={cn('min-w-0 flex-1 truncate', right && 'text-right')}>
      <span className="text-xs text-primary">{origin(state, entry)}</span> {team?.name}
    </span>
  );
}

/**
 * Rozstawienie kolumnami (wariant C): pary 1. rundy jako karty ułożone obok
 * siebie. Drużynę podmienia się wprost w slocie pary, w obrębie jej grupy —
 * bez listy z ↑/↓, bo kolejność niesie układ par.
 */
export function SeedingColumns({ list, onChange }: { list: SeedEntry[]; onChange: (next: SeedEntry[]) => void }) {
  const pairs = seedingPairs(list);

  function swap(entry: SeedEntry, teamId: number) {
    onChange(list.map((candidate) => (candidate.teamId === entry.teamId ? { ...candidate, teamId } : candidate)));
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {pairs.map((pair) => (
        <div key={pair.matchNumber} className="grid content-start gap-2 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Mecz {pair.matchNumber}</span>
            {(!pair.home || !pair.away) && <span>pary z wolnym losem</span>}
          </div>
          <Slot entry={pair.home} onSwap={swap} />
          <Slot entry={pair.away} onSwap={swap} />
        </div>
      ))}
      {pairs.length === 0 && <p className="text-xs text-muted-foreground">Potrzeba co najmniej dwóch drużyn.</p>}
    </div>
  );
}

function Slot({ entry, onSwap }: { entry: SeedEntry | null; onSwap: (entry: SeedEntry, teamId: number) => void }) {
  const state = useGroups();
  if (!entry) {
    return (
      <div className="rounded-md border border-dashed px-2 py-1 text-xs italic text-muted-foreground">
        wolny los → 2. runda
      </div>
    );
  }
  const group = state.groups.find((candidate) => candidate.id === entry.groupId);
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-primary">
        {origin(state, entry)}
      </span>
      <Select value={String(entry.teamId)} onValueChange={(value) => onSwap(entry, Number(value))}>
        <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={`Drużyna ${origin(state, entry)}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(group?.teamIds ?? [entry.teamId]).map((teamId) => (
            <SelectItem key={teamId} value={String(teamId)}>
              {teamById(state, teamId)?.name ?? `Drużyna ${teamId}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Wymieszanie drużyn w obrębie tego samego miejsca — „Wylosuj resztę" (#250 do rozstrzygnięcia). */
function shuffleWithinPlace(list: SeedEntry[]): SeedEntry[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (next[i]!.position === next[j]!.position) [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

/** Błędy blokujące generowanie: grupa mniejsza niż liczba wychodzących, brak składu. */
function blockingErrors(state: State): string[] {
  if (state.groups.length === 0) return ['Najpierw ustal skład grup.'];
  const errors: string[] = [];
  for (const group of state.groups) {
    const teams = standingsFor(state, group).length;
    if (teams < group.qualifiers) errors.push(`Grupa „${group.name}" ma mniej drużyn, niż z niej wychodzi.`);
  }
  return errors;
}

function ThirdPlaceSwitch({ value, onChange, teams }: { value: boolean; onChange: (next: boolean) => void; teams: number }) {
  const disabled = teams < 4;
  return (
    <Label className={cn('flex items-start gap-3 rounded-md border p-3 font-normal', disabled && 'opacity-60')}>
      <Switch checked={value && !disabled} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">Mecz o 3. miejsce</span>
        <span className="block text-xs text-muted-foreground">
          {disabled ? 'Wymaga co najmniej czterech drużyn w drabince.' : 'Grają przegrani półfinałów, w rundzie finału, przed finałem.'}
        </span>
      </span>
    </Label>
  );
}

/** Treść rozstawienia: ostrzeżenia, lista z korektą, podgląd par, mecz o 3. miejsce. */
function SeedingBody({
  list,
  onChange,
  showMoves,
  showShuffle,
  layout = 'list',
}: {
  list: SeedEntry[];
  onChange: (next: SeedEntry[]) => void;
  showMoves: boolean;
  showShuffle: boolean;
  layout?: 'list' | 'columns';
}) {
  const state = useGroups();
  const errors = blockingErrors(state);
  return (
    <div className="grid gap-4">
      <UnfinishedGroupsNotice />
      {layout === 'columns' ? (
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium">Rozstawienie — pary 1. rundy</span>
          <SeedingColumns list={list} onChange={onChange} />
          <p className="text-xs text-muted-foreground">
            Kolumny to pary 1. rundy od lewej; pochodzenie z tabeli grup stoi przy nazwie. Podmiana w obrębie grupy
            rozstrzyga remis na linii.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Rozstawienie</span>
              {showShuffle && (
                <Button type="button" size="sm" variant="outline" onClick={() => onChange(shuffleWithinPlace(list))}>
                  <Shuffle className="size-4" /> Wylosuj w obrębie miejsc
                </Button>
              )}
            </div>
            <SeedingRows list={list} onChange={onChange} showMoves={showMoves} />
            <p className="text-xs text-muted-foreground">
              Pierwsza kolumna to pochodzenie z tabeli grup. Podmiana w obrębie grupy rozstrzyga remis na linii.
            </p>
          </div>
          <div className="grid content-start gap-3">
            <PairPreview list={list} />
          </div>
        </div>
      )}
      {errors.map((error) => (
        <p key={error} className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}

/** Okno „Rozstaw i wygeneruj" wypełnione propozycją z tabel (wariant A). */
export function SeedingDialog({ onClose }: { onClose: () => void }) {
  const state = useGroups();
  const [list, setList] = useState<SeedEntry[]>(() => proposalFor(state));
  const [thirdPlace, setThirdPlace] = useState(state.thirdPlace);
  const errors = blockingErrors(state);
  const teams = list.length;

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.length > 0) return;
        sim.generateBracket(list.map((entry) => entry.teamId), thirdPlace);
        onClose();
      }}
      title={state.knockout.length > 0 ? 'Rozstaw i wygeneruj ponownie' : 'Rozstaw i wygeneruj'}
      description={
        teams > 0
          ? `Wychodzi ${teams} ${plural(teams, TEAMS)} z ${state.groups.length} grup. Drabinka pomieści ${bracketSize(teams)} ${plural(bracketSize(teams), TEAMS)}.`
          : 'Propozycja pojawi się, gdy grupy będą miały skład.'
      }
      submitLabel={state.knockout.length > 0 ? 'Zastąp drabinkę' : 'Wygeneruj'}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
    >
      <SeedingBody list={list} onChange={setList} showMoves showShuffle />
      <ThirdPlaceSwitch value={thirdPlace} onChange={setThirdPlace} teams={teams} />
      {state.knockout.length > 0 && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Obecna drabinka ({state.knockout.length} {plural(state.knockout.length, MATCHES)}) zniknie razem z terminami i
          obiektami.
        </p>
      )}
    </FormDialog>
  );
}

/** Rozstawienie wprost na karcie Drabinka, bez okna (warianty B i C). */
export function InlineSeeding({
  onGenerated,
  layout = 'list',
}: {
  onGenerated?: () => void;
  /** `columns` to wariant C: pary 1. rundy ułożone kolumnami. */
  layout?: 'list' | 'columns';
}) {
  const state = useGroups();
  const [list, setList] = useState<SeedEntry[]>(() => proposalFor(state));
  const [thirdPlace, setThirdPlace] = useState(state.thirdPlace);
  const errors = blockingErrors(state);

  if (state.groups.length === 0) {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Drabinka czeka na wyjście z grup"
        description="Drabinka powstaje dopiero z wyjścia z grup. Najpierw ustal skład grup i rozegraj mecze."
      />
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Heading level="card">Rozstawienie z tabel grup</Heading>
        <span className="text-xs text-muted-foreground">
          {list.length} {plural(list.length, TEAMS)} · wychodzi {state.groups.reduce((sum, group) => sum + group.qualifiers, 0)}
        </span>
        <Button
          type="button"
          className="ml-auto"
          disabled={errors.length > 0}
          onClick={() => {
            sim.generateBracket(list.map((entry) => entry.teamId), thirdPlace);
            onGenerated?.();
          }}
        >
          <GitFork className="size-4" /> {state.knockout.length > 0 ? 'Zastąp drabinkę' : 'Wygeneruj drabinkę'}
        </Button>
      </div>
      <SeedingBody list={list} onChange={setList} showMoves={false} showShuffle={false} layout={layout} />
      <ThirdPlaceSwitch value={thirdPlace} onChange={setThirdPlace} teams={list.length} />
    </div>
  );
}

/** Gotowa drabinka: rundy i pary, z opisem rozjazdu z tabelami. */
export function BracketView({ onRegenerate }: { onRegenerate?: () => void }) {
  const state = useGroups();
  if (state.knockout.length === 0) return null;
  const rounds = [...new Set(state.knockout.map((match) => match.roundName))];
  return (
    <div className="grid gap-4">
      <DivergenceNotice />
      {rounds.map((name) => (
        <section key={name} className="space-y-2">
          <Heading level="card">{name}</Heading>
          <ul className="space-y-2">
            {state.knockout
              .filter((match) => match.roundName === name)
              .map((match) => {
                const home = teamById(state, match.homeId);
                const away = teamById(state, match.awayId);
                return (
                  <li key={match.id} className="rounded-xl border bg-card px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{match.label}</span>
                      <span>Zaplanowany</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('min-w-0 flex-1 truncate', !home && 'text-xs italic text-muted-foreground')}>
                        {home?.name ?? slotLabel(match, 'home')}
                      </span>
                      <span aria-hidden className="text-xs text-muted-foreground">–</span>
                      <span className={cn('min-w-0 flex-1 truncate text-right', !away && 'text-xs italic text-muted-foreground')}>
                        {away?.name ?? slotLabel(match, 'away')}
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {onRegenerate && state.knockout.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
          <Info aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1">
            Wyniki dopisane w tabelach grup nie ruszają drabinki. „Wygeneruj ponownie" przelicza ją z bieżących tabel i
            zastępuje obecne pary.
          </p>
          <Button size="sm" variant="outline" onClick={onRegenerate}>
            Wygeneruj ponownie
          </Button>
        </div>
      )}
    </div>
  );
}

/** Ostrzeżenie, gdy faza grupowa ma jeszcze mecze — do pustego stanu Drabinki. */
export function BracketEmptyNotice() {
  const state = useGroups();
  if (state.groups.length === 0 || state.knockout.length > 0) return null;
  const qualified = state.groups.reduce((sum, group) => sum + group.qualifiers, 0);
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      <span>
        Z grup wychodzi {qualified} {plural(qualified, TEAMS)} — do rozstawienia z tabel.
      </span>
    </div>
  );
}
