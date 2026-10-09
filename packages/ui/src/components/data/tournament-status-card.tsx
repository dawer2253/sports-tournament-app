import { ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import type { TournamentRow } from './tournament-row'
import { TournamentStatusBadge } from './tournament-status-badge'

type TournamentStatus = TournamentRow['status']

/**
 * Przejścia ze stanu w kolejności przycisków (#91 pkt 3). `draft → finished`
 * nie ma przycisku, choć kontrakt je dopuszcza: turniej kończy się po tym,
 * jak trwał.
 */
const TRANSITIONS: Record<TournamentStatus, { target: TournamentStatus; label: string }[]> = {
  draft: [{ target: 'active', label: 'Opublikuj' }],
  active: [
    { target: 'finished', label: 'Zakończ' },
    { target: 'draft', label: 'Cofnij do szkicu' },
  ],
  finished: [
    { target: 'active', label: 'Wznów' },
    { target: 'draft', label: 'Cofnij do szkicu' },
  ],
}

/** Skutek stanu jednym zdaniem: co widzą kibice. */
const EFFECT: Record<TournamentStatus, string> = {
  draft: 'Turniej nie jest opublikowany: strona publiczna nie istnieje.',
  active: 'Turniej jest opublikowany: kibice widzą terminarz, wyniki i tabelę.',
  finished: 'Rozgrywki się skończyły, ale strona publiczna działa, a wyniki nadal można poprawiać.',
}

export interface TournamentStatusCardProps {
  status: TournamentStatus
  /** Przejście wybrane przyciskiem. Potwierdzenie (np. powrotu do szkicu) należy do aplikacji. */
  onChange: (target: TournamentStatus) => void
  /** Adres strony publicznej turnieju. Link stoi tylko przy opublikowanym turnieju. */
  publicUrl: string
  /** Zmiana statusu w drodze: przyciski są zablokowane. */
  pending?: boolean
}

/**
 * Status turnieju z przyciskami przejść. To karta, a nie pole formularza, bo
 * opublikowanie jest zdarzeniem, a nie edycją: zapisuje się od razu (#91 pkt 3).
 */
export function TournamentStatusCard({ status, onChange, publicUrl, pending = false }: TournamentStatusCardProps) {
  // W szkicu link prowadziłby do `404`.
  const published = status !== 'draft'

  return (
    <Card data-slot="tournament-status-card">
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TournamentStatusBadge status={status} />
          <p className="text-sm text-muted-foreground">{EFFECT[status]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
          {TRANSITIONS[status].map(({ target, label }, index) => (
            <Button
              key={target}
              type="button"
              variant={index === 0 ? 'default' : 'outline'}
              disabled={pending}
              onClick={() => onChange(target)}
            >
              {label}
            </Button>
          ))}
          {published && (
            <Button asChild variant="link" className="ml-auto">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                Otwórz stronę <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
