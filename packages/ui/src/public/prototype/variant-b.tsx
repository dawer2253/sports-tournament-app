/**
 * PROTOTYP S7 (#287) — wariant B „Stadion” (A + elementy C).
 *
 * Z C bierze zdjęcie sportu w nagłówku i herby przy meczu na żywo. Mecz na
 * żywo nie ma osobnej sekcji: stoi w nagłówku, na zdjęciu, obok nazwy
 * turnieju. Niżej trzy równe kolumny (terminarz, wyniki, tabela), a lider
 * klasyfikacji jako szeroki pas na dole. Sport bez zdjęcia: nagłówek
 * w płaskim kolorze turnieju.
 */
import type * as React from 'react'
import heroNight from '../../assets/public/hero-night.webp'
import { LEAGUE_TABS } from '../../components/layout/public-nav'
import { LEADERBOARD_EMPTY, leaderboardLeaders } from '../../components/data/leaderboard-data'
import { cn } from '../../lib/utils'
import type { ScheduleDemoMatch } from '../../lib/demo-data'
import type { OverviewData } from './demo'
import {
  Crest,
  DeadLink,
  Footer,
  LiveTag,
  MiniTable,
  PublicRoot,
  ScoreCell,
  SectionHead,
  Tabs,
  TournamentMark,
  day,
  scorerLabel,
  scorersFor,
  time,
} from './parts'

/** Kafel na zdjęciu: ciemne szkło, żeby wynik czytał się na każdym kadrze. */
function HeroTile({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section aria-label={label} className="flex w-full flex-col gap-4 rounded-lg bg-sunken/85 p-5 ring-1 ring-white/10 backdrop-blur-md sm:p-6 lg:w-[26rem]">
      {children}
    </section>
  )
}

function LiveTile({ match }: { match: ScheduleDemoMatch }) {
  const line = (side: 'home' | 'away') => {
    const team = side === 'home' ? match.homeTeam! : match.awayTeam!
    const score = side === 'home' ? match.homeScore : match.awayScore
    const scorers = scorersFor(match, side)
    return (
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3">
        <Crest name={team.name} className="size-11" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate pub-h2 uppercase">{team.name}</span>
          <span className="truncate text-xs text-muted-foreground">{scorers.map(scorerLabel).join(', ') || ' '}</span>
        </span>
        <span className="pub-score text-[3.5rem]">{score}</span>
      </div>
    )
  }
  return (
    <HeroTile label="Na żywo">
      <div className="flex items-center justify-between gap-3">
        <LiveTag />
        <span className="text-sm text-muted-foreground">{match.venue?.name}</span>
      </div>
      {line('home')}
      {line('away')}
      <DeadLink className="grid min-h-11 place-items-center rounded-md bg-brand pub-tab text-brand-foreground hover:opacity-90">Śledź mecz</DeadLink>
    </HeroTile>
  )
}

function StartTile({ data }: { data: OverviewData }) {
  const first = data.upcoming[0]!
  return (
    <HeroTile label="Start turnieju">
      <span className="text-sm text-muted-foreground">Start turnieju</span>
      <span className="pub-title text-[2.75rem]">{day(first, data.timeZone)}, {time(first, data.timeZone)}</span>
      <span className="text-sm text-muted-foreground">{first.homeTeam?.name} – {first.awayTeam?.name}, {first.venue?.name}</span>
    </HeroTile>
  )
}

function ChampionTile({ data }: { data: OverviewData }) {
  const champion = data.table[0]!
  return (
    <HeroTile label="Mistrz">
      <span className="pub-tab text-brand-text">Mistrz</span>
      <span className="flex items-center gap-4">
        <Crest name={champion.team.name} className="size-14" />
        <span className="pub-title text-[2.75rem]">{champion.team.name}</span>
      </span>
      <span className="text-sm text-muted-foreground">{champion.points} pkt, {champion.won} zwycięstw w {champion.played} meczach</span>
    </HeroTile>
  )
}

