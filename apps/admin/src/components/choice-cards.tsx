import { CheckCircle2 } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle, cn } from '@tournament/ui';
import { useId, type ReactNode } from 'react';

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  /** Ikona albo emoji w kafelku. Bez tego kafelek ma sam tytuł i opis. */
  icon?: ReactNode;
}

export interface ChoiceCardsProps<T extends string | number> {
  /** Nagłówek grupy, czytany przez czytnik ekranu razem z każdą opcją. */
  legend: string;
  /** Wspólna nazwa pola dla natywnych `input[type=radio]`. */
  name: string;
  options: ChoiceOption<T>[];
  /** Niewybrane pole react-hook-form podaje jako `undefined`. */
  value: T | null | undefined;
  onChange: (value: T) => void;
  onBlur?: () => void;
  errorMessage?: string;
  /** Id komunikatu błędu, wskazywane przez `aria-describedby` grupy. */
  errorId?: string;
  className?: string;
}

/**
 * Wybór jednej opcji, pokazany jako kafelki z makiety `Ekrany/Admin · Kreator
 * turnieju`.
 *
 * Pod spodem siedzą natywne `input[type=radio]` schowane przez `sr-only`, a nie
 * klikalne `div`-y jak w statycznej makiecie. Dzięki temu strzałki, tabulator,
 * spacja i czytnik ekranu działają bez pisania czegokolwiek, a kafelek zostaje
 * wyłącznie wyglądem. Fokus jest widoczny, bo obramowanie rysuje `has-focus`
 * na etykiecie, nie na ukrytym polu.
 *
 * Nazwę i opis wskazujemy jawnie przez `aria-labelledby` i `aria-describedby`,
 * chociaż etykieta otacza pole. Domyślnie nazwa brałaby całą treść etykiety,
 * czyli emoji plus dwa zdania opisu — czytnik ekranu przeczytałby to zamiast
 * samej nazwy opcji. Opis zostaje opisem, a nie częścią nazwy.
 *
 * Komponent jest lokalny dla panelu, a nie w `packages/ui`: to pierwszy taki
 * wybór w projekcie i nie wiadomo jeszcze, czy drugi ekran będzie chciał tego
 * samego. Do design systemu przeniesie się, gdy pojawi się drugi konsument.
 */
export function ChoiceCards<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
  onBlur,
  errorMessage,
  errorId,
  className,
}: ChoiceCardsProps<T>) {
  const groupId = useId();

  return (
    <fieldset aria-describedby={errorMessage ? errorId : undefined}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>

      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {options.map((option) => {
          const selected = option.value === value;
          const labelId = `${groupId}-${option.value}-label`;
          const descriptionId = `${groupId}-${option.value}-description`;
          return (
            <label
              key={option.value}
              className={cn(
                'relative cursor-pointer rounded-xl transition-shadow hover:shadow-md',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2',
                'has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                onBlur={onBlur}
                aria-labelledby={labelId}
                aria-describedby={option.description ? descriptionId : undefined}
              />
              <Card
                className={cn(
                  'h-full',
                  selected && 'ring-2 ring-primary',
                  errorMessage && !selected && 'border-destructive/50',
                )}
              >
                {selected && (
                  <CheckCircle2 className="absolute right-3 top-3 size-5 text-primary" />
                )}
                <CardHeader>
                  {option.icon && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        'mb-2 grid size-10 place-items-center rounded-lg text-xl',
                        selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {option.icon}
                    </div>
                  )}
                  <CardTitle id={labelId}>{option.label}</CardTitle>
                  {option.description && (
                    <CardDescription id={descriptionId}>{option.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </label>
          );
        })}
      </div>

      {errorMessage && (
        <p id={errorId} className="mt-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </fieldset>
  );
}
