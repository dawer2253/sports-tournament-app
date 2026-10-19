/**
 * Ekran Tabela strony publicznej (#291): liga (piłka i kosz) i tabele grup
 * z linią wyjścia. Komponent z danymi w propsach (#289 pkt 8): story podaje
 * demo, a strona w `apps/public` pobiera tabele, grupy turnieju i mecze fazy
 * i wybiera stan (wczytywanie, błąd, puchar).
 */
import { plural, GROUPS } from '../../lib/plural'
import type { AnchorProps } from '../anchor'
import { EmptyBoard } from '../board'
import { TextLink } from '../button'
import { Fact, PageHead } from '../heads'
import type { ScheduleProgress } from '../schedule-progress'
import { Loading, SkeletonBlock, SkeletonHead } from '../skeleton'
import { ChampionBand, GroupTable, StandingsTable, TiebreakSentence, type StandingsTiebreaker } from '../standings-table'
import type { StandingsTableRow } from '../standings-table-row'

/** Jedna tabela z odpowiedzi `/standings` z grupą turnieju, gdy ją ma. */
export interface StandingsScreenTable {
  /** `StandingTable.groupId`; `null` w lidze. */
  groupId: number | null
  /** `StandingTable.groupName`; `null` w lidze. */
  groupName: string | null
  rows: readonly StandingsTableRow[]
  /**
   * `Group.qualifiers` grupy turnieju, po `groupId`. `null` w lidze i w grupie,
   * której turniej jeszcze nie zna: tabela stoi wtedy bez linii.
   */
  qualifiers: number | null
  scoreLabel: string
  allowsDraw: boolean
  tiebreakers: readonly StandingsTiebreaker[]
}

export interface StandingsScreenProps {
  /** Liga (jedna tabela) albo faza grupowa (tabela na grupę, w kolejności `Group.order`). */
  format: 'league' | 'groups'
  /** Nazwa fazy tabeli: podpis nad tytułem ekranu i nazwa tabeli ligi. */
  stageName: string
  tables: readonly StandingsScreenTable[]
  /** `PublicTournament.status`: pas „Mistrz” tylko w lidze turnieju `finished`. */
  status: string
  /** Postęp terminarza fazy (`scheduleProgress`); `null`, gdy faza nie ma meczów. */
  schedule: ScheduleProgress | null
  /** Odnośnik pustego stanu do Przeglądu. */
  overview: AnchorProps
  /** Grupy: odnośnik do Drabinki, gdy jest wygenerowana; bez niego zdanie, kiedy powstanie. */
  bracket?: AnchorProps
  /** Strefa daty startu; bez niej strefa przeglądarki (makiety podają jawną). */
  timeZone?: string
}

/** „Startuje 5 września”: dzień i miesiąc pierwszego meczu. */
function startsLabel(iso: string, timeZone?: string) {
  return `Startuje ${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', timeZone }).format(new Date(iso))}`
}

/** „4 z 14 kolejek rozegrane”: rozegrane kolejki z wszystkich w terminarzu fazy. */
function RoundsFact({ schedule }: { schedule: ScheduleProgress }) {
  return (
    <Fact value={schedule.roundsPlayed}>
      z {schedule.roundsTotal} {schedule.roundsTotal === 1 ? 'kolejki' : 'kolejek'} rozegrane
    </Fact>
  )
}

function LeagueFacts({ schedule, finished, timeZone }: { schedule: ScheduleProgress; finished: boolean; timeZone?: string }) {
  if (finished) {
    return (
      <Fact value={schedule.roundsTotal}>
        {plural(schedule.roundsTotal, ['kolejka rozegrana', 'kolejki rozegrane', 'kolejek rozegranych'])}, sezon zakończony
      </Fact>
    )
  }
  if (schedule.startsAt) return <Fact>{startsLabel(schedule.startsAt, timeZone)}</Fact>
  return <RoundsFact schedule={schedule} />
}

