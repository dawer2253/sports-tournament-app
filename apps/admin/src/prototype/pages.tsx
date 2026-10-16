// PROTOTYP (#251) — strony podpinane pod /tournaments/:id/{teams,groups,schedule,standings,bracket}. Nie do main.
//
// Bez `?variant=` strona oddaje zwykły ekran panelu, więc gałąź nie zmienia
// domyślnego zachowania; warianty włącza dopiero `?variant=` (domyślnie A).
// Wejście do prototypu daje karta „Grupy”, a pływający przełącznik zmienia
// wariant bez gubienia go przy przejściu między sekcjami.
import type { ReactNode } from 'react';
import { TournamentBracketPage } from '../pages/tournament-bracket';
import { TournamentSchedulePage } from '../pages/tournament-schedule';
import { TournamentStandingsPage } from '../pages/tournament-standings';
import { TeamsPage } from '../pages/teams';
import { PrototypeSwitcher } from './switcher';
import { useVariantParam } from './variant';
import { BracketScreenA, GroupsScreenA, ScheduleScreenA, StandingsScreenA } from './variants-a';
import { BracketScreenB, GroupsScreenB, ScheduleScreenB, StandingsScreenB } from './variants-b';
import { BracketScreenC, GroupsScreenC, ScheduleScreenC, StandingsScreenC, TeamsScreenC } from './variants-c';

function Prototype({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Zapas na pływający panel stanu, żeby nie zasłaniał ostatnich meczów. */}
      <div className="pb-72">{children}</div>
      <PrototypeSwitcher />
    </>
  );
}

export function TeamsPrototypePage() {
  const variant = useVariantParam();
  if (variant === null) return <TeamsPage />;
  // Wariant C prowadzi skład grup przy drużynach; A i B zostawiają zwykłą listę.
  return <Prototype>{variant === 'C' ? <TeamsScreenC /> : <TeamsPage />}</Prototype>;
}

export function GroupsPrototypePage() {
  const variant = useVariantParam();
  // Karty „Grupy” nie ma w panelu bez prototypu, więc ta trasa zawsze włącza
  // wariant — domyślnie A, który niesie osobny ekran składu grup.
  return (
    <Prototype>
      {variant === 'B' ? <GroupsScreenB /> : variant === 'C' ? <GroupsScreenC /> : <GroupsScreenA />}
    </Prototype>
  );
}

export function SchedulePrototypePage() {
  const variant = useVariantParam();
  if (variant === null) return <TournamentSchedulePage />;
  return (
    <Prototype>
      {variant === 'A' ? <ScheduleScreenA /> : variant === 'B' ? <ScheduleScreenB /> : <ScheduleScreenC />}
    </Prototype>
  );
}

export function StandingsPrototypePage() {
  const variant = useVariantParam();
  if (variant === null) return <TournamentStandingsPage />;
  return (
    <Prototype>
      {variant === 'A' ? <StandingsScreenA /> : variant === 'B' ? <StandingsScreenB /> : <StandingsScreenC />}
    </Prototype>
  );
}

export function BracketPrototypePage() {
  const variant = useVariantParam();
  if (variant === null) return <TournamentBracketPage />;
  return (
    <Prototype>
      {variant === 'A' ? <BracketScreenA /> : variant === 'B' ? <BracketScreenB /> : <BracketScreenC />}
    </Prototype>
  );
}
