// PROTOTYP (#162) — strony podpinane pod /tournaments/:id/schedule. Nie do main.
import { AdminPage } from '../components/admin-page';
import { useTournament } from '../pages/tournament-layout';
import { ScheduleActions, ScheduleGate } from './shared';
import { PrototypeSwitcher } from './switcher';
import { useScheduleVariant } from './variant';
import { MatchPageA, VariantA, VariantB, VariantC, VariantD } from './variants';

export function SchedulePrototypePage() {
  const tournament = useTournament();
  const variant = useScheduleVariant();
  return (
    <AdminPage tournament={tournament} section="schedule" actions={<ScheduleActions />}>
      {/* Zapas na pływający panel stanu, żeby nie zasłaniał ostatnich wierszy. */}
      <div className="pb-48">
        <ScheduleGate>
          {variant === 'A' && <VariantA />}
          {variant === 'B' && <VariantB />}
          {variant === 'C' && <VariantC />}
          {variant === 'D' && <VariantD />}
        </ScheduleGate>
      </div>
      <PrototypeSwitcher />
    </AdminPage>
  );
}

export function MatchPrototypePage() {
  const tournament = useTournament();
  return (
    <AdminPage tournament={tournament} section="schedule">
      <div className="pb-48">
        <MatchPageA />
      </div>
      <PrototypeSwitcher />
    </AdminPage>
  );
}
