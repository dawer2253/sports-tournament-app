import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Sport, TournamentCreate } from '@tournament/api-client';
import {
  AdminShell,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  Skeleton,
  type AdminNavKey,
} from '@tournament/ui';
import { AlertTriangle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { ChoiceCards } from '../components/choice-cards';
import { api } from '../lib/api';
import { applyApiError } from '../lib/form-errors';
import {
  TOURNAMENT_FORMATS,
  tournamentCreateSchema,
  type TournamentCreateValues,
} from '../lib/tournament-create-schema';
import { clearToken } from '../lib/session';
import { useAccount } from '../lib/use-account';

/** Pozycje nawigacji, które mają już swój ekran. */
const NAV_ROUTES: Partial<Record<AdminNavKey, string>> = {
  dashboard: '/',
};

/** Pola, które formularz umie podświetlić przy błędzie z API. */
const FIELDS = ['name', 'sportId', 'format'] as const;

/**
 * Emoji przy sporcie, jak w makiecie. Kontrakt nie przysyła ikony, a `code` jest
 * skończonym enumem, więc mapa siedzi po stronie panelu. Sport spoza mapy
 * dostanie kafelek bez ikony, a nie pusty prostokąt.
 */
const SPORT_EMOJI: Partial<Record<Sport['code'], string>> = {
  football: '⚽',
  basketball: '🏀',
};

export function TournamentCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const account = useAccount();

  const sports = useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await api.GET('/sports');
      if (error) throw new Error(error.message);
      return data.data;
    },
    // Lista sportów jest predefiniowana w systemie i nie zmienia się w trakcie
    // pracy z panelem, więc nie ma po co odpytywać jej przy każdym wejściu.
    staleTime: Infinity,
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TournamentCreateValues>({
    resolver: zodResolver(tournamentCreateSchema),
    // Sportu ani formatu nie wybieramy za organizera: patrz komentarz przy
    // schemacie. Stąd `undefined`, a nie pierwsza opcja z listy.
    defaultValues: { name: '', sportId: undefined, format: undefined },
  });

  async function onSubmit(values: TournamentCreateValues) {
    // Adnotacja, nie rzutowanie: jeżeli kontrakt zmieni kształt ciała żądania,
    // `npm run typecheck` zapali się tutaj, a nie dopiero na produkcji.
    const body: TournamentCreate = values;

    const { error } = await api.POST('/tournaments', { body });

    if (error) {
      applyApiError(error, FIELDS, setError);
      return;
    }

    // Lista turniejów w cache'u pochodzi sprzed założenia tego turnieju.
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    void navigate('/');
  }

  function goToList() {
    void navigate('/');
  }

  const sportOptions = (sports.data ?? []).map((sport: Sport) => ({
    value: sport.id,
    label: sport.name,
    icon: SPORT_EMOJI[sport.code],
  }));

  return (
    <AdminShell
      active="dashboard"
      title="Nowy turniej"
      subtitle="Nazwa, sport i format. Drużyny i terminarz dołożysz później."
      user={account}
      navHref={(key) => NAV_ROUTES[key]}
      onNavigate={(key) => {
        const route = NAV_ROUTES[key];
        if (route) void navigate(route);
      }}
      onLogout={() => {
        clearToken();
        void navigate('/login');
      }}
    >
      {sports.status === 'error' ? (
        // Bez listy sportów formularza nie da się wypełnić, więc nie pokazujemy
        // go w kawałkach — cały ekran zastępuje komunikat z próbą ponowienia.
        <EmptyState
          variant="error"
          icon={<AlertTriangle />}
          title="Nie udało się wczytać listy sportów"
          description={sports.error.message}
          action={
            <Button variant="outline" onClick={() => void sports.refetch()}>
              Spróbuj ponownie
            </Button>
          }
        />
      ) : (
        <form className="max-w-4xl" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
          <Card>
            <CardContent className="flex flex-col gap-8">
              <div className="flex max-w-xl flex-col gap-2">
                <Label htmlFor="name">Nazwa turnieju</Label>
                <Input
                  id="name"
                  autoFocus
                  maxLength={160}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  {...register('name')}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {sports.status === 'pending' ? (
                <Skeleton
                  role="status"
                  aria-label="Wczytywanie listy sportów"
                  className="h-32 w-full"
                />
              ) : (
                <Controller
                  control={control}
                  name="sportId"
                  render={({ field }) => (
                    <ChoiceCards
                      legend="Sport"
                      name={field.name}
                      options={sportOptions}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      errorMessage={errors.sportId?.message}
                      errorId="sportId-error"
                      className="lg:grid-cols-2"
                    />
                  )}
                />
              )}

              <Controller
                control={control}
                name="format"
                render={({ field }) => (
                  <ChoiceCards
                    legend="Format rozgrywek"
                    name={field.name}
                    options={TOURNAMENT_FORMATS}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    errorMessage={errors.format?.message}
                    errorId="format-error"
                  />
                )}
              />
            </CardContent>
          </Card>

          {/* Błąd, którego nie da się przypiąć do pola. `role="alert"` czyta go
              od razu, bo pojawia się po akcji organizera, a nie przy wejściu. */}
          {errors.root && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button type="button" variant="outline" onClick={goToList}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting || sports.status === 'pending'}>
              {isSubmitting ? 'Zakładanie…' : 'Załóż turniej'}
            </Button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
