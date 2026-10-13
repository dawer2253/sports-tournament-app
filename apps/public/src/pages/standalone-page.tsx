/** Strona bez shella turnieju: turnieju nie ma, nie przyszedł albo adres jest spoza `/t/:slug`. */
export function StandalonePage({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">{children}</main>;
}
