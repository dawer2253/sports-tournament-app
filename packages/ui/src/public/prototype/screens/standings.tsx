/**
 * PROTOTYP S7 (#288) — Tabela: liga (piłka i kosz) i tabele grup z linią
 * wyjścia. Jeden projekt, bez wariantów: układ wynika z Przeglądu C (pełna
 * tabela z formą), tu tylko dostaje całą szerokość i legendę.
 */
import { withQualifiers } from '../../../lib/qualifiers'
import { cn } from '../../../lib/utils'
import type { TableRow } from '../demo'
import { Crest, Form } from '../parts'
import { EmptyBoard, Fact, PageHead, Shell, TextLink } from './kit'
import type { GroupTable, Season } from './screen-demo'

function signed(value: number) {
  return value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'
}

function Abbr({ title, children, className }: { title: string; children: string; className?: string }) {
  return (
    <abbr title={title} className={cn('no-underline', className)}>
      {children}
    </abbr>
  )
}

type Row = TableRow & { qualifies?: boolean; tied?: boolean }

/**
 * Tabela na całą szerokość. Kolumny stałe (wynik nie skacze), na telefonie
 * zostają #, drużyna, M, +/− i Pkt. W grupie (`compact`) bez bramek i formy,
 * bo dwie tabele stoją obok siebie.
 */
export function FullTable({
  rows,
  allowsDraw,
  scoreLabel,
  finished,
  compact,
  label,
}: {
  rows: Row[]
  allowsDraw: boolean
  scoreLabel: string
  finished?: boolean
  compact?: boolean
  label: string
}) {
  const grouped = rows.some((row) => row.qualifies !== undefined)
  const desktop = compact
    ? allowsDraw
      ? 'sm:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_2.25rem_3rem_3rem]'
      : 'sm:grid-cols-[2.25rem_minmax(0,1fr)_2.25rem_2.25rem_2.25rem_3rem_3rem]'
    : allowsDraw
      ? 'sm:grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_2.75rem_2.75rem_2.75rem_5.5rem_3.5rem_8rem_3.5rem]'
      : 'sm:grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_2.75rem_2.75rem_6.5rem_3.5rem_6rem_3.5rem]'
  const grid = cn('grid grid-cols-[2rem_minmax(0,1fr)_2rem_3rem_3rem] items-center gap-x-2', desktop)
  const num = 'text-right tabular-nums text-muted-foreground'
  const wide = 'hidden sm:block'
  const anyPlayed = rows.some((row) => row.played > 0)

  return (
    <div role="table" aria-label={label} className="text-[0.9375rem]">
      <div role="row" className={cn(grid, 'pb-2 text-xs text-muted-foreground')}>
        <span role="columnheader" className="text-center">#</span>
        <span role="columnheader">Drużyna</span>
        <span role="columnheader" className="text-right"><Abbr title="Mecze">M</Abbr></span>
        <span role="columnheader" className={cn(wide, 'text-right')}><Abbr title="Wygrane">W</Abbr></span>
        {allowsDraw && <span role="columnheader" className={cn(wide, 'text-right')}><Abbr title="Remisy">R</Abbr></span>}
        <span role="columnheader" className={cn(wide, 'text-right')}><Abbr title="Porażki">P</Abbr></span>
        {!compact && <span role="columnheader" className={cn(wide, 'text-center')}>{scoreLabel}</span>}
        <span role="columnheader" className="text-right"><Abbr title="Bilans">+/−</Abbr></span>
        {!compact && <span role="columnheader" className={cn(wide, 'pl-4')}>Forma</span>}
        <span role="columnheader" className="text-right text-foreground">Pkt</span>
      </div>
      {rows.map((row, index) => {
        const leader = !grouped && row.position === 1 && anyPlayed
        const line = grouped && row.qualifies === false && rows[index - 1]?.qualifies === true
        const strong = leader || row.qualifies
        return (
          <div
            role="row"
            key={row.team.id}
            className={cn('relative min-h-14 border-t', grid, line ? 'border-t-2 border-brand-line' : 'border-hairline')}
          >
            {leader && <span aria-hidden className="absolute inset-y-2 -left-3 w-1 rounded-full bg-brand-line" />}
            {line && (
              <span aria-hidden className="absolute right-0 top-0 -translate-y-1/2 bg-background pl-2 text-xs font-medium text-brand-text">
                wyjście z grupy
              </span>
            )}
            <span role="cell" className={cn('text-center pub-num text-xl', !strong && 'text-muted-foreground')}>
              {row.position}
              {row.qualifies && <span className="sr-only">, wychodzi z grupy</span>}
            </span>
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <Crest name={row.team.name} className="size-7" />
              {/* Dopisek idzie pod nazwę, nie obok: w wąskiej tabeli grupy obcinał ją (#288). */}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className={cn('truncate', strong ? 'font-semibold' : 'font-medium')}>{row.team.name}</span>
                {row.tied && <span className="text-xs text-muted-foreground">remis na linii</span>}
              </span>
              {leader && finished && <span className="shrink-0 text-xs font-medium text-brand-text">Mistrz</span>}
            </span>
            <span role="cell" className={num}>{row.played}</span>
            <span role="cell" className={cn(num, wide)}>{row.won}</span>
            {allowsDraw && <span role="cell" className={cn(num, wide)}>{row.drawn}</span>}
            <span role="cell" className={cn(num, wide)}>{row.lost}</span>
            {!compact && <span role="cell" className={cn(wide, 'text-center tabular-nums text-muted-foreground')}>{row.scoreFor}:{row.scoreAgainst}</span>}
            <span role="cell" className={num}>{signed(row.scoreDifference)}</span>
            {!compact && (
              <span role="cell" className={cn(wide, 'pl-4')}>
                <Form form={row.form} />
              </span>
            )}
            <span role="cell" className="text-right pub-num text-2xl">{row.points}</span>
          </div>
        )
      })}
    </div>
  )
}

