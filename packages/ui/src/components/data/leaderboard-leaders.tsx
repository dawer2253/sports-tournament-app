import { TeamLogo } from '../layout/team-logo'
import { LEADERBOARD_EMPTY, leaderboardLeaders, type LeaderboardRow } from './leaderboard-data'

export interface LeaderboardLeadersProps {
  /** Etykieta statystyki z odpowiedzi; stoi pod liczbą lidera. */
  label: string
  /** Wiersze klasyfikacji w kolejności z API; karta bierze `leaderboardLeaders`. */
  rows: LeaderboardRow[]
}

/**
 * Lider klasyfikacji na Przeglądzie (#192, #207), bez zdjęcia. Liderzy
 * (`position: 1`) stoją na górze z dużą liczbą i etykietą statystyki pod nią,
 * a pozostałe wiersze idą drobniej, jak skrót tabeli obok. Kolumny są stałe,
 * więc liczby stoją jedna pod drugą niezależnie od długości nazwisk.
 */
export function LeaderboardLeaders({ label, rows }: LeaderboardLeadersProps) {
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{LEADERBOARD_EMPTY}.</p>
  }

  return (
    <ol aria-label={`Czołówka klasyfikacji: ${label}`} className="flex flex-col gap-1">
      {leaderboardLeaders(rows).map((row) =>
        row.position === 1 ? (
          <li
            key={row.player.id}
            className="grid grid-cols-[1rem_1.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-primary/5 px-2 py-2"
          >
            <span className="text-center font-bold tabular-nums text-primary">{row.position}</span>
            <TeamLogo logoUrl={row.team.logoUrl} name={row.team.name} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{row.player.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.team.name}</span>
            </span>
            <span className="text-right leading-none">
              <span className="block text-2xl font-extrabold tabular-nums">{row.value}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
            </span>
          </li>
        ) : (
          <li
            key={row.player.id}
            className="grid grid-cols-[1rem_1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-2 py-1.5 text-sm"
          >
            <span className="text-center font-semibold tabular-nums text-muted-foreground">{row.position}</span>
            <TeamLogo logoUrl={row.team.logoUrl} name={row.team.name} />
            <span className="min-w-0 truncate font-medium">
              {row.player.name}
              <span className="sr-only">, {row.team.name}</span>
            </span>
            <span className="text-right font-bold tabular-nums">
              {row.value}
              <span className="sr-only"> ({label})</span>
            </span>
          </li>
        ),
      )}
    </ol>
  )
}
