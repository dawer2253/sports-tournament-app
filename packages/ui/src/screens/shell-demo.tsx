import {
  AdminShell, type AdminSectionKey, type AdminShellProps, type AdminShellTournamentList,
} from '../components/layout/admin-shell'
import { TournamentSubtitle } from '../components/layout/tournament-subtitle'
import { isCurrentTournament, type TournamentRow } from '../components/data/tournament-row'
import { organizer, tournamentList } from '../lib/demo-data'

/** Bieżące turnieje demo w sidebarze, tak jak oddaje je API: bez zakończonych. */
const demoTournaments: AdminShellTournamentList = (() => {
  const items = tournamentList.filter(isCurrentTournament)
  return { status: 'success', items, total: items.length }
})()

/**
 * `AdminShell` z kontem i listą turniejów demo, dla ekranów w Storybooku.
 *
 * Sam shell wymaga propsów `user` i `tournaments` i nie zna `lib/demo-data` —
 * dane mock należą do `screens/`, nie do `components/`. Dzięki temu panel nie
 * wozi w bundlu fikcyjnego organizera ani turniejów i nie może ich pokazać
 * przez pominięty props.
 *
 * Bez prefiksu `admin-` i bez `.stories.tsx`/`.mdx`, bo to nie ekran, tylko
 * wrapper dla ekranów.
 */
export function ShellDemo(props: Omit<AdminShellProps, 'user' | 'tournaments'>) {
  return <AdminShell user={organizer} tournaments={demoTournaments} {...props} />
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
}: Omit<AdminShellProps, 'user' | 'tournaments' | 'tournament' | 'title' | 'subtitle' | 'active'> & {
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
      subtitle={<TournamentSubtitle sportName={sportName} slug={demoTournament.slug} />}
      {...props}
    />
  )
}