function Legend({ data, compact }: { data: Season; compact?: boolean }) {
  const steps = ['punkty w tabeli', ...data.tiebreakers, 'nazwa drużyny (alfabetycznie)']
  return (
    <div className="flex flex-col gap-1.5 border-t border-hairline pt-4 text-[0.8125rem] text-muted-foreground">
      <p className="flex flex-wrap gap-x-5 gap-y-1">
        <span>M mecze</span>
        <span>W wygrane</span>
        {data.allowsDraw && <span>R remisy</span>}
        <span>P porażki</span>
        {!compact && <span>Forma: pięć ostatnich meczów, najnowszy z prawej</span>}
      </p>
      <p>Przy równej liczbie punktów: {steps.slice(1).join(' → ')}.</p>
    </div>
  )
}

function ChampionBand({ row, scoreLabel }: { row: TableRow; scoreLabel: string }) {
  return (
    <div className="flex items-center gap-4 rounded-md bg-brand px-5 py-4 text-brand-foreground sm:gap-6 sm:px-7 sm:py-5">
      <Crest name={row.team.name} className="size-12 sm:size-14" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm opacity-85">Mistrz</span>
        <span className="pub-title truncate leading-[1.2] text-3xl sm:text-[2.5rem]">{row.team.name}</span>
      </span>
      <span className="ml-auto hidden flex-col items-end text-sm sm:flex">
        <span className="opacity-85">{row.won} wygranych, {scoreLabel.toLocaleLowerCase('pl')} {row.scoreFor}:{row.scoreAgainst}</span>
      </span>
      <span className="flex flex-col items-end">
        <span className="pub-score text-5xl">{row.points}</span>
        <span className="text-xs opacity-85">pkt</span>
      </span>
    </div>
  )
}

function playedRounds(data: Season) {
  const rounds = new Map<number, boolean>()
  for (const match of data.matches) rounds.set(match.round.id, (rounds.get(match.round.id) ?? true) && match.status === 'finished')
  return [...rounds.values()].filter(Boolean).length
}

function GroupBlock({ group, data }: { group: GroupTable; data: Season }) {
  const rows = withQualifiers(group.rows, group.qualifiers)
  return (
    <section aria-labelledby={`grupa-${group.id}`} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-rule pb-2">
        <h2 id={`grupa-${group.id}`} className="pub-h2 text-[2rem]">{group.name}</h2>
        <span className="text-sm text-muted-foreground">
          wychodzą <span className="pub-num text-base text-foreground">{group.qualifiers}</span> z {group.rows.length}
        </span>
      </div>
      <FullTable rows={rows} allowsDraw={data.allowsDraw} scoreLabel={data.scoreLabel} compact label={`Tabela, ${group.name}`} />
    </section>
  )
}

export function StandingsScreen({ data, accent }: { data: Season; accent: string }) {
  const finished = data.state === 'zakonczony'
  const done = playedRounds(data)
  const empty = data.state === 'bez-terminarza'

  if (data.format === 'grupy') {
    return (
      <Shell tournament={data.tournament} tabs={data.tabs} active="standings" accent={accent}>
        <PageHead
          eyebrow="Faza grupowa"
          title="Tabele grup"
          meta={
            !empty && (
              <>
                <Fact value={data.groups.length}>grupy</Fact>
                <Fact value={Math.min(done, 3)}>z 3 kolejek rozegrane</Fact>
              </>
            )
          }
        />
        {empty ? (
          <EmptyBoard title="Grupy jeszcze nie są ułożone" action={<TextLink>Zobacz drużyny na Przeglądzie</TextLink>}>
            Tabele pojawią się, gdy organizator podzieli drużyny na grupy i ułoży terminarz.
          </EmptyBoard>
        ) : (
          <>
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
              {data.groups.map((group) => <GroupBlock key={group.id} group={group} data={data} />)}
            </div>
            <div className="flex flex-col gap-4">
              <Legend data={data} compact />
              <TextLink className="self-start">
                {finished ? 'Drabinka playoffu' : 'Drabinka playoffu powstanie po fazie grupowej'}
              </TextLink>
            </div>
          </>
        )}
      </Shell>
    )
  }

  const champion = finished ? data.table[0] : undefined
  return (
    <Shell tournament={data.tournament} tabs={data.tabs} active="standings" accent={accent}>
      <PageHead
        eyebrow="Faza zasadnicza"
        title="Tabela"
        meta={
          !empty &&
          (finished ? (
            <Fact value={data.roundsTotal}>kolejek rozegranych, sezon zakończony</Fact>
          ) : data.state === 'przed-startem' ? (
            <Fact>Startuje w sobotę 5 września</Fact>
          ) : (
            <Fact value={done}>z {data.roundsTotal} kolejek rozegrane</Fact>
          ))
        }
      />
      {empty ? (
        <EmptyBoard title="Tabela ruszy z terminarzem" action={<TextLink>Zobacz drużyny na Przeglądzie</TextLink>}>
          Drużyny są już zapisane. Tabela pojawi się, gdy organizator ułoży terminarz.
        </EmptyBoard>
      ) : (
        <div className="flex flex-col gap-6">
          {champion && <ChampionBand row={champion} scoreLabel={data.scoreLabel} />}
          <FullTable rows={data.table} allowsDraw={data.allowsDraw} scoreLabel={data.scoreLabel} finished={finished} label="Tabela" />
          <Legend data={data} />
        </div>
      )}
    </Shell>
  )
}
