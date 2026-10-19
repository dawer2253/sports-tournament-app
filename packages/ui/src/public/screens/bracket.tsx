/**
 * Ekran Drabinki strony publicznej (#293): nagłówek ekranu i drzewo w oknie
 * rund albo pusty stan. Dane w propsach (#289 pkt 8): story podaje demo,
 * a strona w `apps/public` pobiera mecze fazy, trzyma start okna w `?od=`
 * i liczy notkę o rozjeździe.
 */
import { bracketChampion, bracketTeamsInPlay } from '../../lib/bracket'
import { plural, TEAMS } from '../../lib/plural'
import { cn } from '../../lib/utils'
import { groupsQualifiersSentence } from '../bracket-notes'
import { BracketTree, type BracketTreeProps, type PublicBracketMatch } from '../bracket'
import { EmptyBoard } from '../board'
import { TextLink } from '../button'
import { Fact, PageHead } from '../heads'
import type { PublicNavKey } from '../public-nav'
import { Loading, SkeletonBlock, SkeletonHead } from '../skeleton'

/**
 * Format turnieju z jego faz („Format” w `CONTEXT.md`): liga nie ma drabinki,
 * puchar ma ją zamiast Tabeli, a turniej z grupami ma playoff po grupach.
 */
export type BracketFormat = 'league' | 'knockout' | 'groups_playoff'

export interface BracketScreenProps<M extends PublicBracketMatch> extends Omit<BracketTreeProps<M>, 'className'> {
  format: BracketFormat
  /** Grupy fazy grupowej (`Group.qualifiers`): zdanie pustego stanu przed drabinką. */
  groups?: readonly { qualifiers: number }[]
  /** Notka o rozjeździe z tabelami grup (`divergenceNote`); bez niej nic. */
  divergence?: string | null
  /** Adres zakładki dla odnośników pustych stanów. */
  navHref?: (key: PublicNavKey) => string | undefined
  /** Przejęcie kliknięcia w odnośnik do zakładki, np. przez router. */
  onNavigate?: (key: PublicNavKey) => void
}

/**
 * Drabinka: podpis „Puchar” albo „Playoff”, tytuł i fakt o drużynach w grze
 * („6 z 16 drużyn w grze”, po finale „16 drużyn, puchar rozstrzygnięty”),
 * pod nim drzewo. Nad drzewem turnieju z grupami stoi notka o rozjeździe,
 * gdy jest.
 *
 * Puste stany: liga pod `/drabinka` odsyła do Tabeli, puchar bez drabinki
 * do Przeglądu (pokazuje drużyny, #296), a turniej z grupami przed drabinką
 * do tabel grup, z liczbą wychodzących z `Group.qualifiers`.
 */
export function BracketScreen<M extends PublicBracketMatch>({
  format,
  matches,
  groups = [],
  divergence,
  navHref,
  onNavigate,
  ...tree
}: BracketScreenProps<M>) {
  const link = (key: PublicNavKey, label: string) => (
    <TextLink href={navHref?.(key)} onNavigate={onNavigate && (() => onNavigate(key))}>
      {label}
    </TextLink>
  )

  if (format === 'league') {
    return (
      <>
        <PageHead title="Drabinka" />
        <EmptyBoard title="Ten turniej nie ma drabinki" action={link('standings', 'Przejdź do tabeli')}>
          Drabinkę ma faza pucharowa. Ten turniej gra w tabeli.
        </EmptyBoard>
      </>
    )
  }

  const playoff = format === 'groups_playoff'
  const { inPlay, total } = bracketTeamsInPlay(matches)
  const decided = bracketChampion(matches) !== null
  const head = (
    <PageHead
      eyebrow={playoff ? 'Playoff' : 'Puchar'}
      title="Drabinka"
      meta={
        matches.length > 0 &&
        (decided ? (
          <Fact value={total}>
            {plural(total, TEAMS)}, {playoff ? 'playoff' : 'puchar'} rozstrzygnięty
          </Fact>
        ) : (
          <Fact value={inPlay}>z {total} drużyn w grze</Fact>
        ))
      }
    />
  )

  if (matches.length === 0) {
    return (
      <>
        {head}
        {playoff ? (
          <EmptyBoard title="Drabinka powstanie po fazie grupowej" action={link('standings', 'Zobacz tabele grup')}>
            {groupsQualifiersSentence(groups)} Pary playoffu pojawią się tutaj, gdy organizator je ułoży.
          </EmptyBoard>
        ) : (
          <EmptyBoard title="Drabinka jeszcze nie jest ułożona" action={link('home', 'Zobacz drużyny na Przeglądzie')}>
            Pary pojawią się tutaj, gdy organizator rozstawi drużyny.
          </EmptyBoard>
        )}
      </>
    )
  }

  return (
    <>
      {head}
      <div className="flex flex-col gap-6">
        {divergence && (
          <p role="status" data-slot="bracket-divergence" className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            {divergence}
          </p>
        )}
        <BracketTree matches={matches} {...tree} />
      </div>
    </>
  )
}

/**
 * Wczytywanie Drabinki: szkielet w kształcie ekranu (#288) — nagłówek,
 * przełącznik rund i kolumny kafli; na telefonie jedna kolumna.
 */
export function BracketLoading() {
  return (
    <Loading label="Wczytywanie drabinki">
      <SkeletonHead />
      <div className="flex flex-col gap-5">
        <SkeletonBlock className="h-11 w-full" />
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-3 lg:grid-cols-4">
          {[4, 2, 1, 1].map((tiles, column) => (
            <div
              key={column}
              className={cn('flex-col justify-around gap-3.5', column === 0 ? 'flex' : column < 3 ? 'hidden sm:flex' : 'hidden lg:flex')}
            >
              <SkeletonBlock className="h-14 w-full" />
              {Array.from({ length: tiles }, (_, index) => (
                <SkeletonBlock key={index} className="h-[92px] w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Loading>
  )
}
