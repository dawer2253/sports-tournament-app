/**
 * PROTOTYP S7 (#288) — Statystyki. Jeden projekt: przełącznik statystyk
 * jak zakładki shella (podkreślenie w kolorze turnieju), lider wielką
 * liczbą jak na Przeglądzie, pod nim cała klasyfikacja z paskiem wartości,
 * a w bocznej kolumnie liderzy pozostałych statystyk.
 */
import * as React from 'react'
import { LEADERBOARD_EMPTY, type Leaderboard } from '../../../components/data/leaderboard-data'
import { cn } from '../../../lib/utils'
import { Crest } from '../parts'
import { EmptyBoard, PageHead, Shell } from './kit'
import type { Season } from './screen-demo'

/**
 * Przełącznik statystyk: zakładki ARIA sterujące jednym panelem, jak
 * `StatSwitcher` (#207), w wyglądzie zakładek shella. Wybór w aplikacji
 * siedzi w adresie (`?stat=`).
 */
function StatTabs({ data, value, onChange, panelId }: { data: Season; value: string; onChange: (code: string) => void; panelId: string }) {
  return (
    <div role="tablist" aria-label="Statystyka" className="flex gap-7 overflow-x-auto border-b border-hairline [scrollbar-width:none]">
      {data.stats.map((stat) => (
        <button
          key={stat.code}
          type="button"
          role="tab"
          aria-selected={stat.code === value}
          aria-controls={panelId}
          onClick={() => onChange(stat.code)}
          className={cn(
            '-mb-px shrink-0 border-b-[3px] pb-2.5 pt-1 pub-tab text-xl transition-colors',
            stat.code === value ? 'border-brand-line text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {stat.label}
        </button>
      ))}
    </div>
  )
}

/** Lider (albo kilku ex aequo): nazwisko i liczba jak na tablicy. */
function Leaders({ board }: { board: Leaderboard }) {
  const leaders = board.rows.filter((row) => row.position === 1)
  return (
    <div className={cn('grid gap-3', leaders.length > 1 && 'sm:grid-cols-2')}>
      {leaders.map((row) => (
        <div key={row.player.id} className="flex items-end justify-between gap-6 rounded-md bg-card px-5 py-5 ring-1 ring-inset ring-border sm:px-7">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm text-muted-foreground">{leaders.length > 1 ? 'Liderzy ex aequo' : 'Lider'}</span>
            <span className={cn('pub-title', leaders.length > 1 ? 'text-[2rem]' : 'text-[2.25rem] sm:text-[3rem]')}>{row.player.name}</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Crest name={row.team.name} className="size-5" />
              {row.team.name}
            </span>
          </div>
          <span className="flex flex-col items-end">
            <span className={cn('pub-score text-brand-line', leaders.length > 1 ? 'text-[4.5rem]' : 'text-[5.5rem] sm:text-[7rem]')}>{row.value}</span>
            <span className="text-xs text-muted-foreground">{board.label.toLocaleLowerCase('pl')}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Cała klasyfikacja: miejsce, zawodnik z drużyną, pasek wartości, wartość. */
function Ranking({ board }: { board: Leaderboard }) {
  const max = Math.max(...board.rows.map((row) => row.value))
  return (
    <div role="table" aria-label={`Klasyfikacja: ${board.label}`}>
      <div role="row" className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem] gap-x-3 pb-2 text-xs text-muted-foreground sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,12rem)_3.5rem]">
        <span role="columnheader" className="text-center">#</span>
        <span role="columnheader">Zawodnik</span>
        <span role="columnheader" className="hidden sm:block" aria-hidden />
        <span role="columnheader" className="text-right">{board.label}</span>
      </div>
      {board.rows.map((row, index) => {
        const shared = index > 0 && board.rows[index - 1]!.position === row.position
        return (
          <div role="row" key={row.player.id} className="grid min-h-14 grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-center gap-x-3 border-t border-hairline sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,12rem)_3.5rem]">
            {/* Dzielone miejsce stoi raz, przy pierwszym z grupy. */}
            <span role="cell" className={cn('text-center pub-num text-xl', row.position === 1 ? 'text-foreground' : 'text-muted-foreground')}>
              {!shared && row.position}
              {shared && <span className="sr-only">{row.position}</span>}
            </span>
            <span role="cell" className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-center sm:gap-4">
              <span className="truncate font-semibold">{row.player.name}</span>
              <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <Crest name={row.team.name} className="size-4" />
                <span className="truncate">{row.team.name}</span>
              </span>
            </span>
            <span role="cell" aria-hidden className="hidden h-1.5 rounded-full bg-muted sm:block">
              <span className={cn('block h-full rounded-full', row.position === 1 ? 'bg-brand-line' : 'bg-muted-foreground/45')} style={{ width: `${(row.value / max) * 100}%` }} />
            </span>
            <span role="cell" className="text-right pub-num text-2xl">{row.value}</span>
          </div>
        )
      })}
    </div>
  )
}

function OtherStats({ data, current, onPick }: { data: Season; current: string; onPick: (code: string) => void }) {
  const others = data.stats.filter((stat) => stat.code !== current)
  return (
    <aside className="flex flex-col gap-10">
      {others.map((stat) => {
        const board = data.leaderboards[stat.code]!
        return (
          <section key={stat.code} aria-labelledby={`inne-${stat.code}`} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-rule pb-2">
              <h2 id={`inne-${stat.code}`} className="pub-h2">{stat.label}</h2>
              <button type="button" onClick={() => onPick(stat.code)} className="text-sm font-medium text-brand-text underline-offset-4 hover:underline">
                Cała klasyfikacja
              </button>
            </div>
            {board.rows.length === 0 && <p className="py-3 text-sm text-muted-foreground">Jeszcze nikt.</p>}
            {board.rows.slice(0, 3).map((row) => (
              <div key={row.player.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-4 text-center pub-num text-muted-foreground">{row.position}</span>
                  <span className="truncate font-medium">{row.player.name}</span>
                </span>
                <span className="pub-num text-lg">{row.value}</span>
              </div>
            ))}
          </section>
        )
      })}
    </aside>
  )
}

export function StatsScreen({ data, accent }: { data: Season; accent: string }) {
  const [stat, setStat] = React.useState(data.stats[0]!.code)
  const code = data.stats.some((option) => option.code === stat) ? stat : data.stats[0]!.code
  const board = data.leaderboards[code]!
  const panelId = React.useId()
  const empty = board.rows.length === 0

  return (
    <Shell tournament={data.tournament} tabs={data.tabs} active="stats" accent={accent}>
      <PageHead eyebrow="Klasyfikacja zawodników" title="Statystyki" />
      <div className="flex flex-col gap-8">
        <StatTabs data={data} value={code} onChange={setStat} panelId={panelId} />
        <div id={panelId} role="tabpanel" className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14">
          {empty ? (
            <EmptyBoard title={`${board.label}: jeszcze nikt`} className="lg:col-span-2">
              {LEADERBOARD_EMPTY}. Liczą się mecze zakończone ze wszystkich faz turnieju.
            </EmptyBoard>
          ) : (
            <>
              <div className="flex min-w-0 flex-col gap-8">
                <Leaders board={board} />
                <Ranking board={board} />
                <p className="text-[0.8125rem] text-muted-foreground">
                  Klasyfikacja obejmuje mecze zakończone ze wszystkich faz turnieju. Zawodnicy z równą wartością dzielą miejsce.
                </p>
              </div>
              <OtherStats data={data} current={code} onPick={setStat} />
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
