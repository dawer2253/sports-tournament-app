import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

/**
 * Bramka do panelu: jedna karta z formularzem, ten sam ekran co pod `/login`
 * (`apps/admin/src/pages/login.tsx`).
 *
 * Ekran nie ma panelu brandowego ani rejestracji konta: panel dowozi jedno
 * pole e-mail i jedno hasło, a konta organizera nie zakłada się z UI.
 * Pola są wypełnione wartościami startowymi, tak jak w panelu — makieta ma
 * pokazywać ten sam ekran, nie inne dane.
 */
export function AdminLogin() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Logowanie</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" defaultValue="dawid@example.com" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Hasło</Label>
              <Input id="password" type="password" defaultValue="tajnehaslo123" required />
            </div>
            <Button type="submit">Zaloguj</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
