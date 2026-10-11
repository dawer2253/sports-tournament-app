import { ChevronDown, ChevronUp, Loader2, Lock } from 'lucide-react'
import * as React from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Switch } from '../ui/switch'
import type { TiebreakerItem } from './tiebreaker-item'
import { TiebreakerOrdinal } from './tiebreaker-list'
import { Heading } from '../ui/typography'

export interface TiebreakerEditorProps {
  /**
   * Szkic: kody w kolejności priorytetu. Pierwszy jest zawsze `points`
   * (reguła z kontraktu) i stoi zablokowany na górze.
   */
  value: string[]
  onChange: (next: string[]) => void
  /**
   * Kryteria, spośród których organizer wybiera, z etykietami:
   * `availableTiebreakers` i `tiebreakerLabels` sportu. Ich kolejność jest
   * kolejnością sekcji „Nieużywane”.
   */
  available: TiebreakerItem[]
  /** Szkic różni się od zapisanej listy: pojawiają się „Zapisz” i „Odrzuć”. */
  dirty: boolean
  /** Zapis w toku: edytor i przyciski są zablokowane. */
  pending?: boolean
  /** Zdanie o skutku szkicu w tabeli, np. „Podgląd: 2 drużyny zmieniają miejsce.”. */
  preview?: string
  /** Błąd zapisu. Szkic zostaje, więc można poprawić albo ponowić. */
  error?: string
  onSave: () => void
  onDiscard: () => void
}

const itemClass = 'flex items-center gap-3 rounded-md border border-border p-2.5'

function move(list: string[], from: number, to: number): string[] {
  const next = [...list]
  const [code] = next.splice(from, 1)
  next.splice(to, 0, code!)
  return next
}

/**
 * Karta „Rozstrzyganie remisów” przy tabeli (#173, wariant z przyciskami
 * z #163). Kolejność zmieniają ↑/↓, bez biblioteki przeciągania; przełącznik
 * wyłącza kryterium do sekcji „Nieużywane”, a włączone wraca na koniec listy.
 * Każda zmiana idzie od razu do `onChange` — zapis jest osobnym krokiem.
 */
export function TiebreakerEditor({
  value,
  onChange,
  available,
  dirty,
  pending = false,
  preview,
  error,
  onSave,
  onDiscard,
}: TiebreakerEditorProps) {
  const labels = new Map(available.map((item) => [item.code, item.label]))
  const label = (code: string) => labels.get(code) ?? code
  const [pinned, ...rest] = value
  const unused = available.filter((item) => !value.includes(item.code))
  const unusedId = React.useId()
  const titleId = React.useId()

  return (
    // Region z nazwą z tytułu: `CardTitle` to nie nagłówek, a czytnik ekranu
    // ma móc przeskoczyć do karty obok tabeli.
    <Card data-slot="tiebreaker-editor" role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>Rozstrzyganie remisów</CardTitle>
        <CardDescription>Kolejność kryteriów przy równej liczbie punktów. Tabela obok pokazuje skutek przed zapisem.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol aria-label="Używane kryteria" className="grid gap-2">
          {pinned !== undefined && (
            <li className={cn(itemClass, 'border-dashed bg-muted/40')}>
              <TiebreakerOrdinal>1</TiebreakerOrdinal>
              <span className="flex-1 text-sm font-medium">{label(pinned)}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock aria-hidden className="size-4" /> zawsze pierwsze
              </span>
            </li>
          )}
          {rest.map((code, offset) => {
            const index = offset + 1
            return (
              <li key={code} className={itemClass}>
                <TiebreakerOrdinal>{index + 1}</TiebreakerOrdinal>
                <span className="flex-1 text-sm font-medium">{label(code)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Przesuń „${label(code)}” wyżej`}
                  disabled={pending || index === 1}
                  onClick={() => onChange(move(value, index, index - 1))}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Przesuń „${label(code)}” niżej`}
                  disabled={pending || index === value.length - 1}
                  onClick={() => onChange(move(value, index, index + 1))}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Switch
                  checked
                  disabled={pending}
                  aria-label={`Używaj kryterium „${label(code)}”`}
                  onCheckedChange={() => onChange(value.filter((other) => other !== code))}
                />
              </li>
            )
          })}
        </ol>
        {unused.length > 0 && (
          <section aria-labelledby={unusedId} className="grid gap-2">
            {/* Nagłówek podsekcji karty: styl z `headingVariants`, przyciszony,
                żeby nie konkurował z tytułem karty. */}
            <Heading id={unusedId} level="card" className="text-sm text-muted-foreground">
              Nieużywane
            </Heading>
            <ul className="grid gap-2">
              {unused.map((item) => (
                <li key={item.code} className={cn(itemClass, 'text-muted-foreground')}>
                  <TiebreakerOrdinal />
                  <span className="flex-1 text-sm">{item.label}</span>
                  <Switch
                    checked={false}
                    disabled={pending}
                    aria-label={`Używaj kryterium „${item.label}”`}
                    onCheckedChange={() => onChange([...value, item.code])}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-muted-foreground">Na końcu zawsze nazwa drużyny, alfabetycznie.</p>
      </CardContent>
      {(dirty || error) && (
        <CardFooter className="flex-col items-stretch gap-2 border-t">
          {dirty && preview && (
            <p role="status" className="text-xs text-muted-foreground">
              {preview}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {dirty && (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pending} onClick={onDiscard}>
                Odrzuć
              </Button>
              <Button type="button" disabled={pending} onClick={onSave}>
                {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Zapisz kolejność
              </Button>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

export interface TiebreakerSentenceProps {
  /** Kryteria w kolejności stosowania, z etykietami. */
  items: TiebreakerItem[]
  className?: string
}

/**
 * Zdanie pod tabelą z kolejnością kryteriów (#160, pytanie 7). Ostatnie,
 * ukryte kryterium jest dopisane, żeby przy pełnym remisie było widać, że
 * zdecydował alfabet.
 */
export function TiebreakerSentence({ items, className }: TiebreakerSentenceProps) {
  const steps = [...items.map((item) => item.label.toLocaleLowerCase('pl')), 'nazwa drużyny (alfabetycznie)']
  return <p className={cn('text-xs text-muted-foreground', className)}>Kolejność: {steps.join(' → ')}.</p>
}
