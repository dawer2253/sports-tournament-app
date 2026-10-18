/**
 * PROTOTYP S7 (#288) — strona meczu w trzech wariantach:
 * - A „Tablica”: wielka tablica wyniku z herbami i strzelcami, pod nią
 *   relacja jedną kolumną po częściach meczu;
 * - B „Oś”: wąski pas wyniku i oś czasu z minutą na środku, gospodarz
 *   z lewej, gość z prawej, części jako znaczniki na osi;
 * - C „Relacja z panelem”: tablica jak w A, ale niższa; relacja obok
 *   panelu z przebiegiem części, strzelcami, danymi meczu i innymi meczami kolejki.
 *
 * Zostaje z #210: powrót według stanu meczu, części z wynikiem, „Bez
 * minuty” na końcu, na żywo najnowsze u góry, przy ponad 20 zdarzeniach
 * (kosz) części startują zwinięte.
 */
import type * as React from 'react'
import { EventIcon } from '../../../components/data/event-icon'
import type { MatchPageData, MatchRelationEvent, MatchRelationPeriod } from '../../../components/data/match-page-data'
import { formatKickoff, formatMatchDay } from '../../../lib/kickoff'
import { cn } from '../../../lib/utils'
import { Crest, DeadLink, LiveTag } from '../parts'
import { BackTo, Shell } from './kit'
import { scorerText } from './match-bits'
import type { Season } from './screen-demo'

export const MATCH_VARIANTS = { A: 'Tablica', B: 'Oś', C: 'Relacja z panelem' } as const
export type MatchVariant = keyof typeof MATCH_VARIANTS

/** Jak `RELATION_COLLAPSE_THRESHOLD` z `match-relation.tsx`; bez importu, bo moduł ciągnie `components/ui`. */
const RELATION_COLLAPSE_THRESHOLD = 20

type Group = { key: string; label: string; score: string | null; events: MatchRelationEvent[] }

/** Części w kolejności ekranu, jak `relationGroups` w `match-relation.tsx`. */
function groupsOf(match: MatchPageData): Group[] {
  const live = match.status === 'live'
  const order = <T,>(items: T[]) => (live ? items.toReversed() : items)
  const groups: Group[] = order(match.periods).map((period: MatchRelationPeriod) => ({
    key: String(period.number),
    label: period.label,
    score: period.homeScore === null || period.awayScore === null ? null : `${period.homeScore}:${period.awayScore}`,
    events: order(match.events.filter((event) => event.period === period.number)),
  }))
  const unassigned = match.events.filter((event) => event.period === null)
  if (unassigned.length > 0) groups.push({ key: 'none', label: 'Bez minuty', score: null, events: unassigned })
  return groups
}

function minute(event: MatchRelationEvent) {
  return event.minute === null ? '—' : `${event.minute}'`
}

