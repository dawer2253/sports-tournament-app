import { AdminShell, type AdminSectionKey, type AdminShellProps } from '../components/layout/admin-shell'
import type { TournamentRow } from '../components/data/tournament-row'
import { organizer, tournamentList } from '../lib/demo-data'

/**
 * `AdminShell` z kontem demo, dla ekranów w Storybooku.
 *
 * Sam shell wymaga propsa `user` i nie zna `lib/demo-data` — dane mock należą
 * do `screens/`, nie do `components/`. Dzięki temu panel nie wozi w bundlu
 * fikcyjnego organizera i nie może go pokazać przez pominięty props.
 *
 * Bez prefiksu `admin-` i bez `.stories.tsx`/`.mdx`, bo to nie ekran, tylko
 * wrapper dla ekranów.
 */
export function ShellDemo(props: Omit<AdminShellProps, 'user'>) {
  return <AdminShell user={organizer} {...props} />
}

/** Turniej demo, w którym stoją ekrany turnieju. */
const demoTournament = tournamentList[0]!

/**
 * `ShellDemo` wewnątrz turnieju demo. Układ nagłówka jest wspólny dla
 * wszystkich ekranów turnieju: tytuł to nazwa turnieju, podtytuł to sport
 * i adres publiczny, a sekcję pokazuje aktywna karta, nie tytuł.
 */
export function TournamentShellDemo({
  status = demoTournament.status,
  sportName = demoTournament.sport.name,
  ...props
}: Omit<AdminShellProps, 'user' | 'tournament' | 'title' | 'subtitle' | 'active'> & {
  active: AdminSectionKey
  /** Stan turnieju demo, gdy ekran pokazuje inny niż domyślny (np. szkic). */
  status?: TournamentRow['status']
  /** Sport turnieju demo, gdy ekran pokazuje inny niż domyślny. */
  sportName?: string
}) {
  return (
    <ShellDemo
      tournament={{ ...demoTournament, status, sport: { name: sportName } }}
      title={demoTournament.name}
      subtitle={`${sportName} · /t/${demoTournament.slug}`}
      {...props}
    />
  )
}
