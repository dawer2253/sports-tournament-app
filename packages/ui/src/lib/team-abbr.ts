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
