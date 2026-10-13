import type * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import type { StatOption } from './leaderboard-row'

export interface StatSwitcherProps {
  /** `PublicTournament.stats`, w kolejności `availableStats` sportu. */
  stats: StatOption[]
  /** Kod wybranej statystyki. */
  value: string
  /** Wybór innej statystyki; wywołujący trzyma go np. w adresie (`?stat=`). */
  onValueChange: (code: string) => void
  /** Treść panelu wybranej statystyki, np. `LeaderboardTable`. */
  children: React.ReactNode
}

/**
 * Przełącznik statystyk na ekranie „Statystyki” (#207). Zakładki sterują
 * jednym panelem z treścią wybranej statystyki, więc zakładka i panel są
 * połączone jak w ARIA tabs, a nie są samymi przyciskami nad treścią.
 *
 * Wyboru nie trzyma u siebie: kontrolowany `value` pozwala go odtworzyć
 * z adresu i wysłać link do konkretnej klasyfikacji.
 */
export function StatSwitcher({ stats, value, onValueChange, children }: StatSwitcherProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="gap-4">
      {/* Trzy statystyki piłki mieszczą się na telefonie; dłuższa lista
          przewija się w bok, zamiast łamać zakładki. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList aria-label="Statystyka">
          {stats.map((stat) => (
            <TabsTrigger key={stat.code} value={stat.code} className="px-3">
              {stat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={value}>{children}</TabsContent>
    </Tabs>
  )
}
