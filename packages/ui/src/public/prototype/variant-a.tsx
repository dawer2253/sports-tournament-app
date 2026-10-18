/**
 * PROTOTYP S7 (#287) — wariant A „Tablica”.
 *
 * Kierunek A z płótna, bez zdjęcia. Wąski nagłówek, pod nim jedna szeroka
 * tablica z tym, co w turnieju najważniejsze teraz (mecz na żywo, start
 * turnieju albo mistrz), a niżej dwie kolumny: mecze | tabela i lider.
 */
import { LEAGUE_TABS } from '../../components/layout/public-nav'
import { cn } from '../../lib/utils'
import type { ScheduleDemoMatch } from '../../lib/demo-data'
import type { OverviewData } from './demo'
import {
  Crest,
  DeadLink,
  FixtureLine,
  Footer,
  LeaderBlock,
  LiveTag,
  MiniTable,
  PublicRoot,
  ResultLine,
  SectionHead,
  Tabs,
  TournamentMark,
  day,
  scorerLabel,
  scorersFor,
  time,
} from './parts'

function Header({ data }: { data: OverviewData }) {
  const { tournament, currentRound, roundsTotal, state } = data
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-8 sm:px-6">
        <div className="flex items-center gap-4">
          <TournamentMark tournament={tournament} className="size-14" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="pub-title truncate text-[1.75rem] sm:text-[2.5rem]">{tournament.name}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>{tournament.sport.name}</span>
              {state === 'zakonczony' ? (
                <span>Zakończony</span>
              ) : (
                currentRound && <span>{currentRound.summary.name} z {roundsTotal}</span>
              )}
            </div>
          </div>
        </div>
        <Tabs tabs={LEAGUE_TABS} />
      </div>
    </header>
  )
}

function BoardTeam({ name, scorers, side }: { name: string; scorers: string[]; side: 'home' | 'away' }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3', side === 'home' ? 'items-end text-right' : 'items-start')}>
      <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4', side === 'home' ? 'items-end sm:flex-row-reverse' : 'items-start')}>
        <Crest name={name} className="size-9 sm:size-14" />
        <span className="pub-title text-lg sm:text-[2.75rem]">{name}</span>
      </div>
      <ul className="flex flex-col text-sm text-muted-foreground">
        {scorers.map((label) => <li key={label}>{label}</li>)}
      </ul>
    </div>
  )
}

function LiveBoard({ match, data }: { match: ScheduleDemoMatch; data: OverviewData }) {
  return (
    <section aria-labelledby="a-live" className="flex flex-col gap-6 rounded-lg border border-border bg-card px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="a-live"><LiveTag /></h2>
        <span className="flex flex-wrap gap-x-5 text-sm text-muted-foreground">
          <span>{match.round.name}</span>
          <span>{match.venue?.name}</span>
          <span>Start {time(match, data.timeZone)}</span>
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-8">
        <BoardTeam side="home" name={match.homeTeam!.name} scorers={scorersFor(match, 'home').map(scorerLabel)} />
        <div className="flex gap-1.5 sm:gap-2" aria-label={`Wynik ${match.homeScore}:${match.awayScore}`}>
          {[match.homeScore, match.awayScore].map((value, index) => (
            <span key={index} aria-hidden className="grid min-w-12 place-items-center rounded-md bg-sunken px-2 py-2 pub-score text-[3.5rem] sm:min-w-28 sm:py-3 sm:text-[7.5rem]">
              {value}
            </span>
          ))}
        </div>
        <BoardTeam side="away" name={match.awayTeam!.name} scorers={scorersFor(match, 'away').map(scorerLabel)} />
      </div>
      <div className="flex justify-center">
        <DeadLink className="inline-flex min-h-11 items-center rounded-md bg-brand px-6 pub-tab text-brand-foreground hover:opacity-90">
          Śledź mecz
        </DeadLink>
      </div>
    </section>
  )
}

