// PROTOTYP (#251) — edytor składu grup (#249). Nie do main.
//
// `PUT /stages/{stage}/groups` zastępuje cały skład: każda drużyna turnieju
// dokładnie raz, co najmniej jedna grupa po co najmniej dwie drużyny, losowanie
// po stronie panelu. Ten sam edytor pokazują warianty w trzech miejscach —
// osobną kartą (A), krokiem w Terminarzu (B) i przy Drużynach (C) — więc ma dwa
// układy: kolumnami i wierszami.
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@tournament/ui';
import { RefreshCw, Save, Shuffle, X } from 'lucide-react';
import { useState } from 'react';
import { MATCHES, TEAMS, plural } from '../lib/plural';
import { groupCountOptions, groupStageStarted, sim, useGroups, type Group } from './groups-store';
import { GroupBadge } from './shared';

const NONE = 'none';

function groupOptions(state: ReturnType<typeof useGroups>, exclude?: number) {
  return state.draft.map((group, index) => ({ index, label: group.name })).filter((option) => option.index !== exclude);
}

/**
 * Drużyny bez grupy w szkicu. Pula czyta szkic, nie zapisany skład, więc
 * przydział i odkliknięcie widać od razu, jeszcze przed zapisem.
 */
function missingFromDraft(state: ReturnType<typeof useGroups>) {
  const assigned = new Set(state.draft.flatMap((group) => group.teamIds));
  return state.teams.filter((team) => !assigned.has(team.id));
}

/** Pasek kontrolny edytora: liczba grup, losowanie i zapis. */
function EditorControls({ layout }: { layout: 'columns' | 'rows' }) {
  const state = useGroups();
  const [error, setError] = useState<string>();
  const frozen = groupStageStarted(state);

  function save() {
    setError(sim.saveComposition());
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-3', layout === 'rows' && 'border-b pb-4')}>
      <label className="grid gap-2">
        <Label htmlFor="prototype-groups">Liczba grup</Label>
        <Select value={String(state.draft.length)} onValueChange={(value) => sim.draw(Number(value))} disabled={frozen}>
          <SelectTrigger id="prototype-groups" className="w-32" aria-label="Liczba grup">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupCountOptions(state.teams.length).map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button type="button" variant="outline" onClick={() => sim.draw(state.draft.length)} disabled={frozen}>
        <Shuffle className="size-4" /> {layout === 'rows' ? 'Wylosuj drużyny' : 'Losuj'}
      </Button>
      <div className="ml-auto flex items-center gap-3">
        {state.draftDirty && <span className="text-xs text-amber-600">Skład niezapisany</span>}
        <Button type="button" onClick={save} disabled={frozen}>
          <Save className="size-4" /> Zapisz skład grup
        </Button>
      </div>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
      {frozen && (
        <p className="w-full text-xs text-muted-foreground">
          Faza ma mecz rozpoczęty, więc skład grup jest zamrożony — liczbę wychodzących zmienia się przy tabeli.
        </p>
      )}
      {!frozen && state.matches.length > 0 && (
        <p className="w-full rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          Zapis składu skasuje terminarz grup ({state.matches.length} {plural(state.matches.length, MATCHES)}), także
          terminy i wyniki.
        </p>
      )}
    </div>
  );
}