/** Pusty stan ekranu z odnośnikiem do Przeglądu, gdzie drużyny już stoją. */
function NotYet({ title, overview, children }: { title: string; overview: AnchorProps; children: string }) {
  return (
    <EmptyBoard title={title} action={<TextLink {...overview}>Zobacz drużyny na Przeglądzie</TextLink>}>
      {children}
    </EmptyBoard>
  )
}

/**
 * Tabela: nagłówek ekranu z podpisem fazy i faktami, pod nim tabela ligi
 * (z pasem „Mistrz” po końcu sezonu) albo tabele grup w dwóch kolumnach od
 * `lg`, a pod nimi jedno zdanie o kolejności (kryteria są wspólne). Bez
 * meczów w fazie zamiast tabeli zer stoi pusty stan.
 */
export function StandingsScreen({ format, stageName, tables, status, schedule, overview, bracket, timeZone }: StandingsScreenProps) {
  const groups = format === 'groups'
  const finished = status === 'finished'
  const title = groups ? 'Tabele grup' : 'Tabela'

  if (groups && tables.length === 0) {
    return (
      <>
        <PageHead eyebrow={stageName} title={title} />
        <NotYet title="Grupy jeszcze nie są ułożone" overview={overview}>
          Tabele pojawią się, gdy organizator podzieli drużyny na grupy i ułoży terminarz.
        </NotYet>
      </>
    )
  }

  if (schedule === null || tables.length === 0) {
    return (
      <>
        <PageHead eyebrow={stageName} title={title} />
        <NotYet title="Tabela ruszy z terminarzem" overview={overview}>
          Drużyny są już zapisane. Tabela pojawi się, gdy organizator ułoży terminarz.
        </NotYet>
      </>
    )
  }

  const tiebreakers = tables[0]!.tiebreakers

  if (groups) {
    return (
      <>
        <PageHead
          eyebrow={stageName}
          title={title}
          meta={
            <>
              <Fact value={tables.length}>{plural(tables.length, GROUPS)}</Fact>
              <RoundsFact schedule={schedule} />
            </>
          }
        />
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
          {tables.map((table, index) => (
            <GroupTable key={table.groupId ?? `bez-id-${index}`} table={{ ...table, stageName }} index={index} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <TiebreakSentence tiebreakers={tiebreakers} />
          {bracket ? (
            <TextLink {...bracket} className="self-start">
              Drabinka playoffu
            </TextLink>
          ) : (
            <p className="text-sm text-muted-foreground">Drabinka playoffu powstanie po fazie grupowej</p>
          )}
        </div>
      </>
    )
  }

  const table = tables[0]!
  const champion = finished ? table.rows.find((row) => row.position === 1) : undefined

  return (
    <>
      <PageHead eyebrow={stageName} title={title} meta={<LeagueFacts schedule={schedule} finished={finished} timeZone={timeZone} />} />
      <section aria-label={stageName} className="flex flex-col gap-6">
        {champion && <ChampionBand row={champion} scoreLabel={table.scoreLabel} />}
        <StandingsTable rows={table.rows} scoreLabel={table.scoreLabel} allowsDraw={table.allowsDraw} label={`Tabela, ${stageName}`} />
        <TiebreakSentence tiebreakers={tiebreakers} />
      </section>
    </>
  )
}

/**
 * Wczytywanie Tabeli: szkielet w kształcie ekranu (#288) — nagłówek, wiersz
 * nagłówków kolumn i osiem wierszy tabeli — zamiast ogólnego prostokąta.
 */
export function StandingsLoading() {
  return (
    <Loading label="Wczytywanie tabeli">
      <SkeletonHead />
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-5 w-full max-w-xl" />
        {Array.from({ length: 8 }, (_, index) => (
          <SkeletonBlock key={index} className="h-14 w-full" />
        ))}
        <SkeletonBlock className="mt-4 h-4 w-80 max-w-full" />
      </div>
    </Loading>
  )
}
