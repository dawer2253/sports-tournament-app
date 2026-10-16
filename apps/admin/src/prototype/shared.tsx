// PROTOTYP (#251) — drobne kawałki wspólne wariantów fazy grupowej. Nie do main.
import {
  Badge,
  FormDialog,
  MatchStatusToggle,
  ScoreInputs,
  cn,
} from '@tournament/ui';
import { TriangleAlert, UserX } from 'lucide-react';
import { useState } from 'react';
import {
  sim,
  standingsFor,
  teamById,
  teamsWithoutGroup,
  useGroups,
  type GMatch,
  type Group,
  type KMatch,
  type MatchStatus,
  type State,
} from './groups-store';
import type { MatchRowData } from '@tournament/ui';

export function groupLetter(order: number): string {
  return 'ABCDEFGH'[order - 1] ?? String(order);
}

/** Plakietka grupy: „Grupa A". */
export function GroupBadge({ name, className }: { name: string; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('shrink-0 font-medium', className)}>
      {name}
    </Badge>
  );
}

/**
 * Drużyna dodana po zapisie składu nie ma grupy (#249): nie stoi w żadnej
 * tabeli, a terminarza fazy grupowej nie da się wygenerować, dopóki organizer
 * nie zapisze składu od nowa.
 */
export function UnassignedTeamsNotice() {
  const state = useGroups();
  const missing = teamsWithoutGroup(state);
  if (missing.length === 0) return null;
  const names = missing.map((team) => team.name).join(', ');
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <UserX aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {missing.length === 1 ? `Drużyna ${names} nie ma grupy.` : `Drużyny ${names} nie mają grupy.`} Zapisz skład grup od
        nowa, żeby wróciła do tabeli i terminarza.
      </p>
    </div>
  );
}

/** Ile meczów grup nie jest rozegrane — ostrzeżenie przed generowaniem drabinki (#250). */
export function UnfinishedGroupsNotice() {
  const state = useGroups();
  const left = state.matches.filter((match) => match.status !== 'finished').length;
  if (left === 0 || state.matches.length === 0) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm"
    >
      <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1">
        {left === 1 ? 'Mecz grup nie jest rozegrany' : `${left} mecze grup nie są rozegrane`}, więc tabele mogą się jeszcze
        zmienić. Drabinkę wolno wygenerować, a rozjazd z tabelami opisze Drabinka.
      </p>
    </div>
  );
}

/**
 * Rozjazd drabinki z tabelami (#250): drużyny w drabince różnią się od czołówki
 * tabel, bo organizer rozstrzygnął remis na linii. Panel liczy to sam,
 * porównując drużyny drabinki z czołowymi `qualifiers` każdej tabeli, i niczego
 * nie zapisuje.
 */
export function DivergenceNotice({ inline }: { inline?: boolean }) {
  const rows = divergenceRows(useGroups());
  if (rows.length === 0) return null;
  const letter = (order: number) => `grupie ${groupLetter(order)}`;
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm',
        !inline && 'mb-4',
      )}
    >
      <TriangleAlert aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        Wyjście z grup różni się od tabel:{' '}
        {rows
          .map(
            (row) =>
              `${row.plays.name} (${row.plays.position}. w ${letter(row.group.order)}) gra zamiast ${row.insteadOf.name} (${row.insteadOf.position}. w ${letter(row.group.order)})`,
          )
          .join('; ')}
        . Wynik grupy wpisany po wygenerowaniu drabinki jej nie rusza.
      </p>
    </div>
  );
}

function divergenceRows(state: State) {
  const inBracket = new Set(
    state.knockout.flatMap((match) => [match.homeId, match.awayId]).filter((id): id is number => id !== null),
  );
  const rows: {
    group: Group;
    plays: { name: string; position: number };
    insteadOf: { name: string; position: number };
  }[] = [];
  for (const group of state.groups) {
    const table = standingsFor(state, group);
    const top = table.slice(0, group.qualifiers);
    const outside = table.slice(group.qualifiers).filter((row) => inBracket.has(row.team.id));
    const missing = top.filter((row) => !inBracket.has(row.team.id));
    missing.forEach((row, index) => {
      const other = outside[index];
      if (other) {
        rows.push({
          group,
          plays: { name: other.team.name, position: other.position },
          insteadOf: { name: row.team.name, position: row.position },
        });
      }
    });
  }
  return rows;
}

/** Mecz drabinki bez obu drużyn czeka na rywali — podpis pustego slotu. */
export function slotLabel(match: KMatch, side: 'home' | 'away'): string | undefined {
  return side === 'home' ? match.homeSource : match.awaySource;
}

/** Mecz fazy grupowej jako wiersz terminarza (`MatchRow` z design systemu). */
export function matchRowData(state: State, match: GMatch): MatchRowData {
  return {
    id: match.id,
    homeTeam: teamById(state, match.homeId),
    awayTeam: teamById(state, match.awayId),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    kickoffAt: match.kickoffAt,
    venue: null,
  };
}

/**
 * Lekkie okno wyniku (#176 w skrócie): wynik i stan, bez terminów i zdarzeń.
 * Prototyp sprawdza tabele grup i rozjazd drabinki, nie samo wpisywanie wyniku.
 */
export function MatchResultDialog({ match, onClose }: { match: GMatch; onClose: () => void }) {
  const state = useGroups();
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [home, setHome] = useState(match.homeScore?.toString() ?? '');
  const [away, setAway] = useState(match.awayScore?.toString() ?? '');
  const [error, setError] = useState<string>();
  const homeName = teamById(state, match.homeId)?.name ?? '?';
  const awayName = teamById(state, match.awayId)?.name ?? '?';

  function changeStatus(next: MatchStatus) {
    setStatus(next);
    if (next === 'scheduled') {
      setHome('');
      setAway('');
    } else {
      setHome((value) => (value === '' ? '0' : value));
      setAway((value) => (value === '' ? '0' : value));
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = { home: home === '' ? null : Number(home), away: away === '' ? null : Number(away) };
        if (status !== 'scheduled' && (parsed.home === null || parsed.away === null)) {
          setError('Wpisz wynik obu drużyn.');
          return;
        }
        if (status !== 'scheduled' && state.sport !== 'basketball' && parsed.home === parsed.away && status === 'finished') {
          setError('Mecz fazy grupowej może skończyć się remisem — tabela grupy to wytrzymuje.');
          return;
        }
        sim.setResult(match.id, parsed.home, parsed.away, status);
        onClose();
      }}
      title={`${homeName} – ${awayName}`}
      description={`${match.roundName} · ${match.roundDates.slice(0, 10)}`}
      submitLabel="Zapisz"
      error={error}
    >
      <div className="flex flex-wrap items-start gap-3">
        <ScoreInputs
          homeValue={home}
          awayValue={away}
          onHomeChange={setHome}
          onAwayChange={setAway}
          homeLabel={`Wynik ${homeName}`}
          awayLabel={`Wynik ${awayName}`}
        />
        <MatchStatusToggle value={status} onChange={changeStatus} />
      </div>
    </FormDialog>
  );
}

