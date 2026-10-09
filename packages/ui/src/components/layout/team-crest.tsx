import { cn } from '../../lib/utils'

// Herb zastępczy — jeden kształt i jeden kolor dla wszystkich drużyn, dopóki
// klub nie wgra własnego logo. Skrót w środku zostaje: gdyby go zabrać,
// wszystkie herby byłyby identyczne i nie niosłyby żadnej informacji, a tarcza
// zajmowałaby miejsce w wierszu tylko po to, żeby ładnie wyglądać.
export interface TeamCrestProps extends React.ComponentProps<'svg'> {
  /** Skrót drużyny, 2–3 znaki (np. „FG"). */
  abbr: string
}

export function TeamCrest({ abbr, className, ...props }: TeamCrestProps) {
  return (
    <svg
      viewBox="0 0 20 24"
      aria-hidden
      className={cn('h-6 w-5 shrink-0', className)}
      {...props}
    >
      {/* Tarcza heraldyczna: proste ramiona, boki schodzące do ostrza. */}
      <path
        d="M10 1 18 3.4v8.9c0 4.7-3.3 8.1-8 10.7-4.7-2.6-8-6-8-10.7V3.4L10 1Z"
        className="fill-crest"
      />
      {/* Tarcza zwęża się ku dołowi, więc trzyznakowy skrót dostaje mniejszy
          stopień — inaczej dotyka krawędzi. */}
      <text
        x="10"
        y="11.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={abbr.length > 2 ? 6.5 : 8.5}
        fontWeight="700"
        letterSpacing="-0.3"
        className="fill-crest-foreground"
      >
        {abbr}
      </text>
    </svg>
  )
}

/**
 * Skrót do herbu zastępczego, wyliczany z nazwy drużyny (#89 pkt 9): inicjały
 * najwyżej trzech pierwszych słów, a przy jednym słowie jego pierwsze trzy
 * litery. „Wilki Bemowo" → „WB", „Legia" → „LEG".
 *
 * Kontrakt nie ma skrótu drużyny, więc kolizje („WB" dla dwóch drużyn) są
 * akceptowane: nazwa zawsze stoi obok herbu.
 */
export function teamAbbr(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  // `Array.from` dzieli po znakach, a nie po jednostkach UTF-16, więc znak
  // spoza BMP nie zostanie przecięty w pół.
  const letters =
    words.length === 1
      ? Array.from(words[0]!).slice(0, 3)
      : words.slice(0, 3).map((word) => Array.from(word)[0]!)
  return letters.join('').toLocaleUpperCase('pl')
}
