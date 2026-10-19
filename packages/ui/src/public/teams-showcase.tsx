import { plural, TEAMS } from '../lib/plural'
import { Crest } from './crest'
import { Fact, PageHead } from './heads'
import { showcaseTeams, type ShowcaseTeam } from './overview-stage'

/**
 * Prezentacja drużyn (#296): Przegląd przed ułożeniem terminarza, we
 * wszystkich formatach. Zamiast pasa etapu, tabeli z zerami i pustej
 * klasyfikacji same drużyny: podpis „Kto gra w turnieju”, nagłówek
 * „Drużyny” z ich liczbą, kafle z dużym herbem i nazwą alfabetycznie po
 * polsku i zdanie, kiedy pojawi się terminarz.
 */
export function TeamsShowcase({ teams }: { teams: readonly ShowcaseTeam[] }) {
  const sorted = showcaseTeams(teams)
  return (
    <section aria-labelledby="druzyny-turnieju" data-slot="teams-showcase" className="flex flex-col gap-5">
      <PageHead
        id="druzyny-turnieju"
        eyebrow="Kto gra w turnieju"
        title="Drużyny"
        meta={<Fact value={sorted.length}>{plural(sorted.length, TEAMS)}</Fact>}
      />
      {sorted.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((team) => (
            <li
              key={team.id}
              data-slot="showcase-team"
              className="flex min-w-0 flex-col items-start gap-5 rounded-md bg-card p-5 ring-1 ring-border ring-inset sm:p-6"
            >
              <Crest name={team.name} logoUrl={team.logoUrl} className="size-14 sm:size-20" />
              <span data-slot="showcase-team-name" className="w-full pub-title text-pub-28 leading-tight wrap-break-word">{team.name}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground">Terminarz pojawi się tutaj, gdy organizator go ułoży.</p>
    </section>
  )
}
