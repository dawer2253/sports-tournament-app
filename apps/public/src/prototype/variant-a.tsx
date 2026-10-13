// PROTOTYP (#218) — wariant A: runda po rundzie. Lista meczów wybranej rundy na
// `BracketMatchRow` z panelu (#227), mecze w parach z podpisem, gdzie spotkają
// się zwycięzcy. Bez drzewa, więc nic nie wystaje w bok. Nie do main.
import { BracketChampion, BracketMatchRow, Button, Input, cn, type BracketMatchRowData } from '@tournament/ui';
import { Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { roundDates, teamPath, winnerSide, type ProtoBracket, type ProtoMatch, type ProtoRound, type Slot } from './demo';
import { LiveDot, matchPath } from './shared';

function rowData(match: ProtoMatch): BracketMatchRowData {
  return {
    id: match.id,
    label: match.label,
    kickoffAt: match.kickoffAt,
    status: match.status,
    home: { team: match.homeTeam, source: match.homeSource },
    away: { team: match.awayTeam, source: match.awaySource },
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homePenalties: match.homePenalties,
    awayPenalties: match.awayPenalties,
    // „Zwycięzca → …” mówi podpis pary, w wierszu zostaje tylko krawędź przegranego.
    loserTo: match.loserToMatchId !== null ? 'o 3. miejsce' : undefined,
  };
}

function Row({ match }: { match: ProtoMatch }) {
  const navigate = useNavigate();
  return <BracketMatchRow match={rowData(match)} onSelect={() => void navigate(matchPath(match.id))} />;
}

function SlotRow({ slot }: { slot: Slot }) {
  if (slot.kind === 'match') return <Row match={slot.match} />;
  return (
    <div className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{slot.team.name}</span> ma wolny los i zaczyna od meczu {slot.target.label}.
    </div>
  );
}

function RoundPicker({ bracket, value, onChange }: { bracket: ProtoBracket; value: number; onChange: (order: number) => void }) {
  const rounds = bracket.rounds;
  const live = (round: ProtoRound) => [...round.matches, ...(round.third ? [round.third] : [])].some((m) => m.status === 'live');
  return (
    <>
      {/* Telefon: jedna linia ze strzałkami i listą wyboru, bez paska przewijanego w bok. */}
      <div className="flex items-center gap-2 sm:hidden">
        <Button variant="outline" size="icon-lg" aria-label="Poprzednia runda" disabled={value === 1} onClick={() => onChange(value - 1)}>
          <ChevronLeft />
        </Button>
        <select
          aria-label="Runda"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 min-w-0 flex-1 rounded-md border bg-card px-3 text-sm font-medium"
        >
          {rounds.map((round) => (
            <option key={round.order} value={round.order}>
              {round.name}: {round.finished} z {round.total} rozegranych
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Następna runda"
          disabled={value === rounds.length}
          onClick={() => onChange(value + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      {/* Komputer: wszystkie rundy naraz, zawijane. */}
      <div role="tablist" aria-label="Rundy" className="hidden flex-wrap gap-2 sm:flex">
        {rounds.map((round) => {
          const active = round.order === value;
          const done = round.finished === round.total;
          return (
            <button
              key={round.order}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(round.order)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-sm',
                active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                {round.name}
                {live(round) && <LiveDot />}
              </span>
              <span className={cn('flex items-center gap-1 text-xs tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {done && <Check className="size-3" />}
                {round.finished}/{round.total}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const PAIRS_COLLAPSED = 6;

function RoundView({ bracket, round }: { bracket: ProtoBracket; round: ProtoRound }) {
  const [expanded, setExpanded] = useState(false);
  const final = round.order === bracket.rounds.length;
  const next = bracket.rounds[round.order];
  const pairs: Slot[][] = [];
  for (let i = 0; i < round.slots.length; i += 2) pairs.push(round.slots.slice(i, i + 2));
  const visible = expanded ? pairs : pairs.slice(0, PAIRS_COLLAPSED);
  const byeCount = round.slots.filter((slot) => slot.kind === 'bye').length;

  return (
    <section aria-label={round.name} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">{round.name}</h2>
        <p className="text-sm text-muted-foreground">
          {roundDates(round)}, {round.finished} z {round.total} rozegranych
        </p>
      </div>
      {byeCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {byeCount} najwyżej rozstawionych drużyn ma wolny los i zaczyna od {next?.name}.
        </p>
      )}

      {final ? (
        <div className="space-y-3">
          {bracket.champion && <BracketChampion team={bracket.champion} />}
          <Row match={round.matches[0]} />
          {round.third && (
            <>
              <h3 className="pt-2 text-sm font-medium text-muted-foreground">Mecz o 3. miejsce</h3>
              <Row match={round.third} />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((pair, i) => {
            const target = next.slots[pairs.indexOf(pair)];
            const targetMatch = target.kind === 'match' ? target.match : null;
            return (
              <div key={i} className="space-y-2 rounded-2xl border border-dashed bg-muted/20 p-2">
                {pair.map((slot, j) => (
                  <SlotRow key={j} slot={slot} />
                ))}
                {targetMatch && (
                  <p className="px-1 text-xs text-muted-foreground">
                    Zwycięzcy grają dalej w meczu <span className="font-medium text-foreground">{targetMatch.label}</span>
                  </p>
                )}
              </div>
            );
          })}
          {pairs.length > PAIRS_COLLAPSED && (
            <Button variant="outline" className="w-full" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Zwiń' : `Pokaż wszystkie mecze rundy (${round.matches.length})`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function TeamSearch({ bracket, query }: { bracket: ProtoBracket; query: string }) {
  const needle = query.trim().toLocaleLowerCase('pl');
  const teams = bracket.teams.filter((team) => team.name.toLocaleLowerCase('pl').includes(needle)).slice(0, 4);
  if (teams.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nie ma drużyny „{query}”.</p>;

  return (
    <div className="space-y-6">
      {teams.map((team) => {
        const path = teamPath(bracket, team.id);
        const lost = path.find((m) => !m.third && winnerSide(m) !== null && (winnerSide(m) === 'home' ? m.awayTeam : m.homeTeam)?.id === team.id);
        const status = bracket.champion?.id === team.id ? 'Zwycięzca pucharu' : lost ? `Odpadli: ${lost.label}` : 'W grze';
        return (
          <section key={team.id} aria-label={team.name} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="truncate font-semibold">{team.name}</h2>
              <span className={cn('shrink-0 text-xs', lost ? 'text-muted-foreground' : 'font-medium text-primary')}>{status}</span>
            </div>
            {bracket.byes.some((bye) => bye.team.id === team.id) && <p className="text-xs text-muted-foreground">Wolny los w 1. rundzie.</p>}
            {path.map((match) => (
              <Row key={match.id} match={match} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function VariantA({ bracket }: { bracket: ProtoBracket }) {
  const [params, setParams] = useSearchParams();
  const order = Number(params.get('runda')) || bracket.currentOrder;
  const round = bracket.rounds[Math.min(order, bracket.rounds.length) - 1];
  const query = params.get('druzyna') ?? '';

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <RoundPicker bracket={bracket} value={round.order} onChange={(value) => set('runda', String(value))} />
        <label className="relative block">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Znajdź drużynę</span>
          <Input value={query} onChange={(e) => set('druzyna', e.target.value)} placeholder="Znajdź drużynę i jej mecze" className="bg-card pl-9" />
        </label>
      </div>
      {query.trim().length >= 2 ? <TeamSearch bracket={bracket} query={query} /> : <RoundView key={round.order} bracket={bracket} round={round} />}
    </div>
  );
}
