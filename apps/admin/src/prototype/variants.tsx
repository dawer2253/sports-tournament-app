// PROTOTYP (#191) — cztery układy okna meczu ze zdarzeniami. Nie do main.
import type { AdminMatch } from '@tournament/api-client';
import { Button, ConfirmDeleteDialog, Label, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@tournament/ui';
import { ChevronDown, ChevronLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { EVENT_TYPES, ProtoValidationError, roster, useProto, type EventType, type ProtoEvent, type ProtoPlayer, type SportCode } from './events-store';
import {
  EventFormDialog,
  EventLine,
  GateNote,
  MatchDialogFrame,
  MinuteInput,
  MismatchHint,
  PlayerSelect,
  ScheduleFields,
  ScoreBlock,
  TeamToggle,
  TypeSelect,
  eventsGate,
  minuteLabel,
  parseMinute,
  playerLabel,
  typeOf,
  useEventActions,
  useMatchEvents,
  useMatchForm,
  type MatchForm,
} from './shared';

export interface VariantProps {
  match: AdminMatch;
  tournamentId: number;
  sport: SportCode;
  onClose: () => void;
}

function SectionTitle({ children, count }: { children: string; count: number }) {
  return (
    <p className="text-sm font-medium">
      {children} <span className="font-normal text-muted-foreground">· {count}</span>
    </p>
  );
}

// =============================================================================
// A — lista pod wynikiem, formularz w wierszu pod listą
// =============================================================================

export function VariantA({ match, tournamentId, sport, onClose }: VariantProps) {
  const form = useMatchForm(match, sport, onClose);
  const list = useMatchEvents(match);
  const gate = eventsGate(match, form);
  const actions = useEventActions(match, sport);
  const proto = useProto();
  const [editing, setEditing] = useState<ProtoEvent | null>(null);
  const [type, setType] = useState(EVENT_TYPES[sport][0].code);
  const [teamId, setTeamId] = useState<number | null>(match.homeTeam?.id ?? null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [minute, setMinute] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function load(event: ProtoEvent | null) {
    setEditing(event);
    setErrors({});
    setType(event?.type ?? type);
    setTeamId(event?.teamId ?? teamId);
    setPlayerId(event?.playerId ?? null);
    setMinute(event?.minute?.toString() ?? '');
  }

  async function submit() {
    setErrors({});
    const body = { type, teamId: teamId!, playerId, minute: parseMinute(minute) };
    try {
      if (editing) await actions.update(editing.id, body);
      else await actions.create(body);
      // Po dodaniu zostają typ i drużyna — kolejne zdarzenie często jest podobne.
      setPlayerId(null);
      setMinute('');
      setEditing(null);
    } catch (error) {
      if (error instanceof ProtoValidationError) setErrors(error.errors);
    }
  }

  return (
    <MatchDialogFrame match={match} form={form} onClose={onClose} width="sm:max-w-2xl">
      <div className="grid gap-4">
        <ScoreBlock match={match} form={form} />
        <ScheduleFields tournamentId={tournamentId} form={form} />

        <div className="grid gap-2 border-t pt-4">
          <SectionTitle count={list.length}>Zdarzenia</SectionTitle>
          {!gate.open ? (
            <>
              <GateNote>{gate.note}</GateNote>
              {list.length > 0 && <EventList match={match} sport={sport} list={list} />}
            </>
          ) : (
            <>
              {list.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">Brak zdarzeń. Dodaj pierwsze poniżej.</p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {list.map((event) => (
                    <EventLine
                      key={event.id}
                      match={match}
                      sport={sport}
                      event={event}
                      disabled={actions.pending}
                      onEdit={() => load(event)}
                      onDelete={() => void actions.remove(event)}
                    />
                  ))}
                </ul>
              )}
              <MismatchHint match={match} form={form} sport={sport} list={list} />

              <div
                className={cn('grid gap-2 rounded-md border p-2', editing && 'border-primary bg-primary/5')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submit();
                  }
                }}
              >
                {editing && (
                  <p className="text-xs font-medium text-primary">
                    Edytujesz: {minuteLabel(editing.minute)} {typeOf(sport, editing.type)?.label} · {playerLabel(editing.playerId)}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-[9rem_auto]">
                  <TypeSelect sport={sport} value={type} onChange={setType} error={errors.type} />
                  <TeamToggle
                    match={match}
                    value={teamId}
                    onChange={(next) => {
                      setTeamId(next);
                      setPlayerId(null);
                    }}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_5rem_auto]">
                  <PlayerSelect id="proto-a-player" teamId={teamId} value={playerId} onChange={setPlayerId} error={errors.playerId} />
                  <div className="flex gap-1">
                    <MinuteInput value={minute} onChange={setMinute} error={errors.minute} className="flex-1" />
                  </div>
                  <div className="flex gap-1">
                    {editing && (
                      <Button type="button" variant="outline" onClick={() => load(null)}>
                        Anuluj
                      </Button>
                    )}
                    <Button type="button" onClick={() => void submit()} disabled={actions.pending}>
                      {editing ? 'Zapisz zmiany' : <><Plus /> Dodaj</>}
                    </Button>
                  </div>
                </div>
                {form.saved === 'live' && minute === '' && (
                  <button type="button" className="justify-self-start text-xs text-muted-foreground underline" onClick={() => setMinute(String(proto.clock))}>
                    Wstaw bieżącą minutę ({proto.clock}′)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MatchDialogFrame>
  );
}

function EventList({ match, sport, list }: { match: AdminMatch; sport: SportCode; list: ProtoEvent[] }) {
  return (
    <ul className="max-h-56 overflow-y-auto opacity-70">
      {list.map((event) => (
        <EventLine key={event.id} match={match} sport={sport} event={event} />
      ))}
    </ul>
  );
}

// =============================================================================
// B — zakładki „Mecz” | „Zdarzenia”, dodawanie i edycja w pod-oknie
// =============================================================================

export function VariantB({ match, tournamentId, sport, onClose }: VariantProps) {
  const form = useMatchForm(match, sport, onClose);
  const list = useMatchEvents(match);
  const gate = eventsGate(match, form);
  const actions = useEventActions(match, sport);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProtoEvent | null>(null);
  const [deleting, setDeleting] = useState<ProtoEvent | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const shown = newestFirst ? [...list].reverse() : list;

  return (
    <MatchDialogFrame match={match} form={form} onClose={onClose} width="sm:max-w-lg">
      <Tabs defaultValue={form.saved === 'scheduled' ? 'match' : 'events'}>
        <TabsList className="w-full">
          <TabsTrigger value="match">Mecz</TabsTrigger>
          <TabsTrigger value="events">Zdarzenia · {list.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="match" className="grid gap-4 pt-3">
          <ScoreBlock match={match} form={form} />
          <ScheduleFields tournamentId={tournamentId} form={form} />
        </TabsContent>
        <TabsContent value="events" className="grid gap-3 pt-3">
          {/* Wynik zostaje na widoku także tutaj, żeby przy stoliku nie przeskakiwać zakładek. */}
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium tabular-nums">
              Wynik {form.homeScore || '–'} : {form.awayScore || '–'}
            </span>
            <Button type="button" size="sm" onClick={() => setAdding(true)} disabled={!gate.open}>
              <Plus /> Dodaj zdarzenie
            </Button>
          </div>
          {!gate.open && <GateNote>{gate.note}</GateNote>}
          <MismatchHint match={match} form={form} sport={sport} list={list} />
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Brak zdarzeń.</p>
          ) : (
            <>
              <button type="button" className="justify-self-end text-xs text-muted-foreground underline" onClick={() => setNewestFirst(!newestFirst)}>
                {newestFirst ? 'Najnowsze u góry' : 'Chronologicznie'} — zmień
              </button>
              <ul className="max-h-80 overflow-y-auto">
                {shown.map((event) => (
                  <EventLine
                    key={event.id}
                    match={match}
                    sport={sport}
                    event={event}
                    disabled={!gate.open}
                    onEdit={gate.open ? () => setEditing(event) : undefined}
                    onDelete={gate.open ? () => setDeleting(event) : undefined}
                  />
                ))}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>
      {(adding || editing) && (
        <EventFormDialog
          match={match}
          sport={sport}
          event={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          entity="zdarzenie"
          name={`${minuteLabel(deleting.minute)} ${typeOf(sport, deleting.type)?.label} · ${playerLabel(deleting.playerId)}`}
          pending={actions.pending}
          onConfirm={() => void actions.remove(deleting).then(() => setDeleting(null))}
        />
      )}
    </MatchDialogFrame>
  );
}

// =============================================================================
// C — stolik: przyciski typów przy każdej drużynie, potem siatka zawodników
// =============================================================================

export function VariantC({ match, tournamentId, sport, onClose }: VariantProps) {
  const form = useMatchForm(match, sport, onClose);
  const list = useMatchEvents(match);
  const gate = eventsGate(match, form);
  const actions = useEventActions(match, sport);
  const proto = useProto();
  const [picking, setPicking] = useState<{ teamId: number; type: EventType } | null>(null);
  const [minute, setMinute] = useState('');
  const [editing, setEditing] = useState<ProtoEvent | null>(null);
  const [more, setMore] = useState(false);
  const teams = [match.homeTeam, match.awayTeam].filter((team) => team !== null);

  function startPick(teamId: number, type: EventType) {
    setPicking({ teamId, type });
    setMinute(form.saved === 'live' ? String(proto.clock) : '');
  }

  async function pick(player: ProtoPlayer | null) {
    if (!picking) return;
    try {
      await actions.create({ type: picking.type.code, teamId: picking.teamId, playerId: player?.id ?? null, minute: parseMinute(minute) });
      setPicking(null);
    } catch {
      /* błąd pola pokazuje toast; prototyp nie sadza go w siatce */
    }
  }

  return (
    <MatchDialogFrame match={match} form={form} onClose={onClose} width="sm:max-w-3xl">
      <div className="grid gap-3">
        <ScoreBlock match={match} form={form} compact />
        <button type="button" className="flex items-center gap-1 justify-self-start text-sm text-muted-foreground" onClick={() => setMore(!more)}>
          <ChevronDown className={cn('size-4 transition-transform', !more && '-rotate-90')} /> Termin i obiekt
        </button>
        {more && <ScheduleFields tournamentId={tournamentId} form={form} />}

        {!gate.open ? (
          <GateNote>{gate.note}</GateNote>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <div key={team.id} className="grid content-start gap-2 rounded-lg border p-3">
                <p className="truncate text-sm font-semibold">{team.name}</p>
                {picking?.teamId === team.id ? (
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Wróć" onClick={() => setPicking(null)}>
                        <ChevronLeft />
                      </Button>
                      <span className="text-sm font-medium">
                        {picking.type.glyph} {picking.type.label} — kto?
                      </span>
                      <MinuteInput value={minute} onChange={setMinute} className="ml-auto w-16" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {roster(team.id).map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          disabled={actions.pending}
                          onClick={() => void pick(player)}
                          className="grid min-h-14 place-items-center rounded-md border px-1 py-1.5 text-center hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                        >
                          <span className="text-lg font-bold leading-none tabular-nums">{player.number ?? '—'}</span>
                          <span className="line-clamp-1 text-[11px] text-muted-foreground">{player.name.split(' ').at(-1)}</span>
                        </button>
                      ))}
                    </div>
                    {!picking.type.hasPlayer && (
                      <Button type="button" variant="outline" onClick={() => void pick(null)}>
                        Bez zawodnika
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {EVENT_TYPES[sport].map((type) => (
                      <Button
                        key={type.code}
                        type="button"
                        variant={type.stat === 'goals' || type.stat === 'points' ? 'default' : 'outline'}
                        className="h-11 justify-start"
                        disabled={picking !== null}
                        onClick={() => startPick(team.id, type)}
                      >
                        <span aria-hidden>{type.glyph}</span> {type.short}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <MismatchHint match={match} form={form} sport={sport} list={list} />
        <Timeline match={match} sport={sport} list={list} onEdit={gate.open ? setEditing : undefined} />
      </div>
      {editing && <EventFormDialog match={match} sport={sport} event={editing} onClose={() => setEditing(null)} />}
    </MatchDialogFrame>
  );
}

/** Oś meczu jak w relacji: gospodarz z lewej, gość z prawej, minuta pośrodku. */
function Timeline({
  match,
  sport,
  list,
  onEdit,
}: {
  match: AdminMatch;
  sport: SportCode;
  list: ProtoEvent[];
  onEdit?: (event: ProtoEvent) => void;
}) {
  if (list.length === 0) return <p className="py-2 text-center text-sm text-muted-foreground">Brak zdarzeń.</p>;
  return (
    <div className="max-h-64 overflow-y-auto border-t pt-2">
      <ol className="grid gap-0.5">
        {list.map((event) => {
          const type = typeOf(sport, event.type);
          const home = event.teamId === match.homeTeam?.id;
          const cell = (
            <button
              type="button"
              disabled={!onEdit}
              onClick={() => onEdit?.(event)}
              className={cn('truncate rounded px-1.5 py-0.5 text-sm hover:bg-muted', home ? 'text-right' : 'text-left')}
              title={onEdit ? 'Edytuj albo usuń' : undefined}
            >
              {home ? (
                <>
                  {playerLabel(event.playerId)} <span aria-hidden>{type?.glyph}</span>
                </>
              ) : (
                <>
                  <span aria-hidden>{type?.glyph}</span> {playerLabel(event.playerId)}
                </>
              )}
              {type?.stat === null && <span className="text-xs text-muted-foreground"> (nie liczy się)</span>}
            </button>
          );
          return (
            <li key={event.id} className="grid grid-cols-[1fr_3rem_1fr] items-center">
              {home ? cell : <span />}
              <span className="text-center font-mono text-xs tabular-nums text-muted-foreground">{minuteLabel(event.minute)}</span>
              {home ? <span /> : cell}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// =============================================================================
// D — składy obu drużyn; klik w zawodnika rozwija jego typy zdarzeń
// =============================================================================

export function VariantD({ match, tournamentId, sport, onClose }: VariantProps) {
  const form = useMatchForm(match, sport, onClose);
  const list = useMatchEvents(match);
  const gate = eventsGate(match, form);
  const actions = useEventActions(match, sport);
  const proto = useProto();
  const [open, setOpen] = useState<number | null>(null);
  const [minute, setMinute] = useState('');
  const [editing, setEditing] = useState<ProtoEvent | null>(null);
  const [tab, setTab] = useState<'squads' | 'match'>('squads');
  const teams = [match.homeTeam, match.awayTeam].filter((team) => team !== null);

  function toggle(player: ProtoPlayer) {
    setOpen(open === player.id ? null : player.id);
    setMinute(form.saved === 'live' ? String(proto.clock) : '');
  }

  async function add(player: ProtoPlayer, type: EventType) {
    try {
      await actions.create({ type: type.code, teamId: player.teamId, playerId: player.id, minute: parseMinute(minute) });
      setOpen(null);
    } catch {
      /* toast */
    }
  }

  return (
    <MatchDialogFrame match={match} form={form} onClose={onClose} width="sm:max-w-4xl">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ScoreBlock match={match} form={form} compact />
          <div className="ml-auto inline-flex rounded-md border p-0.5 text-sm">
            {(
              [
                ['squads', 'Składy i zdarzenia'],
                ['match', 'Termin i obiekt'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn('rounded px-2.5 py-1', tab === key ? 'bg-muted font-medium' : '')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'match' ? (
          <ScheduleFields tournamentId={tournamentId} form={form} />
        ) : (
          <>
            {!gate.open && <GateNote>{gate.note}</GateNote>}
            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((team) => (
                <div key={team.id} className="grid content-start rounded-lg border">
                  <p className="border-b px-3 py-2 text-sm font-semibold">{team.name}</p>
                  <ul className="max-h-80 overflow-y-auto">
                    {roster(team.id).map((player) => {
                      const own = list.filter((event) => event.playerId === player.id);
                      const expanded = open === player.id;
                      return (
                        <li key={player.id} className={cn('border-b last:border-0', expanded && 'bg-primary/5')}>
                          <button
                            type="button"
                            disabled={!gate.open}
                            onClick={() => toggle(player)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:hover:bg-transparent"
                          >
                            <span className="w-6 text-right font-mono tabular-nums text-muted-foreground">{player.number ?? '—'}</span>
                            <span className="min-w-0 flex-1 truncate">{player.name}</span>
                            <PlayerTally sport={sport} events={own} />
                          </button>
                          {expanded && (
                            <div className="grid gap-2 px-3 pb-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {EVENT_TYPES[sport].map((type) => (
                                  <Button key={type.code} type="button" size="sm" variant="outline" disabled={actions.pending} onClick={() => void add(player, type)}>
                                    <span aria-hidden>{type.glyph}</span> {type.short}
                                  </Button>
                                ))}
                                <Label className="ml-auto text-xs text-muted-foreground">
                                  min
                                  <MinuteInput value={minute} onChange={setMinute} className="w-14" />
                                </Label>
                              </div>
                              {own.length > 0 && (
                                <ul>
                                  {own.map((event) => (
                                    <EventLine
                                      key={event.id}
                                      match={match}
                                      sport={sport}
                                      event={event}
                                      showTeam={false}
                                      disabled={actions.pending}
                                      onEdit={() => setEditing(event)}
                                      onDelete={() => void actions.remove(event)}
                                    />
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <MismatchHint match={match} form={form} sport={sport} list={list} />
            {list.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t pt-2">
                {list.map((event) => {
                  const type = typeOf(sport, event.type);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      disabled={!gate.open}
                      onClick={() => setEditing(event)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs hover:bg-muted',
                        event.teamId === match.awayTeam?.id && 'border-dashed',
                      )}
                    >
                      {minuteLabel(event.minute)} {type?.glyph} {playerLabel(event.playerId).replace(/^\d+\. /, '')}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {editing && <EventFormDialog match={match} sport={sport} event={editing} onClose={() => setEditing(null)} />}
    </MatchDialogFrame>
  );
}

function PlayerTally({ sport, events }: { sport: SportCode; events: ProtoEvent[] }) {
  if (events.length === 0) return null;
  if (sport === 'basketball') {
    const points = events.reduce((sum, event) => {
      const type = typeOf(sport, event.type);
      return sum + (type?.stat === 'points' ? type.value : 0);
    }, 0);
    const fouls = events.filter((event) => event.type === 'foul').length;
    return (
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {points} pkt{fouls > 0 && ` · ${fouls} F`}
      </span>
    );
  }
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  return (
    <span className="shrink-0 text-xs">
      {[...counts].map(([code, count]) => (
        <span key={code} className="ml-1">
          {typeOf(sport, code)?.glyph}
          {count > 1 && <sup>{count}</sup>}
        </span>
      ))}
    </span>
  );
}

export type { MatchForm };
