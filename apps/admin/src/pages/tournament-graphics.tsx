import type { AdminMatch, StandingTable, StatLeaderboard, TeamSummary, Tournament } from '@tournament/api-client';
import {
  Button,
  Card,
  CardContent,
  ChoiceCards,
  EmptyState,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Skeleton,
  toast,
} from '@tournament/ui';
import {
  SOCIAL_GRAPHIC_KINDS,
  SocialGraphic,
  formatKickoff,
  type GraphicTeam,
  type SocialGraphicContent,
  type SocialGraphicFormat,
  type SocialGraphicKind,
} from '@tournament/ui/public';
import { Download, Share2, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { canSharePng, downloadFile, renderGraphicFile } from '../lib/graphic-export';
import { useLeaderboard, useLogoDataUrls, useTournamentMatches, type LogoSource } from '../lib/graphic-queries';
import {
  defaultPreviewMatch,
  defaultResultMatch,
  graphicKindReasons,
  matchScorers,
  previewMatches,
  readGraphicParams,
  resultMatches,
  standingsCaption,
  standingsWarning,
} from '../lib/graphics';
import { useEventTypes, useMatchEvents } from '../lib/match-event-queries';
import { useStandings } from '../lib/standings-queries';
import { useTournament } from './tournament-layout';

const SHARE_FAILED = 'Nie udało się udostępnić grafiki. Pobierz PNG i dodaj go ręcznie.';
const RENDER_FAILED = 'Nie udało się przygotować pliku PNG.';

/** Rodzaj w nazwie pliku. */
const KIND_SLUG: Record<SocialGraphicKind, string> = {
  matchPreview: 'zapowiedz',
  matchResult: 'wynik',
  standings: 'tabela',
  leaderboard: 'klasyfikacja',
};

const FORMAT_OPTIONS: { value: SocialGraphicFormat; label: string; description: string }[] = [
  { value: '4:5', label: '4:5', description: 'Post w kanale, 1440 × 1800' },
  { value: '9:16', label: '9:16', description: 'Relacja, 1440 × 2560' },
];

/**
 * Zakładka „Grafiki” (#333, rozstrzygnięcia #321–#325): organizator wybiera
 * rodzaj, mecz i format, widzi podgląd w barwach turnieju i dostaje plik PNG
 * do pobrania albo udostępnienia. Dostępna we wszystkich statusach turnieju,
 * także w szkicu.
 */
export function TournamentGraphicsPage() {
  const tournament = useTournament();
  const matches = useTournamentMatches(tournament.id);
  const standings = useStandings(tournament.id);
  const leaderboard = useLeaderboard(tournament.id);
  const queries = [matches, standings, leaderboard];

  if (queries.some((query) => query.isError)) {
    return (
      <EmptyState
        variant="error"
        title="Nie udało się wczytać danych do grafiki"
        description="Sprawdź połączenie i spróbuj ponownie."
        action={
          <Button variant="outline" onClick={() => queries.filter((query) => query.isError).forEach((query) => void query.refetch())}>
            Spróbuj ponownie
          </Button>
        }
      />
    );
  }

  if (!matches.data || !standings.data || !leaderboard.data) {
    return (
      <Card aria-busy="true" aria-label="Wczytywanie grafik">
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-[450px] w-[360px]" />
        </CardContent>
      </Card>
    );
  }

  return <GraphicsSection tournament={tournament} matches={matches.data} tables={standings.data} leaderboard={leaderboard.data} />;
}

function matchTitle(match: AdminMatch): string {
  return `${match.homeTeam?.name ?? '?'} – ${match.awayTeam?.name ?? '?'}`;
}

/** Mecze pogrupowane po kolejce albo rundzie, w kolejności listy (#322 pkt 2). */
function byRound(matches: readonly AdminMatch[]): { key: string; name: string; matches: AdminMatch[] }[] {
  const groups: { key: string; name: string; matches: AdminMatch[] }[] = [];
  for (const match of matches) {
    const key = `${match.stageId}:${match.round.id}`;
    const last = groups.at(-1);
    if (last?.key === key) last.matches.push(match);
    else groups.push({ key, name: match.round.name, matches: [match] });
  }
  return groups;
}

function GraphicsSection({
  tournament,
  matches,
  tables,
  leaderboard,
}: {
  tournament: Tournament;
  matches: AdminMatch[];
  tables: StandingTable[];
  leaderboard: StatLeaderboard;
}) {
  const [search, setSearch] = useSearchParams();
  // „Teraz” na czas wizyty: domyślna zapowiedź nie skacze między renderami.
  const [now] = useState(() => new Date());
  const reasons = useMemo(
    () => graphicKindReasons({ matches, tablesCount: tables.length, leaderboard: { label: leaderboard.label, rows: leaderboard.rows.length } }),
    [matches, tables.length, leaderboard],
  );
  const params = readGraphicParams(search, reasons);
  const { kind, format } = params;
  const available = reasons[kind] === null;

  const list = kind === 'matchPreview' ? previewMatches(matches) : kind === 'matchResult' ? resultMatches(matches) : [];
  const selected =
    list.find((match) => match.id === params.matchId) ??
    (kind === 'matchPreview' ? defaultPreviewMatch(list, now) : kind === 'matchResult' ? defaultResultMatch(list) : undefined);

  // Adres zawsze opisuje to, co widać: błędne wartości wracają do domyślnych (#325).
  const canonical = useMemo(() => {
    const next = new URLSearchParams({ kind });
    if (selected) next.set('match', String(selected.id));
    next.set('format', format);
    return next.toString();
  }, [kind, selected, format]);
  useEffect(() => {
    if (search.toString() !== canonical) setSearch(new URLSearchParams(canonical), { replace: true });
  }, [canonical, search, setSearch]);

  function choose(patch: { kind?: SocialGraphicKind; matchId?: number; format?: SocialGraphicFormat }) {
    const next = new URLSearchParams({ kind: patch.kind ?? kind });
    // Nowy rodzaj ma własną listę meczów, więc mecz wraca do domyślnego.
    const matchId = patch.kind ? undefined : (patch.matchId ?? selected?.id);
    if (matchId !== undefined) next.set('match', String(matchId));
    next.set('format', patch.format ?? format);
    setSearch(next, { replace: true });
  }

  const { types, scoringStat } = useEventTypes(tournament.sport.code);
  const needsEvents = kind === 'matchResult' && selected !== undefined && tournament.sport.code === 'football';
  const events = useMatchEvents(selected?.id ?? 0, needsEvents);

  const table = tables.length === 1 ? tables[0]! : undefined;
  const caption = useMemo(
    () => (table ? standingsCaption(matches.filter((match) => match.stageId === table.stageId)) : null),
    [matches, table],
  );

  const logoSources = useMemo<LogoSource[]>(() => {
    const teams: TeamSummary[] =
      kind === 'standings'
        ? (table?.rows.map((row) => row.team) ?? [])
        : kind === 'leaderboard'
          ? leaderboard.rows.map((row) => row.team)
          : [selected?.homeTeam, selected?.awayTeam].filter((team): team is TeamSummary => Boolean(team));
    const unique = [...new Map(teams.map((team) => [team.id, team])).values()];
    return [
      { owner: 'tournament', id: tournament.id, logoUrl: tournament.branding.logoUrl },
      ...unique.map((team): LogoSource => ({ owner: 'team', id: team.id, logoUrl: team.logoUrl })),
    ];
  }, [kind, table, leaderboard, selected, tournament]);
  const logos = useLogoDataUrls(logoSources);

  const team = (summary: TeamSummary | null): GraphicTeam => ({
    name: summary?.name ?? '?',
    logoUrl: summary ? logos.url({ owner: 'team', id: summary.id }) : null,
  });

  const content = available
    ? buildContent({ kind, selected, table, caption, leaderboard, team, scorers: () => {
        if (!needsEvents || !selected || !events.data) return null;
        return matchScorers(events.data, selected.homeTeam!.id, { code: tournament.sport.code, eventTypes: types ?? [], scoringStat });
      } })
    : null;
  const graphicTournament = {
    name: tournament.name,
    logoUrl: logos.url({ owner: 'tournament', id: tournament.id }),
    primaryColor: tournament.branding.primaryColor,
  };
  // Eksport czeka na herby, zdarzenia i typy zdarzeń, żeby nie złapać stanu pośredniego.
  const contentReady = logos.ready && (!needsEvents || (!events.isPending && types !== undefined));

  const fileName = `grafika-${tournament.slug}-${KIND_SLUG[kind]}-${format.replace(':', 'x')}.png`;
  const renderKey = JSON.stringify({ content, graphicTournament, format, fileName });
  const exported = useGraphicFile(renderKey, fileName, contentReady && content !== null);

  const canShare = useMemo(() => canSharePng(), []);
  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: tournament.name });
    } catch (error) {
      // Organizator zamknął arkusz: to nie błąd (#325).
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(SHARE_FAILED);
    }
  }

  const matchFieldId = useId();
  const warning = kind === 'standings' && caption ? standingsWarning(caption) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <Card>
        <CardContent className="space-y-6">
          <ChoiceCards
            legend="Rodzaj grafiki"
            name="graphic-kind"
            className="lg:grid-cols-2"
            options={SOCIAL_GRAPHIC_KINDS.map(({ kind: value, label }) => ({
              value,
              label,
              description: reasons[value] ?? undefined,
              disabled: reasons[value] !== null,
            }))}
            value={available ? kind : null}
            onChange={(next) => choose({ kind: next })}
          />

          {list.length > 0 && selected && (
            <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-2">
              <Label id={matchFieldId}>Mecz</Label>
              <Select value={String(selected.id)} onValueChange={(value) => choose({ matchId: Number(value) })}>
                <SelectTrigger aria-labelledby={matchFieldId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {byRound(list).map((group) => (
                    <SelectGroup key={group.key}>
                      <SelectLabel>{group.name}</SelectLabel>
                      {group.matches.map((match) => (
                        <SelectItem key={match.id} value={String(match.id)}>
                          {matchTitle(match)}
                          {match.kickoffAt !== null && <span className="text-muted-foreground"> · {formatKickoff(match.kickoffAt)}</span>}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ChoiceCards
            legend="Format"
            name="graphic-format"
            className="lg:grid-cols-2"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={(next) => choose({ format: next })}
          />
        </CardContent>
      </Card>

      <section aria-label="Podgląd" className="space-y-3">
        {content ? (
          <>
            <SocialGraphic ref={exported.node} tournament={graphicTournament} format={format} content={content} />
            {warning && (
              <p role="status" className="flex max-w-[360px] items-start gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {warning}
              </p>
            )}
            {exported.failed && (
              <p role="alert" className="max-w-[360px] text-sm text-destructive">
                {RENDER_FAILED}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {canShare && (
                <Button disabled={!exported.file} onClick={() => exported.file && void share(exported.file)}>
                  <Share2 aria-hidden className="size-4" />
                  Udostępnij
                </Button>
              )}
              <Button
                variant={canShare ? 'outline' : 'default'}
                disabled={!exported.file}
                onClick={() => exported.file && downloadFile(exported.file)}
              >
                <Download aria-hidden className="size-4" />
                Pobierz PNG
              </Button>
            </div>
          </>
        ) : (
          <EmptyState title="Nie ma jeszcze z czego zrobić grafiki" description="Każdy rodzaj potrzebuje danych, których ten turniej jeszcze nie ma." />
        )}
      </section>
    </div>
  );
}

function buildContent({
  kind,
  selected,
  table,
  caption,
  leaderboard,
  team,
  scorers,
}: {
  kind: SocialGraphicKind;
  selected: AdminMatch | undefined;
  table: StandingTable | undefined;
  caption: ReturnType<typeof standingsCaption> | null;
  leaderboard: StatLeaderboard;
  team: (summary: TeamSummary | null) => GraphicTeam;
  scorers: () => ReturnType<typeof matchScorers>;
}): SocialGraphicContent | null {
  switch (kind) {
    case 'matchPreview':
      return selected
        ? {
            kind,
            data: {
              roundName: selected.round.name,
              kickoffAt: selected.kickoffAt!,
              venue: selected.venue?.name ?? null,
              home: team(selected.homeTeam),
              away: team(selected.awayTeam),
            },
          }
        : null;
    case 'matchResult':
      return selected
        ? {
            kind,
            data: {
              roundName: selected.round.name,
              home: team(selected.homeTeam),
              away: team(selected.awayTeam),
              homeScore: selected.homeScore ?? 0,
              awayScore: selected.awayScore ?? 0,
              sets: selected.sets,
              penalties:
                selected.homePenalties !== null && selected.awayPenalties !== null
                  ? { home: selected.homePenalties, away: selected.awayPenalties }
                  : null,
              scorers: scorers(),
            },
          }
        : null;
    case 'standings':
      return table && caption
        ? {
            kind,
            data: {
              afterRound: caption.afterRound,
              scoreLabel: table.scoreLabel,
              rows: table.rows.map((row) => ({
                position: row.position,
                team: team(row.team),
                played: row.played,
                scoreFor: row.scoreFor,
                scoreAgainst: row.scoreAgainst,
                points: row.points,
              })),
            },
          }
        : null;
    case 'leaderboard':
      return {
        kind,
        data: {
          label: leaderboard.label,
          rows: leaderboard.rows.map((row) => ({ position: row.position, player: row.player.name, team: team(row.team), value: row.value })),
        },
      };
  }
}

/**
 * PNG renderowany przy podglądzie, nie w kliknięciu: arkusz udostępniania
 * wymaga gestu użytkownika, a render trwa dłużej, niż przeglądarka czeka
 * (#321 §9). Każda zmiana grafiki (`key`) unieważnia plik, więc do nowego
 * pliku oba przyciski są nieaktywne.
 */
function useGraphicFile(key: string, fileName: string, ready: boolean) {
  const node = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{ key: string; file: File | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!ready || !node.current) return;
    let cancelled = false;
    renderGraphicFile(node.current, fileName).then(
      (file) => !cancelled && setResult({ key, file, failed: false }),
      () => !cancelled && setResult({ key, file: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, fileName, ready]);
  const current = result?.key === key ? result : null;
  return { node, file: current?.file ?? null, failed: current?.failed ?? false };
}

