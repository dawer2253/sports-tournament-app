import { AdminShell, type AdminShellProps } from '../components/layout/admin-shell'
import { organizer } from '../lib/demo-data'

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