function eventsCount(count: number) {
  const last = count % 10
  const lastTwo = count % 100
  if (count === 1) return '1 zdarzenie'
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} zdarzenia`
  return `${count} zdarzeń`
}

function statusLine(match: MatchPageData, timeZone: string, size: 'lg' | 'sm' = 'lg') {
  if (match.status === 'live') return <LiveTag className={size === 'lg' ? 'text-lg' : 'text-sm'} />
  if (match.status === 'finished') return <span className={cn('pub-tab text-muted-foreground', size === 'lg' ? 'text-lg' : 'text-sm')}>Koniec</span>
  return null
}

/** Fakty meczu bez kropek: kolejka, dzień z godziną, obiekt. */
function MetaRow({ match, timeZone, className }: { match: MatchPageData; timeZone: string; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground', className)}>
      <span className="font-medium text-foreground">{match.round.name}</span>
      {match.kickoffAt && <span>{formatMatchDay(match.kickoffAt, timeZone)}, {formatKickoff(match.kickoffAt, { showDate: false, timeZone })}</span>}
      {match.venue && <span>{match.venue.name}</span>}
    </div>
  )
}

function ScoreWindow({ value, size = 'lg', dim }: { value: number | null; size?: 'lg' | 'md'; dim?: boolean }) {
  return (
    <span
      className={cn(
        'grid place-items-center rounded-md bg-sunken pub-score leading-none',
        size === 'lg' ? 'min-w-[5.5rem] px-3 py-3 text-[4rem] sm:min-w-[7.5rem] sm:text-[6.5rem]' : 'min-w-14 px-2 py-2 text-[2.75rem]',
        dim && 'text-muted-foreground',
      )}
    >
      {value}
    </span>
  )
}

function lostSide(match: MatchPageData, side: 'home' | 'away') {
  if (match.status !== 'finished' || match.homeScore === null || match.awayScore === null) return false
  return side === 'home' ? match.homeScore < match.awayScore : match.awayScore < match.homeScore
}

function ScorerList({ match, side, sport, align }: { match: MatchPageData; side: 'home' | 'away'; sport: Season['sport']; align: 'start' | 'end' | 'center' }) {
  const team = side === 'home' ? match.homeTeam : match.awayTeam
  const rows = (match.scorers ?? []).filter((scorer) => (scorer.ownGoal ? scorer.team.id !== team?.id : scorer.team.id === team?.id))
  if (rows.length === 0) return null
  return (
    <ul className={cn('flex flex-col gap-1 text-sm text-muted-foreground', align === 'end' && 'items-end text-right', align === 'center' && 'items-center text-center')}>
      {rows.map((scorer) => (
        <li key={`${scorer.player.id}-${scorer.ownGoal}`} className="flex items-center gap-2">
          {sport === 'football' && <EventIcon type={scorer.ownGoal ? 'own_goal' : 'goal'} className="size-3.5 opacity-70" />}
          {scorerText(scorer, sport)}
        </li>
      ))}
    </ul>
  )
}

// --- Tablica (A i C) -----------------------------------------------------------------

function Scoreboard({ match, data, compact }: { match: MatchPageData; data: Season; compact?: boolean }) {
  const scheduled = match.status === 'scheduled'
  const team = (side: 'home' | 'away') => {
    const value = side === 'home' ? match.homeTeam : match.awayTeam
    return (
      <div className={cn('flex min-w-0 flex-col items-center gap-3 text-center', lostSide(match, side) && 'text-muted-foreground')}>
        <Crest name={value?.name ?? '?'} className={compact ? 'size-12 sm:size-14' : 'size-14 sm:size-24'} />
        <span className={cn('pub-title w-full text-balance', compact ? 'text-xl sm:text-[1.75rem]' : 'text-2xl sm:text-[2.5rem]')}>{value?.name ?? 'Do ustalenia'}</span>
      </div>
    )
  }
  return (
    <section aria-label="Wynik meczu" className={cn('flex flex-col gap-6 rounded-md bg-card ring-1 ring-inset ring-border', compact ? 'px-4 py-6 sm:px-8' : 'px-4 py-8 sm:px-10 sm:py-10')}>
      <MetaRow match={match} timeZone={data.timeZone} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
        {team('home')}
        <div className="flex flex-col items-center gap-3">
          {scheduled ? (
            <span className={cn('pub-score', compact ? 'text-[3rem]' : 'text-[3.5rem] sm:text-[5rem]')}>{formatKickoff(match.kickoffAt, { showDate: false, timeZone: data.timeZone })}</span>
          ) : (
            <span className="flex gap-1.5 sm:gap-2">
              <ScoreWindow value={match.homeScore} size={compact ? 'md' : 'lg'} dim={lostSide(match, 'home')} />
              <ScoreWindow value={match.awayScore} size={compact ? 'md' : 'lg'} dim={lostSide(match, 'away')} />
            </span>
          )}
          {statusLine(match, data.timeZone)}
        </div>
        {team('away')}
      </div>
      {!compact && (match.scorers?.length ?? 0) > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 border-t border-hairline pt-5 sm:gap-8">
          <ScorerList match={match} side="home" sport={data.sport} align="center" />
          <span className="w-[11.5rem] max-sm:w-12" />
          <ScorerList match={match} side="away" sport={data.sport} align="center" />
        </div>
      )}
    </section>
  )
}

// --- Relacja listą (A i C) ---------------------------------------------------------------

function EventLine({ event, homeId }: { event: MatchRelationEvent; homeId: number | null }) {
  return (
    <li className="grid min-h-14 grid-cols-[3rem_1.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline py-2" data-side={event.team.id === homeId ? 'home' : 'away'}>
      <span className="pub-num text-lg text-muted-foreground">{minute(event)}</span>
      <EventIcon type={event.type} />
      <span className="flex min-w-0 items-center gap-3">
        <Crest name={event.team.name} className="size-5" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn('truncate', event.scoreAfter ? 'font-semibold' : 'font-medium')}>{event.player?.name ?? event.team.name}</span>
          <span className="text-xs text-muted-foreground">
            {event.typeLabel}
            {event.type === 'own_goal' && ` (${event.team.name})`}
          </span>
        </span>
      </span>
      <span className={cn('rounded-sm px-2 py-1 pub-num text-lg', event.scoreAfter ? 'bg-sunken' : 'invisible')}>
        {event.scoreAfter ? `${event.scoreAfter.home}:${event.scoreAfter.away}` : '0:0'}
      </span>
    </li>
  )
}

function GroupDetails({ group, open, children, center }: { group: Group; open: boolean; children: React.ReactNode; center?: boolean }) {
  return (
    <details open={open} className="group/period">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-baseline gap-4 py-3 [&::-webkit-details-marker]:hidden',
          center ? 'justify-center' : 'border-b-2 border-rule',
        )}
      >
        <h3 className={cn('pub-h3 text-[1.375rem]', center && 'rounded-full bg-sunken px-4 py-1 text-lg')}>
          {group.label}
          {center && group.score && <span className="ml-3 pub-num">{group.score}</span>}
        </h3>
        {!center && group.score && <span className="pub-num text-lg text-muted-foreground">{group.score}</span>}
        {!center && (
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {eventsCount(group.events.length)}
            <span aria-hidden className="transition-transform group-open/period:rotate-180">▾</span>
          </span>
        )}
      </summary>
      {children}
    </details>
  )
}

function Notice({ children }: { children: string }) {
  return <p className="rounded-md bg-sunken px-6 py-10 text-center text-muted-foreground">{children}</p>
}

function relationNotice(match: MatchPageData) {
  if (match.status === 'scheduled') return 'Relacja ruszy, gdy mecz się zacznie.'
  if (match.events.length === 0) return 'Organizator nie wpisał zdarzeń tego meczu.'
  return null
}

function RelationList({ match }: { match: MatchPageData }) {
  const notice = relationNotice(match)
  const collapse = match.events.length > RELATION_COLLAPSE_THRESHOLD
  return (
    <section aria-labelledby="relacja" className="flex flex-col gap-2">
      <h2 id="relacja" className="sr-only">Relacja</h2>
      {notice ? (
        <Notice>{notice}</Notice>
      ) : (
        groupsOf(match).map((group, index) => (
          <GroupDetails key={group.key} group={group} open={!collapse || (match.status === 'live' && index === 0)}>
            <ol>{group.events.map((event) => <EventLine key={event.id} event={event} homeId={match.homeTeam?.id ?? null} />)}</ol>
          </GroupDetails>
        ))
      )}
    </section>
  )
}

// --- B „Oś” ------------------------------------------------------------------------

function Strip({ match, data }: { match: MatchPageData; data: Season }) {
  const scheduled = match.status === 'scheduled'
  return (
    <section aria-label="Wynik meczu" className="flex flex-col gap-4 border-b border-hairline pb-6">
      <MetaRow match={match} timeZone={data.timeZone} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
        <span className={cn('flex min-w-0 items-center justify-end gap-3 text-right', lostSide(match, 'home') && 'text-muted-foreground')}>
          <span className="pub-title truncate leading-[1.2] text-xl sm:text-[2rem]">{match.homeTeam?.name}</span>
          <Crest name={match.homeTeam?.name ?? '?'} className="size-9 sm:size-12" />
        </span>
        <span className="flex flex-col items-center gap-1">
          {scheduled ? (
            <span className="pub-score text-[2.75rem]">{formatKickoff(match.kickoffAt, { showDate: false, timeZone: data.timeZone })}</span>
          ) : (
            <span className="flex gap-1.5">
              <ScoreWindow value={match.homeScore} size="md" dim={lostSide(match, 'home')} />
              <ScoreWindow value={match.awayScore} size="md" dim={lostSide(match, 'away')} />
            </span>
          )}
        </span>
        <span className={cn('flex min-w-0 items-center gap-3', lostSide(match, 'away') && 'text-muted-foreground')}>
          <Crest name={match.awayTeam?.name ?? '?'} className="size-9 sm:size-12" />
          <span className="pub-title truncate leading-[1.2] text-xl sm:text-[2rem]">{match.awayTeam?.name}</span>
        </span>
      </div>
      <div className="flex justify-center">{statusLine(match, data.timeZone, 'sm')}</div>
    </section>
  )
}

function AxisEvent({ event, side }: { event: MatchRelationEvent; side: 'home' | 'away' }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', side === 'home' && 'flex-row-reverse text-right')}>
      <EventIcon type={event.type} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn('truncate', event.scoreAfter ? 'font-semibold' : 'font-medium')}>{event.player?.name ?? event.team.name}</span>
        <span className="text-xs text-muted-foreground">
          {event.typeLabel}
          {event.type === 'own_goal' && ` (${event.team.name})`}
        </span>
      </span>
      {event.scoreAfter && <span className="shrink-0 rounded-sm bg-sunken px-2 py-0.5 pub-num text-base">{event.scoreAfter.home}:{event.scoreAfter.away}</span>}
    </span>
  )
}

function Axis({ match }: { match: MatchPageData }) {
  const notice = relationNotice(match)
  if (notice) return <Notice>{notice}</Notice>
  const homeId = match.homeTeam?.id ?? null
  const collapse = match.events.length > RELATION_COLLAPSE_THRESHOLD
  return (
    <section aria-label="Relacja" className="relative mx-auto flex w-full max-w-4xl flex-col">
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-hairline" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] pb-2 text-sm text-muted-foreground">
        <span className="pr-12 text-right">{match.homeTeam?.name}</span>
        <span className="pl-12">{match.awayTeam?.name}</span>
      </div>
      {groupsOf(match).map((group, index) => (
        <div key={group.key} className="relative">
          <GroupDetails group={group} open={!collapse || (match.status === 'live' && index === 0)} center>
            <ol>
              {group.events.map((event) => {
                const home = event.team.id === homeId
                return (
                  <li key={event.id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center">
                    <span className="flex justify-end pr-2">{home && <AxisEvent event={event} side="home" />}</span>
                    <span className="relative z-10 mx-auto grid h-8 min-w-12 place-items-center rounded-full bg-background px-2 pub-num text-base text-muted-foreground ring-1 ring-hairline">
                      {minute(event)}
                    </span>
                    <span className="flex pl-2">{!home && <AxisEvent event={event} side="away" />}</span>
                  </li>
                )
              })}
            </ol>
          </GroupDetails>
        </div>
      ))}
    </section>
  )
}

// --- C: panel boczny -------------------------------------------------------------

function PanelHead({ children }: { children: string }) {
  return <h2 className="border-b-2 border-rule pb-2 pub-h2">{children}</h2>
}

function SidePanel({ match, data }: { match: MatchPageData; data: Season }) {
  const others = data.matches.filter((other) => other.round.name === match.round.name && other.id !== match.id)
  const scorers = (match.scorers?.length ?? 0) > 0
  return (
    <aside className="flex flex-col gap-10">
      {match.periods.length > 0 && (
        <section className="flex flex-col">
          <PanelHead>Przebieg</PanelHead>
          {match.periods.map((period) => (
            <div key={period.number} className="flex min-h-11 items-center justify-between border-b border-hairline">
              <span>{period.label}</span>
              <span className="pub-num text-lg">{period.homeScore}:{period.awayScore}</span>
            </div>
          ))}
          <div className="flex min-h-11 items-center justify-between font-semibold">
            <span>{match.status === 'live' ? 'Na teraz' : 'Wynik'}</span>
            <span className="pub-num text-xl">{match.homeScore}:{match.awayScore}</span>
          </div>
        </section>
      )}
      {scorers && (
        <section className="flex flex-col gap-3">
          <PanelHead>{data.sport === 'basketball' ? 'Punktujący' : 'Strzelcy'}</PanelHead>
          {(['home', 'away'] as const).map((side) => (
            <div key={side} className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Crest name={(side === 'home' ? match.homeTeam : match.awayTeam)?.name ?? '?'} className="size-4" />
                {(side === 'home' ? match.homeTeam : match.awayTeam)?.name}
              </span>
              <ScorerList match={match} side={side} sport={data.sport} align="start" />
            </div>
          ))}
        </section>
      )}
      {others.length > 0 && (
        <section className="flex flex-col">
          <PanelHead>{`Inne mecze: ${match.round.name.toLocaleLowerCase('pl')}`}</PanelHead>
          {others.map((other) => (
            <DeadLink key={other.id} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline hover:bg-card/60">
              <span className="flex min-w-0 flex-col text-sm leading-tight">
                <span className="truncate">{other.homeTeam?.name}</span>
                <span className="truncate">{other.awayTeam?.name}</span>
              </span>
              {other.status === 'scheduled' ? (
                <span className="pub-num text-muted-foreground">{formatKickoff(other.kickoffAt, { showDate: false, timeZone: data.timeZone })}</span>
              ) : (
                <span className={cn('flex flex-col items-end pub-num leading-tight', other.status === 'live' && 'text-destructive')}>
                  <span>{other.homeScore}</span>
                  <span>{other.awayScore}</span>
                </span>
              )}
            </DeadLink>
          ))}
        </section>
      )}
    </aside>
  )
}

// --- Ekran -------------------------------------------------------------------------

export function MatchScreen({ match, data, accent, variant }: { match: MatchPageData; data: Season; accent: string; variant: MatchVariant }) {
  const back = match.status === 'scheduled' ? 'Terminarz' : 'Wyniki'
  return (
    <Shell tournament={data.tournament} tabs={data.tabs} accent={accent}>
      <div className="-mt-4 flex flex-col gap-6">
        <BackTo>{back}</BackTo>
        {variant === 'A' && (
          <>
            <Scoreboard match={match} data={data} />
            <div className="mx-auto w-full max-w-3xl">
              <RelationList match={match} />
            </div>
          </>
        )}
        {variant === 'B' && (
          <>
            <Strip match={match} data={data} />
            {(match.scorers?.length ?? 0) > 0 && (
              <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-24">
                <ScorerList match={match} side="home" sport={data.sport} align="end" />
                <ScorerList match={match} side="away" sport={data.sport} align="start" />
              </div>
            )}
            <Axis match={match} />
          </>
        )}
        {variant === 'C' && (
          <>
            <Scoreboard match={match} data={data} compact />
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
              <RelationList match={match} />
              <SidePanel match={match} data={data} />
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
