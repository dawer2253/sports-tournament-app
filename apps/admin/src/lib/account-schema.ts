import { z } from 'zod';

/**
 * Nazwa i e-mail konta. Odwzorowuje ciało `PATCH /me` (nazwa 2–120 znaków,
 * e-mail do 255); zajęty adres sprawdza serwer i odpowiada `422` pod `email`.
 */
export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nazwa musi mieć co najmniej 2 znaki.')
    .max(120, 'Nazwa może mieć najwyżej 120 znaków.'),
  email: z
    .string()
    .trim()
    .min(1, 'Podaj e-mail.')
    .max(255, 'E-mail może mieć najwyżej 255 znaków.')
    .pipe(z.email('Podaj poprawny e-mail.')),
});

export type AccountValues = z.infer<typeof accountSchema>;

/**
 * Zmiana hasła. Odwzorowuje ciało `PUT /me/password`. Czy obecne hasło jest
 * dobre, wie tylko serwer (`422` pod `currentPassword`).
 */
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Podaj obecne hasło.'),
    password: z.string().min(8, 'Nowe hasło musi mieć co najmniej 8 znaków.'),
    passwordConfirmation: z.string().min(1, 'Powtórz nowe hasło.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Hasła nie są takie same.',
    path: ['passwordConfirmation'],
  });

export type PasswordValues = z.infer<typeof passwordSchema>;
