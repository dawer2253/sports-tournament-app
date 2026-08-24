import { Trophy } from 'lucide-react'
import { cn } from '../lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { PublicShell } from '../components/layout/public-shell'
import { PhotoPanel } from '../components/layout/photo-panel'
import { TeamCrest } from '../components/layout/team-crest'
import { bracket, bracketWinner } from '../lib/demo-data'
import type { BracketMatch, BracketRound, Team } from '../lib/demo-data'
import fieldImg from '../assets/public/field.webp'

// Drzewo pokazuje najwyżej tyle ostatnich rund. Przy 64 drużynach pierwsza
// runda to 32 mecze — narysowana w drzewie daje kolumnę wysoką na kilka
// tysięcy pikseli, której i tak nikt nie przewinie. Wcześniejsze rundy idą
// więc do selektora i tam są tym, czym naprawdę są: listą wyników.
const TREE_ROUNDS = 3

function TeamRow({
  team,
  score,
  isWinner,
  border,
}: {
  team: Team | null
  score: number | null
  isWinner: boolean
  border: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        border && 'border-b',
        isWinner ? 'font-medium' : 'text-muted-foreground',
      )}
    >
      <TeamCrest abbr={team?.abbr ?? '?'} className="h-5 w-4" />
      <span className="min-w-0 flex-1 truncate">{team?.name ?? 'Do ustalenia'}</span>
      <span className="tabular-nums">{score ?? '–'}</span>
    </div>
  )
}

function MatchCard({ match, final }: { match: BracketMatch; final?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card text-sm',
        final && 'ring-2 ring-primary',
      )}
    >
      <TeamRow
        team={match.home}
        score={match.homeScore}
        isWinner={match.winner === 'home'}
        border
      />
      <TeamRow
        team={match.away}
        score={match.awayScore}
        isWinner={match.winner === 'away'}
        border={false}
      />
    </div>
  )
}

/** Kolumna jednej rundy w drzewie. Mecze łączone parami — para wchodzi w jeden
 *  mecz następnej rundy, więc klamra po prawej rysuje dokładnie tę zależność. */
function RoundColumn({ round, last }: { round: BracketRound; last: boolean }) {
  const pairs: BracketMatch[][] = []
  for (let i = 0; i < round.matches.length; i += 2) pairs.push(round.matches.slice(i, i + 2))

  return (
    <div className="flex shrink-0 flex-col">
      {/* Nagłówek poza strumieniem rozkładania meczów — inaczej justify-around
          rozjeżdża etykiety rund na różne wysokości. */}
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {round.name}
      </h3>
      <div className="flex flex-1 flex-col justify-around gap-6">
        {pairs.map((pair, i) => (
          <div
            key={i}
            className={cn(
              'relative flex w-56 flex-col justify-around gap-6',
              // Klamra do następnej rundy — tylko gdy para faktycznie się schodzi.
              !last &&
                pair.length === 2 &&
                'after:pointer-events-none after:absolute after:-right-4 after:top-1/4 after:h-1/2 after:w-4 after:rounded-r-md after:border-y after:border-r after:border-border',
              !last &&
                pair.length === 1 &&
                'after:pointer-events-none after:absolute after:-right-4 after:top-1/2 after:w-4 after:border-t after:border-border',
            )}
          >
            {pair.map((match, j) => (
              <MatchCard key={j} match={match} final={last && round.matches.length === 1} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function WinnerCard({ team }: { team: Team }) {
  return (
    <div className="flex shrink-0 flex-col">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Zwycięzca
      </h3>
      <div className="flex flex-1 flex-col justify-center">
        {/* Mocna nakładka, nie „texture" — na tej karcie zdjęcie jest tłem dla
            trzech elementów tekstu, więc kontrast wygrywa z widocznością murawy. */}
        <PhotoPanel
          src={fieldImg}
          focus="50% 45%"
          overlay="strong"
          className="w-56 rounded-xl px-5 py-8 text-center"
        >
          <Trophy className="mx-auto mb-3 size-8 drop-shadow" />
          <p className="text-lg font-bold drop-shadow">{team.name}</p>
          <p className="mt-1 text-sm text-brand-foreground/90 drop-shadow">Mistrz 2026</p>
        </PhotoPanel>
      </div>
    </div>
  )
}

/** Runda spoza drzewa — siatka wyników. Skaluje się do 32 meczów bez zmian. */
function RoundGrid({ round }: { round: BracketRound }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {round.matches.map((match, i) => (
        <MatchCard key={i} match={match} />
      ))}
    </div>
  )
}

export interface PublicBracketProps {
  rounds?: BracketRound[]
  winner?: Team
}

export function PublicBracket({ rounds = bracket, winner = bracketWinner }: PublicBracketProps) {
  const treeRounds = rounds.slice(-TREE_ROUNDS)
  const earlierRounds = rounds.slice(0, -TREE_ROUNDS)

  const tree = (
    <div className="flex gap-8 overflow-x-auto pb-4">
      {treeRounds.map((round, i) => (
        <RoundColumn key={round.name} round={round} last={i === treeRounds.length - 1} />
      ))}
      <WinnerCard team={winner} />
    </div>
  )

  return (
    <PublicShell active="bracket">
      {earlierRounds.length === 0 ? (
        tree
      ) : (
        <Tabs defaultValue="tree">
          <TabsList className="mb-4">
            <TabsTrigger value="tree">Drabinka</TabsTrigger>
            {earlierRounds.map((round) => (
              <TabsTrigger key={round.name} value={round.name}>
                {round.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="tree">{tree}</TabsContent>
          {earlierRounds.map((round) => (
            <TabsContent key={round.name} value={round.name}>
              <RoundGrid round={round} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Faza pucharowa rozgrywana systemem jednomeczowym. Wyniki tylko do odczytu.
        {earlierRounds.length > 0 &&
          ' Drzewo pokazuje trzy ostatnie rundy — wcześniejsze wybierz powyżej.'}
      </p>
    </PublicShell>
  )
}
