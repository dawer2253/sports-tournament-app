/**
 * PROTOTYP S7 (#287) — wariant C „Kolejka”.
 *
 * Bohaterem nie jest jeden mecz, tylko bieżąca kolejka: pas tablic ze
 * wszystkimi jej meczami (zakończone, trwający, przed nami) w jednym rzędzie,
 * jak telebim. Nagłówek to jeden pasek (logo, nazwa, zakładki). Niżej
 * dominuje pełna tabela z formą, a w bocznej kolumnie następna kolejka
 * i lider.
 */
import { LEAGUE_TABS } from '../../components/layout/public-nav'
import { cn } from '../../lib/utils'
import type { ScheduleDemoMatch } from '../../lib/demo-data'
import type { OverviewData } from './demo'
import { ShellHeader } from './screens/kit'
import {
  Crest,
  DeadLink,
  Footer,
  LeaderBlock,
  LiveTag,
  MiniTable,
  PublicRoot,
  SectionHead,
  day,
  scorerLabel,
  scorersFor,
  time,
} from './parts'


/** Jedna tablica w pasie kolejki: stan nad parą, dwie linie drużyna–wynik. */
function MatchBoard({ match, timeZone }: { match: ScheduleDemoMatch; timeZone: string }) {
  const live = match.status === 'live'
  const finished = match.status === 'finished'
  const played = live || finished
  const line = (side: 'home' | 'away') => {
    const team = side === 'home' ? match.homeTeam! : match.awayTeam!
    const score = side === 'home' ? match.homeScore : match.awayScore
    const other = side === 'home' ? match.awayScore : match.homeScore
    const lost = finished && score! < other!
    return (
      <span className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3', lost && 'text-muted-foreground')}>
        <Crest name={team.name} className="size-6" />
        <span className={cn('truncate', lost ? 'font-medium' : 'font-semibold')}>{team.name}</span>
        <span className={cn('pub-score text-[2.25rem] leading-none', !played && 'text-transparent')}>{played ? score : 0}</span>
      </span>
    )
  }
  const scorers = [...scorersFor(match, 'home'), ...scorersFor(match, 'away')]
  return (
    <DeadLink
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-md bg-card p-4 ring-1 ring-inset hover:bg-muted',
        live ? 'ring-destructive/70' : 'ring-border',
      )}
    >
      <span className="flex min-h-6 items-center justify-between gap-3 text-sm text-muted-foreground">
        {live ? <LiveTag className="text-sm" /> : finished ? <span>Koniec</span> : <span className="pub-num text-base text-foreground">{time(match, timeZone)}</span>}
        <span>{match.venue?.name}</span>
      </span>
      {line('home')}
      {line('away')}
      {live && scorers.length > 0 && <span className="truncate text-xs text-muted-foreground">{scorers.map(scorerLabel).join(', ')}</span>}
    </DeadLink>
  )
}

function RoundBand({ data }: { data: OverviewData }) {
  const round = data.state === 'zakonczony' ? data.latestRound : data.currentRound
  if (!round) return null
  const { summary, matches } = round
  return (
    <section aria-labelledby="c-round" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {data.state === 'zakonczony' ? 'Ostatnia kolejka' : data.state === 'przed-startem' ? 'Pierwsza kolejka' : 'Bieżąca kolejka'}
          </span>
          <h2 id="c-round" className="pub-title text-[3rem] sm:text-[4rem]">{summary.name}</h2>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-muted-foreground">
          <span>{summary.dates}</span>
          <span><span className="pub-num text-lg text-foreground">{summary.finished}</span> z {summary.total} rozegrane</span>
          <span>z {data.roundsTotal} kolejek</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {matches.map((match) => <MatchBoard key={match.id} match={match} timeZone={data.timeZone} />)}
      </div>
    </section>
  )
}

/**
 * Drużyny przed ułożeniem terminarza: zamiast pasa kolejki sama prezentacja
 * drużyn. Tabela z zerami i pusta klasyfikacja nic by tu nie powiedziały,
 * więc ich nie ma.
 */
function TeamsShowcase({ data }: { data: OverviewData }) {
  const teams = data.table.map((row) => row.team).toSorted((a, b) => a.name.localeCompare(b.name, 'pl'))
  return (
    <section aria-labelledby="c-teams" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Kto gra w turnieju</span>
          <h2 id="c-teams" className="pub-title text-[3rem] sm:text-[4rem]">Drużyny</h2>
        </div>
        <span className="text-muted-foreground">
          <span className="pub-num text-lg text-foreground">{teams.length}</span> drużyn
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {teams.map((team) => (
          <li key={team.id} className="flex min-w-0 flex-col items-start gap-5 rounded-md bg-card p-5 ring-1 ring-inset ring-border sm:p-6">
            <Crest name={team.name} className="size-14 sm:size-20" />
            <span className="w-full truncate pub-title text-2xl sm:text-[1.75rem]">{team.name}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">Terminarz pojawi się tutaj, gdy organizator go ułoży.</p>
    </section>
  )
}

function NextRound({ data }: { data: OverviewData }) {
  const round = data.followingRound
  if (!round || data.state === 'zakonczony') return null
  return (
    <section aria-labelledby="c-next" className="flex flex-col gap-2">
      <SectionHead id="c-next" title={round.summary.name} link="Terminarz" sub={round.summary.dates} />
      {round.matches.map((match) => (
        <DeadLink key={match.id} className="grid min-h-12 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 border-b border-hairline hover:bg-card/60">
          <span className="pub-num text-lg">{time(match, data.timeZone)}</span>
          <span className="truncate font-medium">{match.homeTeam?.name} – {match.awayTeam?.name}</span>
        </DeadLink>
      ))}
    </section>
  )
}

function ChampionLine({ data }: { data: OverviewData }) {
  const champion = data.table[0]!
  return (
    <div className="flex items-center gap-4 rounded-md bg-brand px-5 py-4 text-brand-foreground">
      <Crest name={champion.team.name} className="size-10" />
      <span className="flex flex-col">
        <span className="text-sm opacity-85">Mistrz</span>
        <span className="pub-title text-3xl">{champion.team.name}</span>
      </span>
      <span className="ml-auto pub-score text-5xl">{champion.points}</span>
    </div>
  )
}

export function VariantC({ data, accent }: { data: OverviewData; accent: string }) {
  const first = data.state === 'przed-startem' ? data.upcoming[0] : undefined
  return (
    <PublicRoot accent={accent}>
      <ShellHeader tournament={data.tournament} tabs={LEAGUE_TABS} active="home" />
      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-8 sm:px-6 sm:py-10">
        {data.state === 'bez-terminarza' ? (
          <TeamsShowcase data={data} />
        ) : (
          <>
            <RoundBand data={data} />
            <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
              <section aria-labelledby="c-table" className="flex min-w-0 flex-col gap-4">
                <SectionHead id="c-table" title="Tabela" link="Pełna tabela" sub={first ? `Startuje ${day(first, data.timeZone)}, ${time(first, data.timeZone)}` : undefined} />
                {data.state === 'zakonczony' && <ChampionLine data={data} />}
                <MiniTable rows={data.table} columns="full" />
              </section>
              <aside className="flex min-w-0 flex-col gap-12">
                <NextRound data={data} />
                <section aria-labelledby="c-leader" className="flex flex-col gap-1">
                  <SectionHead id="c-leader" title={data.leaderboard.label} link="Statystyki" />
                  <LeaderBlock leaderboard={data.leaderboard} compact />
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      <Footer tournament={data.tournament} />
    </PublicRoot>
  )
}
