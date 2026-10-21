import { MetaList } from './meta-list'

/**
 * Podtytuł turnieju w nagłówku panelu: sport i adres strony publicznej, dwa
 * fakty rozdzielone kreską `MetaList`, nie „·” (#306). Jedna kopia dla
 * panelu i ekranów Storybooka.
 */
export function TournamentSubtitle({ sportName, slug }: { sportName: string; slug: string }) {
  return (
    <MetaList>
      <span>{sportName}</span>
      <span>/t/{slug}</span>
    </MetaList>
  )
}
