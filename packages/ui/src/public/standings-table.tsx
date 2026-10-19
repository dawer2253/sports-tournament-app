import { plural } from '../lib/plural'
import { withQualifiers } from '../lib/qualifiers'
import { cn } from '../lib/utils'
import { Crest } from './crest'
import { Form } from './form'
import { SectionHead } from './heads'
import type { StandingsTableRow } from './standings-table-row'

/** Bilans ze znakiem: „+4”, „−3” (minus typograficzny), „0”. */
function signed(value: number) {
  return value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'
}

/** Skrót w nagłówku: rozwinięcie po najechaniu (`title`), bez legendy pod tabelą (#288). */
function Abbr({ title, children }: { title: string; children: string }) {
  return (
    <abbr title={title} className="cursor-help no-underline">
      {children}
    </abbr>
  )
}

/**
 * Komórka widoczna dopiero w szerokiej tabeli: w wąskiej zostają #, drużyna,
 * M, +/− i Pkt. Próg liczy szerokość tabeli (`@container`), nie ekranu, bo
 * ta sama tabela stoi na całą szerokość Tabeli i w głównej kolumnie
 * Przeglądu obok bocznej (#296). Pełna tabela potrzebuje 45 rem (nazwa dostaje wtedy 7 rem), grupa 28.
 */
function wideCell(compact: boolean) {
  return compact ? 'hidden @md:block' : 'hidden @min-[45rem]:block'
}

const NUM = 'text-right tabular-nums text-muted-foreground'

/**
 * Kolumny stałe, więc liczby nie skaczą między wierszami ani tabelami. Grupa
 * (`compact`) nie ma zdobyczy i formy, bo dwie tabele stoją obok siebie.
 */
function gridColumns(compact: boolean, allowsDraw: boolean) {
  const desktop = compact
    ? allowsDraw
      ? '@md:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_2.25rem_3rem_3rem]'
      : '@md:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_3rem_3rem]'
    : allowsDraw
      ? '@min-[45rem]:grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_2.75rem_2.75rem_2.75rem_5.5rem_3.5rem_8rem_3.5rem]'
      : '@min-[45rem]:grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_2.75rem_2.75rem_6.5rem_3.5rem_6rem_3.5rem]'
  return cn('grid grid-cols-[2rem_minmax(0,1fr)_2rem_3rem_3rem] items-center gap-x-2', desktop)
}

export interface StandingsTableProps {
  /** Wiersze w kolejności z API; w grupie po `withQualifiers` (`qualifies`, `tied`). */
  rows: readonly StandingsTableRow[]
  /** `StandingTable.scoreLabel`: nagłówek kolumny zdobyczy („Bramki”, „Punkty”). */
  scoreLabel: string
  /** `StandingTable.allowsDraw`: kolumna `R` tylko w sporcie z remisami. */
  allowsDraw: boolean
  /** Tabela grupy: bez zdobyczy i formy, z linią wyjścia z `qualifies`. */
  compact?: boolean
  /** Nazwa tabeli dla czytnika ekranu, np. „Tabela, Grupa A”. */
  label: string
}

/**
 * Tabela strony publicznej (#291), obok panelowej `StandingsTable`, która się
 * nie zmienia. Kolumny `#`, Drużyna, `M`, `W`, `R` (przy `allowsDraw`), `P`,
 * zdobycze, `+/−`, Forma i `Pkt`; skróty rozwija `title`. Role tabeli
 * (`table`/`row`/`columnheader`/`cell`) są jawne, bo siatka to `div`-y.
 *
 * - **Liga**: lider ma pasek `--brand-line` z lewej, dopiero po pierwszym
 *   rozegranym meczu.
 * - **Grupa**: pasek mają drużyny nad linią wyjścia (po pierwszym meczu),
 *   linia w `--brand-line` z podpisem „wyjście z grupy” stoi nad pierwszym
 *   niewychodzącym, a „remis na linii” pod nazwą drużyny. Czytnik słyszy
 *   „, wychodzi z grupy” przy miejscu.
 */
