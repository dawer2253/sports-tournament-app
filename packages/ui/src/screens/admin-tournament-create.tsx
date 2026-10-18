import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { ChoiceCards, type ChoiceOption } from '../components/ui/choice-cards'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ShellDemo } from './shell-demo'

/** Formaty rozgrywek, jakie przyjmuje `POST /tournaments`. */
type Format = 'league' | 'knockout' | 'groups_playoff'

/**
 * Sporty demo. W panelu lista idzie z `GET /sports`, a ikona z mapy po `code`
 * (`apps/admin/src/pages/tournament-create.tsx`), bo kontrakt ikony nie niesie.
 */
const SPORTS: ChoiceOption<number>[] = [
  { value: 1, label: 'Piłka nożna', icon: '⚽' },
  { value: 2, label: 'Koszykówka', icon: '🏀' },
]

/** Formaty demo: te same etykiety i klucze co `TOURNAMENT_FORMATS` w panelu. */
const FORMATS: ChoiceOption<Format>[] = [
  {
    value: 'league',
    label: 'Liga każdy z każdym',
    description: 'Wszystkie drużyny grają ze sobą, o kolejności decyduje tabela punktowa.',
  },
  {
    value: 'knockout',
    label: 'Puchar (drabinka)',
    description: 'Przegrany odpada, wygrany awansuje do kolejnej rundy.',
  },
  {
    value: 'groups_playoff',
    label: 'Grupy + playoff',
    description: 'Faza grupowa wyłania najlepszych, potem rozgrywki pucharowe.',
  },
]

/** Warianty ekranu: świeży formularz, wypełniony i po odmowie walidacji z API. */
export type AdminTournamentCreateState = 'domyslny' | 'wypelniony' | 'blad'

export interface AdminTournamentCreateProps {
  state?: AdminTournamentCreateState
}

/**
 * Zakładanie turnieju: nazwa, sport i format. Ten sam ekran co pod
 * `/tournaments/new` (`apps/admin/src/pages/tournament-create.tsx`).
 *
 * Ekran to **jeden krok**, nie kreator: kroki „Drużyny" i „Terminarz" oraz
 * ustawienia ligi (mecz i rewanż, auto-harmonogram, punktacja) nie mają
 * endpointów, więc ich nie rysujemy. Drużyny dodaje się po założeniu turnieju,
 * a terminarz generuje się w jego sekcji.
 *
 * Niczego nie zaznaczamy za organizera: domyślnie zaznaczony kafelek wysłałby
 * ktoś, kto go nie przeczytał.
 */
export function AdminTournamentCreate({ state = 'domyslny' }: AdminTournamentCreateProps) {
  const filled = state !== 'domyslny'
  const invalid = state === 'blad'

  return (
    <ShellDemo
      active="dashboard"
      title="Nowy turniej"
      subtitle="Nazwa, sport i format. Drużyny i terminarz dołożysz później."
    >
      <form className="max-w-4xl" onSubmit={(event) => event.preventDefault()} noValidate>
        <Card>
          <CardContent className="flex flex-col gap-8">
            <div className="flex max-w-xl flex-col gap-2">
              <Label htmlFor="name">Nazwa turnieju</Label>
              <Input
                id="name"
                maxLength={160}
                defaultValue={filled ? 'Liga Osiedlowa 2026' : undefined}
                aria-invalid={invalid ? true : undefined}
                aria-describedby={invalid ? 'name-error' : undefined}
              />
              {invalid && (
                <p id="name-error" className="text-sm text-destructive">
                  Podaj nazwę turnieju.
                </p>
              )}
            </div>

            <ChoiceCards
              legend="Sport"
              name="sportId"
              options={SPORTS}
              value={filled ? 1 : undefined}
              onChange={() => {}}
              className="lg:grid-cols-2"
              errorMessage={invalid ? 'Wybierz sport.' : undefined}
            />

            <ChoiceCards
              legend="Format rozgrywek"
              name="format"
              options={FORMATS}
              value={filled ? 'league' : undefined}
              onChange={() => {}}
              errorMessage={invalid ? 'Wybierz format rozgrywek.' : undefined}
            />
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <Button type="button" variant="outline">
            Anuluj
          </Button>
          <Button type="submit">Załóż turniej</Button>
        </div>
      </form>
    </ShellDemo>
  )
}
