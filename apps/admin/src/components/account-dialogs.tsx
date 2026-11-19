import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { FormDialog, toast, type AdminShellUser } from '@tournament/ui';
import { useForm } from 'react-hook-form';
import {
  accountSchema,
  passwordSchema,
  type AccountValues,
  type PasswordValues,
} from '../lib/account-schema';
import { api } from '../lib/api';
import { applyApiError } from '../lib/form-errors';
import { TextField } from './text-field';

const SAVE_FAILED = 'Nie udało się zapisać. Spróbuj ponownie.';

const ACCOUNT_FIELDS = ['name', 'email'] as const;
const PASSWORD_FIELDS = ['currentPassword', 'password', 'passwordConfirmation'] as const;

/**
 * Wywołanie API z odpowiedzią albo `null`, gdy odpowiedzi nie było (sieć).
 * `fetch` bez odpowiedzi odrzuca `TypeError`, a jego komunikat byłby po
 * angielsku, więc ten jeden wyjątek zamieniamy na komunikat okna.
 */
async function sent<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (cause) {
    if (cause instanceof TypeError) return null;
    throw cause;
  }
}

type DialogProps = { onClose: () => void };

/**
 * Okno „Ustawienia konta”: nazwa i e-mail organizera. Odpowiedź `PATCH /me`
 * trafia wprost do `['me']`, więc header od razu pokazuje nową nazwę.
 */
export function AccountSettingsDialog({ account, onClose }: DialogProps & { account: AdminShellUser }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: account.name, email: account.email },
  });

  const submit = handleSubmit(async (body) => {
    const result = await sent(() => api.PATCH('/me', { body }));
    if (!result) {
      setError('root', { message: SAVE_FAILED });
      return;
    }
    const { data, error, response } = result;
    if (!data) {
      applyApiError(response.status >= 500 ? undefined : error, ACCOUNT_FIELDS, setError, SAVE_FAILED);
      return;
    }
    queryClient.setQueryData(['me'], data.data);
    toast.success('Zapisano dane konta.');
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => void submit(event)}
      title="Ustawienia konta"
      submitLabel="Zapisz"
      pending={isSubmitting}
      error={errors.root?.message}
    >
      <TextField label="Nazwa" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
    </FormDialog>
  );
}

/**
 * Okno „Zmień hasło”. Serwer unieważnia przy tym tokeny pozostałych urządzeń,
 * a ten zostawia, więc organizer zostaje w panelu.
 */
export function ChangePasswordDialog({ onClose }: DialogProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', password: '', passwordConfirmation: '' },
  });

  const submit = handleSubmit(async (body) => {
    const result = await sent(() => api.PUT('/me/password', { body }));
    if (!result) {
      setError('root', { message: SAVE_FAILED });
      return;
    }
    const { error, response } = result;
    if (!response.ok) {
      applyApiError(response.status >= 500 ? undefined : error, PASSWORD_FIELDS, setError, SAVE_FAILED);
      return;
    }
    toast.success('Zmieniono hasło.', { description: 'Inne urządzenia zostały wylogowane.' });
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => void submit(event)}
      title="Zmień hasło"
      description="Po zmianie inne urządzenia zostaną wylogowane."
      submitLabel="Zmień hasło"
      pending={isSubmitting}
      error={errors.root?.message}
    >
      <TextField
        label="Obecne hasło"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <TextField
        label="Nowe hasło"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <TextField
        label="Powtórz nowe hasło"
        type="password"
        autoComplete="new-password"
        error={errors.passwordConfirmation?.message}
        {...register('passwordConfirmation')}
      />
    </FormDialog>
  );
}