function StartBoard({ data }: { data: OverviewData }) {
  const first = data.upcoming[0]!
  return (
    <section aria-labelledby="a-start" className="grid gap-6 rounded-lg border border-border bg-card px-4 py-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-12 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-1">
        <h2 id="a-start" className="text-sm text-muted-foreground">Start turnieju</h2>
        <span className="pub-title text-5xl sm:text-[4rem]">{day(first, data.timeZone)}</span>
        <span className="pub-score text-[3rem] text-brand-line">{time(first, data.timeZone)}</span>
      </div>
      <div className="flex flex-col">
        <span className="pb-2 text-sm text-muted-foreground">{first.round.name}</span>
        {data.upcoming.map((match) => (
          <div key={match.id} className="flex min-h-11 items-center justify-between gap-4 border-t border-hairline">
            <span className="truncate font-semibold">{match.homeTeam?.name} – {match.awayTeam?.name}</span>
            <span className="shrink-0 text-sm text-muted-foreground">{time(match, data.timeZone)} {match.venue?.name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChampionBoard({ data }: { data: OverviewData }) {
  const champion = data.table[0]!
  return (
    <section aria-labelledby="a-champion" className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-4 py-10 text-center sm:py-12">
      <h2 id="a-champion" className="pub-tab text-brand-text">Mistrz {data.tournament.name}</h2>
      <Crest name={champion.team.name} className="size-20" />
      <span className="pub-title text-5xl sm:text-[5rem]">{champion.team.name}</span>
      <span className="flex gap-6 text-muted-foreground">
        <span><span className="pub-num text-xl text-foreground">{champion.points}</span> pkt</span>
        <span><span className="pub-num text-xl text-foreground">{champion.won}</span> zwycięstw</span>
        <span><span className="pub-num text-xl text-foreground">{champion.scoreFor}</span> bramek</span>
      </span>
    </section>
  )
}

export function VariantA({ data, accent }: { data: OverviewData; accent: string }) {
  const live = data.live[0]
  return (
    <PublicRoot accent={accent}>
      <Header data={data} />
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6 sm:py-10">
        {live ? <LiveBoard match={live} data={data} /> : data.state === 'zakonczony' ? <ChampionBoard data={data} /> : <StartBoard data={data} />}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <div className="flex min-w-0 flex-col gap-12">
            {data.upcoming.length > 0 && data.state !== 'przed-startem' && (
              <section aria-labelledby="a-next" className="flex flex-col gap-2">
                <SectionHead id="a-next" title="Najbliższe mecze" link="Cały terminarz" sub={`${data.nextRound?.summary.name}, ${data.nextRound?.summary.dates}`} />
                <div>{data.upcoming.map((match) => <FixtureLine key={match.id} match={match} timeZone={data.timeZone} />)}</div>
              </section>
            )}
            {data.latest.length > 0 && (
              <section aria-labelledby="a-last" className="flex flex-col gap-2">
                <SectionHead id="a-last" title="Ostatnie wyniki" link="Wszystkie wyniki" sub={data.latestRound?.summary.name} />
                <div>{data.latest.map((match) => <ResultLine key={match.id} match={match} />)}</div>
              </section>
            )}
            {data.state === 'przed-startem' && (
              <section aria-labelledby="a-teams" className="flex flex-col gap-2">
                <SectionHead id="a-teams" title="Drużyny" sub={`${data.table.length} drużyn, ${data.roundsTotal} kolejek`} />
                <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                  {data.table.map((row) => (
                    <li key={row.team.id} className="flex min-h-12 items-center gap-3 border-b border-hairline font-medium">
                      <Crest name={row.team.name} className="size-6" />
                      {row.team.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-12">
            <section aria-labelledby="a-table" className="flex flex-col gap-3">
              <SectionHead id="a-table" title="Tabela" link="Pełna tabela" />
              <MiniTable rows={data.table} finished={data.state === 'zakonczony'} />
            </section>
            <section aria-labelledby="a-leader" className="flex flex-col gap-1">
              <SectionHead id="a-leader" title={data.leaderboard.label} link="Statystyki" />
              <LeaderBlock leaderboard={data.leaderboard} />
            </section>
          </aside>
        </div>
      </main>
      <Footer tournament={data.tournament} />
    </PublicRoot>
  )
}