/** Select przenoszący drużynę: „bez grupy" albo konkretna grupa. */
function MoveSelect({ teamId, from }: { teamId: number; from?: number }) {
  const state = useGroups();
  return (
    <Select value={NONE} onValueChange={(value) => sim.moveTeam(teamId, value === NONE ? null : Number(value))}>
      <SelectTrigger size="sm" className="w-36" aria-label="Przenieś drużynę do grupy">
        <SelectValue placeholder={from === undefined ? 'Przypisz do grupy' : 'Przenieś'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>bez grupy</SelectItem>
        {groupOptions(state, from).map((option) => (
          <SelectItem key={option.index} value={String(option.index)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QualifiersSelect({ group, index }: { group: Group | { teamIds: number[]; qualifiers: number }; index: number }) {
  const options = Math.max(group.teamIds.length, 1);
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      wychodzi
      <Select value={String(group.qualifiers)} onValueChange={(value) => sim.setQualifiers(index, Number(value))}>
        <SelectTrigger size="sm" className="w-16" aria-label="Ile drużyn wychodzi z grupy">
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

/** Drużyny bez grupy w szkicu — nosi je osobny kafel/pula. */
function UnassignedPool() {
  const state = useGroups();
  const missing = missingFromDraft(state);
  return (
    <div className={cn('rounded-xl border border-dashed p-3', missing.length === 0 && 'opacity-60')}>
      <p className="text-sm font-medium">Bez grupy {missing.length > 0 && `(${missing.length})`}</p>
      <p className="text-xs text-muted-foreground">Zapis składu wymaga grupy dla każdej drużyny.</p>
      <ul className="mt-2 space-y-1">
        {missing.map((team) => (
          <li key={team.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{team.name}</span>
            <MoveSelect teamId={team.id} />
          </li>
        ))}
        {missing.length === 0 && <li className="text-xs text-muted-foreground">Każda drużyna ma grupę.</li>}
      </ul>
    </div>
  );
}

/** Układ kolumnami: kafel na grupę, drużyny w środku (wariant A). */
function ColumnsLayout() {
  const state = useGroups();
  const missing = missingFromDraft(state);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {state.draft.map((group, index) => (
        <div key={index} className="grid content-start gap-3 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <GroupBadge name={group.name} />
            <Input
              aria-label={`Nazwa grupy ${index + 1}`}
              value={group.name}
              onChange={(event) => sim.renameGroup(index, event.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex items-center justify-between">
            <QualifiersSelect group={group} index={index} />
            <span className="text-xs text-muted-foreground">
              {group.teamIds.length} {plural(group.teamIds.length, TEAMS)}
            </span>
          </div>
          <ul className="space-y-1">
            {group.teamIds.map((teamId) => {
              const team = state.teams.find((candidate) => candidate.id === teamId);
              if (!team) return null;
              return (
                <li key={teamId} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate">{team.name}</span>
                  <button
                    type="button"
                    aria-label={`Usuń ${team.name} z grupy`}
                    onClick={() => sim.moveTeam(teamId, null)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
            {group.teamIds.length === 0 && (
              <li className="text-xs text-muted-foreground">Pusta grupa — losuj albo przenieś drużyny ręcznie.</li>
            )}
          </ul>
        </div>
      ))}
      {missing.length > 0 && (
        <div className="grid content-start gap-3 rounded-xl border border-dashed bg-card p-3">
          <GroupBadge name="Bez grupy" />
          <ul className="space-y-1">
            {missing.map((team) => (
              <li key={team.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{team.name}</span>
                <MoveSelect teamId={team.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Układ wierszami: jedna lista drużyn z grupą w kolumnie (warianty B, C). */
function RowsLayout() {
  const state = useGroups();
  const groupOf = (teamId: number) => state.draft.findIndex((group) => group.teamIds.includes(teamId));
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Drużyna</th>
              <th className="px-3 py-2 font-medium">Grupa</th>
            </tr>
          </thead>
          <tbody>
            {state.teams.map((team) => (
              <tr key={team.id} className="border-t">
                <td className="px-3 py-2">{team.name}</td>
                <td className="px-3 py-2">
                  <MoveSelect teamId={team.id} from={groupOf(team.id) === -1 ? undefined : groupOf(team.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid content-start gap-3">
        {state.draft.map((group, index) => (
          <div key={index} className="flex items-center justify-between gap-2 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{group.name}</p>
              <p className="text-xs text-muted-foreground">{group.teamIds.length} {plural(group.teamIds.length, TEAMS)}</p>
            </div>
            <QualifiersSelect group={group} index={index} />
          </div>
        ))}
        <UnassignedPool />
      </div>
    </div>
  );
}

export function CompositionEditor({ layout }: { layout: 'columns' | 'rows' }) {
  return (
    <div className="grid gap-4">
      <EditorControls layout={layout} />
      {layout === 'columns' ? <ColumnsLayout /> : <RowsLayout />}
    </div>
  );
}

/** Odświeżenie terminarza grup po zapisie składu — wspólny toast wariantów. */
export function RegenerateHint() {
  const state = useGroups();
  if (state.matches.length > 0 || state.groups.length === 0) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="size-4" /> Skład jest zapisany — wygeneruj terminarz fazy grupowej.
    </p>
  );
}
