import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@tournament/ui';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { setToken } from '../lib/session';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('dawid@example.com');
  const [password, setPassword] = useState('tajnehaslo123');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const { data, error } = await api.POST('/login', { body: { email, password } });

    setPending(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setToken(data.data.token);
    void navigate('/');
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Logowanie</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Logowanie...' : 'Zaloguj'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
