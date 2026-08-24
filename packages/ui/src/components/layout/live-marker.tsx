import { cn } from '../../lib/utils'

// Jeden zapis stanu „na żywo" na wszystkich ekranach public: pulsująca kropka
// + etykieta w kolorze destructive. Nie Badge — plakietka to oprawa dla treści,
// a tu treścią jest sam stan; oprawianie jej pudełkiem nic nie dodaje, za to
// konkuruje z wynikiem meczu, który ma być najmocniejszym elementem kafla.
export function LiveMarker({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('flex items-center gap-1.5 text-xs font-medium text-destructive', className)}
      {...props}
    >
      <span aria-hidden className="size-2 animate-pulse rounded-full bg-destructive" />
      Na żywo
    </span>
  )
}
