import { Save, Shuffle, X } from 'lucide-react'
import { useId } from 'react'
import { cn } from '../../lib/utils'
import { groupCompositionError, dealGroups, type GroupCompositionGroup, type GroupCompositionTeam } from '../../lib/group-composition'
import { MATCHES, TEAMS, plural } from '../../lib/plural'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'


export interface GroupCompositionEditorProps {
  teams: GroupCompositionTeam[]
  /** Szkic składu; komponent jest kontrolowany (jak SeedingList). */
  value: GroupCompositionGroup[]
  onChange: (groups: GroupCompositionGroup[]) => void
  onSave: () => void
  /** Zapis w toku — cały edytor stoi. */
  saving?: boolean
  /** Komunikat odmowy z API (422 pod `groups`), nad przyciskami. */
  error?: string
  /** Faza ma mecz rozpoczęty — skład zamrożony, zapisu nie ma. */
  frozen?: boolean
  /** Ile meczów skasuje zapis; 0 albo brak ukrywa ostrzeżenie. */
  scheduledMatchesCount?: number
  /** Najwyższa liczba grup; domyślnie 8. */
  maxGroups?: number
  /** Źródło losowości losowania, żeby story miało wynik deterministyczny. */
  random?: () => number
  className?: string
}

/**
 * Edytor składu grup fazy (#258): pasek z liczbą grup, losowaniem i zapisem,
 * kafel na grupę (nazwa, liczba wychodzących, drużyny) oraz pula „Bez grupy".
 * Komponent jest kontrolowany — trzyma wyłącznie prezentację i reguły widoczne
 * w szkicu; `value` i `onChange` należą do ekranu, jak w `SeedingList`.
 * Obowiązują reguły kontraktu: każda drużyna turnieju dokładnie raz, po co
 * najmniej dwie na grupę, `qualifiers` między 1 a liczebnością grupy, a suma
 * wychodzących co najmniej 2.
 */
export function GroupCompositionEditor({
  teams,
  value,
  onChange,
  onSave,
  saving = false,
  error,
  frozen = false,
  scheduledMatchesCount = 0,
  maxGroups = 8,
  random = Math.random,
  className,
}: GroupCompositionEditorProps) {
  const groupCountId = useId()
  // Zamrożony skład i trwający zapis zatrzymują cały edytor, nie tylko przycisk.
  const locked = frozen || saving
  const maxAllowed = Math.min(maxGroups, Math.max(1, Math.floor(teams.length / 2)))
  const invalid = groupCompositionError(value, teams)

  const assigned = new Set(value.flatMap((group) => group.teamIds))
  const unassigned = teams.filter((team) => !assigned.has(team.id))

  function replace(index: number, patch: (group: GroupCompositionGroup) => GroupCompositionGroup) {
    onChange(value.map((group, position) => (position === index ? patch(group) : group)))
  }

  function deal(count: number) {
    const target = Math.max(1, Math.min(count, maxAllowed))
    onChange(dealGroups(teams, value, target, random))
  }

  return (
    <div data-slot="group-composition" className={cn('grid content-start gap-4', className)}>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor={groupCountId}>Liczba grup</Label>
          <Select value={String(value.length)} onValueChange={(next) => deal(Number(next))} disabled={locked}>
            <SelectTrigger id={groupCountId} aria-label="Liczba grup" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxAllowed }, (_, index) => index + 1).map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" disabled={locked} onClick={() => deal(value.length)}>
          <Shuffle className="size-4" /> Losuj
        </Button>
        <Button type="button" className="ml-auto" disabled={locked || invalid !== undefined} onClick={onSave}>
          <Save className="size-4" /> Zapisz skład grup
        </Button>
      </div>

      {invalid && <p className="text-sm text-destructive">{invalid}</p>}

      {frozen && (
        <p className="text-xs text-muted-foreground">Faza ma mecz rozpoczęty, więc skład grup jest zamrożony.</p>
      )}

      {!frozen && scheduledMatchesCount > 0 && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Zapis składu skasuje terminarz grup ({scheduledMatchesCount} {plural(scheduledMatchesCount, MATCHES)}), także
          terminy i wyniki.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {value.map((group, index) => (
          <div key={index} className="grid content-start gap-3 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="shrink-0 font-medium">
                {group.name}
              </Badge>
              <Input
                aria-label={`Nazwa grupy ${index + 1}`}
                value={group.name}
                maxLength={40}
                disabled={locked}
                onChange={(event) => replace(index, (current) => ({ ...current, name: event.target.value }))}
                className="h-8"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>wychodzi</span>
                <Select
                  value={String(group.qualifiers)}
                  onValueChange={(next) => replace(index, (current) => ({ ...current, qualifiers: Number(next) }))}
                  disabled={locked}
                >
                  <SelectTrigger size="sm" className="w-16" aria-label="Ile drużyn wychodzi z grupy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.max(group.teamIds.length, 1) }, (_, position) => position + 1).map(
                      (count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground">
                {group.teamIds.length} {plural(group.teamIds.length, TEAMS)}
              </span>
            </div>
            <ul className="space-y-1">
              {group.teamIds.map((teamId) => {
                const team = teams.find((candidate) => candidate.id === teamId)
                if (!team) return null
                return (
                  <li key={teamId} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                    <span className="min-w-0 flex-1 truncate">{team.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Usuń ${team.name} z grupy`}
                      disabled={locked}
                      onClick={() =>
                        replace(index, (current) => ({
                          ...current,
                          teamIds: current.teamIds.filter((id) => id !== teamId),
                        }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                )
              })}
              {group.teamIds.length === 0 && (
                <li className="text-xs text-muted-foreground">Pusta grupa — losuj albo przypisz drużyny ręcznie.</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid content-start gap-3 rounded-xl border border-dashed bg-card p-3">
        <Badge variant="secondary" className="w-fit shrink-0 font-medium">
          Bez grupy
        </Badge>
        <ul className="space-y-1">
          {unassigned.map((team) => (
            <li key={team.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{team.name}</span>
              <Select
                value=""
                disabled={locked || value.length === 0}
                onValueChange={(next) =>
                  replace(Number(next), (current) => ({ ...current, teamIds: [...current.teamIds, team.id] }))
                }
              >
                <SelectTrigger size="sm" className="w-44" aria-label="Przypisz drużynę do grupy">
                  <SelectValue placeholder="Przypisz do grupy" />
                </SelectTrigger>
                <SelectContent>
                  {value.map((group, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
          {unassigned.length === 0 && (
            <li className="text-xs text-muted-foreground">Każda drużyna ma grupę.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
