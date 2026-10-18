import { GroupCompositionEditor } from '../components/data/group-composition'
import { Card, CardContent } from '../components/ui/card'
import { Heading } from '../components/ui/typography'
import { teams } from '../lib/demo-data'
import type { GroupCompositionGroup } from '../lib/group-composition'
import { TournamentShellDemo } from './shell-demo'

/** Sześć drużyn demo — tyle, ile starcza na dwie trzyosobowe grupy. */
const demoTeams = teams.slice(0, 6).map(({ id, name }) => ({ id, name }))

/** Zapisany skład: dwie grupy po trzy drużyny, po dwóch wychodzących. */
const saved: GroupCompositionGroup[] = [
  { name: 'Grupa A', qualifiers: 2, teamIds: demoTeams.slice(0, 3).map((team) => team.id) },
  { name: 'Grupa B', qualifiers: 2, teamIds: demoTeams.slice(3).map((team) => team.id) },
]

/** Warianty ekranu: zapisany skład, skład z terminarzem i skład zamrożony. */
export type AdminGroupsState = 'zapisany' | 'z-terminarzem' | 'zamrozony'

export interface AdminGroupsProps {
  state?: AdminGroupsState
}

/**
 * Skład fazy grupowej: ten sam ekran co pod `/tournaments/{id}/groups`
 * (`apps/admin/src/pages/tournament-groups.tsx`).
 *
 * Ekran dokłada shell, nagłówek sekcji i kartę — reszta to wspólny
 * `GroupCompositionEditor`, ten sam, którego używa panel. Skład jest
 * kontrolowany przez ekran w aplikacji; makieta pokazuje jeden zapisany szkic.
 */
export function AdminGroups({ state = 'zapisany' }: AdminGroupsProps) {
  return (
    <TournamentShellDemo active="groups">
      <div className="grid gap-4">
        <div>
          <Heading level="card">Skład grup</Heading>
          <p className="mt-1 text-sm text-muted-foreground">
            Skład zastępuje się w całości: każda drużyna turnieju dokładnie raz, co najmniej dwie drużyny
            w grupie. Zapis skasuje terminarz grup.
          </p>
        </div>
        <Card>
          <CardContent>
            <GroupCompositionEditor
              teams={demoTeams}
              value={saved}
              onChange={() => {}}
              onSave={() => {}}
              frozen={state === 'zamrozony'}
              scheduledMatchesCount={state === 'z-terminarzem' ? 6 : 0}
            />
          </CardContent>
        </Card>
      </div>
    </TournamentShellDemo>
  )
}