export function StandingsTable({ rows, scoreLabel, allowsDraw, compact = false, label }: StandingsTableProps) {
  const grid = gridColumns(compact, allowsDraw)
  const wide = wideCell(compact)
  const grouped = rows.some((row) => row.qualifies !== undefined)
  const anyPlayed = rows.some((row) => row.played > 0)

  return (
    <div role="table" aria-label={label} data-slot="standings-table" className="@container text-[0.9375rem]">
      <div role="row" className={cn(grid, 'pb-2 text-xs text-muted-foreground')}>
        <span role="columnheader" className="text-center">
          <Abbr title="Miejsce">#</Abbr>
        </span>
        <span role="columnheader">Drużyna</span>
        <span role="columnheader" className="text-right">
          <Abbr title="Mecze">M</Abbr>
        </span>
        <span role="columnheader" className={cn(wide, 'text-right')}>
          <Abbr title="Wygrane">W</Abbr>
        </span>
        {allowsDraw && (
          <span role="columnheader" className={cn(wide, 'text-right')}>
            <Abbr title="Remisy">R</Abbr>
          </span>
        )}
        <span role="columnheader" className={cn(wide, 'text-right')}>
          <Abbr title="Porażki">P</Abbr>
        </span>
        {!compact && (
          <span role="columnheader" className={cn(wide, 'text-center')}>
            <Abbr title={`${scoreLabel} zdobyte i stracone`}>{scoreLabel}</Abbr>
          </span>
        )}
        <span role="columnheader" className="text-right">
          <Abbr title="Bilans">+/−</Abbr>
        </span>
        {!compact && (
          <span role="columnheader" className={cn(wide, 'pl-4')}>
            <Abbr title="Pięć ostatnich meczów, najnowszy z prawej">Forma</Abbr>
          </span>
        )}
        <span role="columnheader" className="text-right text-foreground">
          <Abbr title="Punkty">Pkt</Abbr>
        </span>
      </div>
      {rows.map((row, index) => {
        const leader = !grouped && row.position === 1
        const line = grouped && row.qualifies === false && rows[index - 1]?.qualifies === true
        const strong = leader || row.qualifies === true
        const bar = anyPlayed && strong
        return (
          <div
            role="row"
            key={row.team.id}
            data-slot="standings-row"
            className={cn('relative min-h-14 border-t', grid, line ? 'border-t-2 border-brand-line' : 'border-hairline')}
          >
            {/* Pasek w kolorze turnieju: lider ligi albo drużyna, która wychodzi z grupy. */}
            {bar && <span aria-hidden data-slot="standings-bar" className="absolute inset-y-2 -left-3 w-1 rounded-full bg-brand-line" />}
            {line && (
              <span
                aria-hidden
                data-slot="qualifiers-line"
                className="absolute top-0 right-0 -translate-y-1/2 bg-background pl-2 text-xs font-medium text-brand-text"
              >
                wyjście z grupy
              </span>
            )}
            <span role="cell" className={cn('pub-num text-center text-xl', !strong && 'text-muted-foreground')}>
              {row.position}
              {row.qualifies && <span className="sr-only">, wychodzi z grupy</span>}
            </span>
            <span role="cell" className="flex min-w-0 items-center gap-3 py-2">
              <Crest name={row.team.name} logoUrl={row.team.logoUrl} className="size-7" />
              {/* Dopisek idzie pod nazwę, nie obok: w wąskiej tabeli grupy obcinał ją (#288). */}
              <span className="flex min-w-0 flex-col leading-snug">
                <span data-slot="team-name" className={strong ? 'font-semibold' : 'font-medium'}>
                  {row.team.name}
                </span>
                {row.tied && <span className="text-xs text-muted-foreground">remis na linii</span>}
              </span>
            </span>
            <span role="cell" className={NUM}>
              {row.played}
            </span>
            <span role="cell" className={cn(NUM, wide)}>
              {row.won}
            </span>
            {allowsDraw && (
              <span role="cell" className={cn(NUM, wide)}>
                {row.drawn}
              </span>
            )}
            <span role="cell" className={cn(NUM, wide)}>
              {row.lost}
            </span>
            {!compact && (
              <span role="cell" className={cn(wide, 'text-center tabular-nums text-muted-foreground')}>
                {row.scoreFor}:{row.scoreAgainst}
              </span>
            )}
            <span role="cell" className={NUM}>
              {signed(row.scoreDifference)}
            </span>
            {!compact && (
              <span role="cell" className={cn(wide, 'pl-4')}>
                <Form results={row.form} />
              </span>
            )}
            <span role="cell" className="pub-num text-right text-2xl">
              {row.points}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Kryterium kolejności z odpowiedzi tabeli (`StandingTable.tiebreakers`). */
export interface StandingsTiebreaker {
  code: string
  label: string
}

/**
 * Zdanie pod tabelą: „Przy równej liczbie punktów: {kryteria} → nazwa drużyny
 * (alfabetycznie).” Kryteria idą z odpowiedzi tabeli, więc zgadzają się
 * z wierszami. `points` wypada **po kodzie**: to samo zdanie już je nazywa,
 * a jego etykieta bywa inna niż „Punkty”.
 */
export function TiebreakSentence({ tiebreakers, className }: { tiebreakers: readonly StandingsTiebreaker[]; className?: string }) {
  const steps = [
    ...tiebreakers.filter((item) => item.code !== 'points').map((item) => item.label.toLocaleLowerCase('pl')),
    'nazwa drużyny (alfabetycznie)',
  ]
  return (
    <p data-slot="tiebreak-sentence" className={cn('border-t border-hairline pt-4 text-[0.8125rem] text-muted-foreground', className)}>
      Przy równej liczbie punktów: {steps.join(' → ')}.
    </p>
  )
}

/** Mistrz pucharu albo playoffu: zwycięzca finału, bez wiersza tabeli. */
export interface ChampionTeam {
  name: string
  logoUrl: string | null
}

export type ChampionBandProps = { row: StandingsTableRow; scoreLabel: string } | { team: ChampionTeam }

/**
 * Pas „Mistrz”: wypełnienie `--brand` z obrysem `--brand-line`
 * (`pub-brand-fill`), herb zastępczy w `--brand-foreground` i nazwa. Nad
 * tabelą ligi zakończonego turnieju (`row`) dochodzą wygrane, zdobycze
 * i punkty; w pucharze i playoffie (`team`, zwycięzca finału, #296) sama
 * drużyna. Cały tekst stoi w `--brand-foreground`, bez przezroczystości,
 * żeby trzymał 4,5:1.
 */
export function ChampionBand(props: ChampionBandProps) {
  const league = 'row' in props ? props : null
  const team = 'row' in props ? props.row.team : props.team
  return (
    <section aria-label="Mistrz" data-slot="champion-band" className="pub-brand-fill flex items-center gap-4 rounded-md px-5 py-4 sm:gap-6 sm:px-7 sm:py-5">
      <Crest name={team.name} logoUrl={team.logoUrl} onFill className="size-12 sm:size-14" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm">Mistrz</span>
        <span className="pub-title text-3xl leading-[1.2] wrap-break-word sm:text-[2.5rem]">{team.name}</span>
      </span>
      {league && (
        <>
          <span className="ml-auto hidden text-right text-sm sm:block">
            {league.row.won} {plural(league.row.won, ['wygrana', 'wygrane', 'wygranych'])}, {league.scoreLabel.toLocaleLowerCase('pl')}{' '}
            {league.row.scoreFor}:{league.row.scoreAgainst}
          </span>
          <span className="ml-auto flex flex-col items-end sm:ml-0">
            <span className="pub-score text-5xl">{league.row.points}</span>
            <span className="text-xs">pkt</span>
          </span>
        </>
      )}
    </section>
  )
}

/** Tabela grupy z odpowiedzi `/standings` z liczbą wychodzących z grupy turnieju. */
export interface GroupTableData {
  groupId: number | null
  groupName: string | null
  rows: readonly StandingsTableRow[]
  /** `Group.qualifiers` po `groupId`; `null`, gdy turniej grupy jeszcze nie zna: tabela bez linii. */
  qualifiers: number | null
  scoreLabel: string
  allowsDraw: boolean
}

/**
 * Tabela jednej grupy z belką sekcji: wąska (`compact`, bez zdobyczy i formy)
 * z linią wyjścia. Tabela i Przegląd (#296) stawiają grupy w dwóch kolumnach.
 */
export function GroupTable({ table, index }: { table: GroupTableData; index: number }) {
  const name = table.groupName ?? `Grupa ${index + 1}`
  const id = `tabela-grupy-${table.groupId ?? index}`
  const rows = table.qualifiers === null ? table.rows : withQualifiers(table.rows, table.qualifiers)
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <SectionHead id={id} title={name} />
      <StandingsTable rows={rows} scoreLabel={table.scoreLabel} allowsDraw={table.allowsDraw} compact label={`Tabela, ${name}`} />
    </section>
  )
}
