// PROTOTYP (#217) — strony podpinane pod /tournaments/:id/bracket i /schedule. Nie do main.
import { PrototypeSwitcher } from './switcher';
import { replacesSchedule, useBracketVariant } from './variant';
import { CupScheduleA, CupScheduleC, ScheduleReplaced, VariantA, VariantB, VariantC, VariantD } from './variants';

export function BracketPrototypePage() {
  const variant = useBracketVariant();
  return (
    <>
      {/* Zapas na pływający panel stanu, żeby nie zasłaniał ostatnich meczów. */}
      <div className="pb-72">
        {variant === 'A' && <VariantA />}
        {variant === 'B' && <VariantB />}
        {variant === 'C' && <VariantC />}
        {variant === 'D' && <VariantD />}
      </div>
      <PrototypeSwitcher />
    </>
  );
}

export function CupSchedulePrototypePage() {
  const variant = useBracketVariant();
  return (
    <>
      <div className="pb-72">
        {replacesSchedule(variant) ? <ScheduleReplaced /> : variant === 'C' ? <CupScheduleC /> : <CupScheduleA />}
      </div>
      <PrototypeSwitcher />
    </>
  );
}
