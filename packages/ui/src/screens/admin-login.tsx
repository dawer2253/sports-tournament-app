import type * as React from 'react'
import { Trophy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const FEATURES = [
  'Piłka nożna i koszykówka',
  'Formaty: Liga / Puchar / Grupy',
  'Publiczna strona wyników i tabela',
]

function BrandPanel() {
  return (
    <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
      <div className="flex items-center gap-2 text-lg font-bold">
        <Trophy className="size-6" /> Tournament<span className="opacity-80">App</span>
      </div>

      <div className="max-w-sm">
        <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
          Organizuj ligi i turnieje w kilka minut
        </h2>
        <p className="mt-3 text-sm text-primary-foreground/80">
          Zarządzaj drużynami, terminarzem i wynikami z jednego panelu — a kibice śledzą
          rozgrywki na żywo.
        </p>
        <ul className="mt-8 space-y-3">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15">
                <Check className="size-3.5" />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-primary-foreground/70">© 2026 TournamentApp</p>
    </div>
  )
}

interface AuthLayoutProps {
  children: React.ReactNode
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-background text-foreground md:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}

export function AdminLogin() {
  return (
    <AuthLayout>
      <div className="mb-8 flex items-center gap-2 font-bold md:hidden">
        <Trophy className="size-5 text-primary" /> Tournament<span className="text-primary">App</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Zaloguj się</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Wejdź do panelu organizatora rozgrywek.
      </p>

      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="login-email">E-mail</Label>
          <Input id="login-email" type="email" placeholder="organizator@klub.pl" autoComplete="email" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Hasło</Label>
            <a className="cursor-pointer text-sm text-primary hover:underline">
              Nie pamiętasz hasła?
            </a>
          </div>
          <Input id="login-password" type="password" placeholder="••••••••" autoComplete="current-password" />
        </div>

        <Button type="submit" className="w-full">
          Zaloguj się
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Nie masz konta?{' '}
        <a className="cursor-pointer font-medium text-primary hover:underline">Zarejestruj się</a>
      </p>
    </AuthLayout>
  )
}

export function AdminRegister() {
  return (
    <AuthLayout>
      <div className="mb-8 flex items-center gap-2 font-bold md:hidden">
        <Trophy className="size-5 text-primary" /> Tournament<span className="text-primary">App</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">Utwórz konto</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Załóż konto organizatora i uruchom pierwsze rozgrywki.
      </p>

      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="reg-name">Nazwa organizatora</Label>
          <Input id="reg-name" type="text" placeholder="Klub Sportowy" autoComplete="organization" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-email">E-mail</Label>
          <Input id="reg-email" type="email" placeholder="organizator@klub.pl" autoComplete="email" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-password">Hasło</Label>
          <Input id="reg-password" type="password" placeholder="••••••••" autoComplete="new-password" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-password-confirm">Powtórz hasło</Label>
          <Input id="reg-password-confirm" type="password" placeholder="••••••••" autoComplete="new-password" />
        </div>

        <Button type="submit" className="w-full">
          Utwórz konto
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Masz już konto?{' '}
        <a className="cursor-pointer font-medium text-primary hover:underline">Zaloguj się</a>
      </p>
    </AuthLayout>
  )
}