function Hero({ data, photo }: { data: OverviewData; photo: boolean }) {
  const { tournament, currentRound, roundsTotal, state } = data
  const live = data.live[0]
  return (
    <header className={cn('relative isolate overflow-hidden border-b border-hairline', photo ? 'text-foreground' : 'bg-brand text-brand-foreground')}>
      {photo && (
        <>
          <img src={heroNight} alt="" aria-hidden className="absolute inset-0 -z-20 size-full object-cover object-[center_70%]" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/20" />
        </>
      )}
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-10 sm:px-6 lg:min-h-[26rem] lg:justify-end lg:pt-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4">
            <TournamentMark tournament={tournament} className={cn('size-16', !photo && 'ring-2 ring-brand-foreground/40')} />
            <h1 className="pub-title text-[2.75rem] sm:text-[4rem]">{tournament.name}</h1>
            <div className={cn('flex flex-wrap gap-x-5 gap-y-1', photo ? 'text-muted-foreground' : 'opacity-85')}>
              <span>{tournament.sport.name}</span>
              {state === 'zakonczony' ? <span>Zakończony</span> : currentRound && <span>{currentRound.summary.name} z {roundsTotal}</span>}
            </div>
          </div>
          {live ? <LiveTile match={live} /> : state === 'zakonczony' ? <ChampionTile data={data} /> : <StartTile data={data} />}
        </div>
        <Tabs
          tabs={LEAGUE_TABS}
          className={cn('-mx-1 px-1', !photo && '[&_a[aria-current]]:border-brand-foreground [&_a]:text-brand-foreground/75 [&_a[aria-current]]:text-brand-foreground')}
        />
      </div>
    </header>
  )
}

function CompactFixture({ match, timeZone }: { match: ScheduleDemoMatch; timeZone: string }) {
  return (
    <DeadLink className="grid min-h-16 grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-3 border-b border-hairline py-2 hover:bg-card/60">
      <span className="flex flex-col leading-tight">
        <span className="pub-num text-xl">{time(match, timeZone)}</span>
        <span className="text-xs text-muted-foreground">{match.venue?.name}</span>
      </span>
      <span className="flex min-w-0 flex-col font-semibold">
        <span className="truncate">{match.homeTeam?.name}</span>
        <span className="truncate">{match.awayTeam?.name}</span>
      </span>
    </DeadLink>
  )
}

function CompactResult({ match }: { match: ScheduleDemoMatch }) {
  const rows = [
    { team: match.homeTeam!, score: match.homeScore!, other: match.awayScore! },
    { team: match.awayTeam!, score: match.awayScore!, other: match.homeScore! },
  ]
  return (
    <DeadLink className="flex flex-col gap-1 border-b border-hairline py-2.5 hover:bg-card/60">
      {rows.map(({ team, score, other }) => (
        <span key={team.id} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3', score < other ? 'text-muted-foreground' : 'font-semibold')}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Crest name={team.name} className="size-5" />
            <span className="truncate">{team.name}</span>
          </span>
          <ScoreCell value={score} dim={score < other} className="min-w-8 text-xl leading-7" />
        </span>
      ))}
    </DeadLink>
  )
}

function LeaderBand({ data }: { data: OverviewData }) {
  const rows = leaderboardLeaders(data.leaderboard.rows).slice(0, 5)
  return (
    <section aria-labelledby="b-leader" className="flex flex-col gap-4">
      <SectionHead id="b-leader" title={data.leaderboard.label} link="Wszystkie statystyki" />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{LEADERBOARD_EMPTY}.</p>
      ) : (
        <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-hairline sm:grid-cols-5">
          {rows.map((row, index) => (
            <li key={row.player.id} className={cn('flex flex-col gap-3 bg-card p-4', index === 0 && 'col-span-2 sm:col-span-1')}>
              <span className={cn('pub-score text-6xl', index === 0 ? 'text-brand-line' : 'text-foreground')}>{row.value}</span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{row.player.name}</span>
                <span className="truncate text-sm text-muted-foreground">{row.team.name}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function VariantB({ data, accent, photo }: { data: OverviewData; accent: string; photo: boolean }) {
  return (
    <PublicRoot accent={accent}>
      <Hero data={data} photo={photo} />
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none lg:gap-10">
          {data.upcoming.length > 0 && (
            <section aria-labelledby="b-next" className="flex flex-col gap-2">
              <SectionHead id="b-next" title="Najbliższe" link="Terminarz" sub={`${data.nextRound?.summary.name}, ${data.nextRound?.summary.dates}`} />
              <div>{data.upcoming.map((match) => <CompactFixture key={match.id} match={match} timeZone={data.timeZone} />)}</div>
            </section>
          )}
          {data.latest.length > 0 && (
            <section aria-labelledby="b-last" className="flex flex-col gap-2">
              <SectionHead id="b-last" title="Wyniki" link="Wszystkie" sub={data.latestRound?.summary.name} />
              <div>{data.latest.map((match) => <CompactResult key={match.id} match={match} />)}</div>
            </section>
          )}
          <section aria-labelledby="b-table" className="flex flex-col gap-3 md:col-span-2 lg:col-span-1">
            <SectionHead id="b-table" title="Tabela" link="Pełna tabela" />
            <MiniTable rows={data.table} finished={data.state === 'zakonczony'} />
          </section>
        </div>
        <LeaderBand data={data} />
      </main>
      <Footer tournament={data.tournament} />
    </PublicRoot>
  )
}
