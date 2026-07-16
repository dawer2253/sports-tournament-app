import * as React from 'react'
import {
  LayoutGrid, Users, CalendarDays, MapPin, BarChart3, Palette, Settings,
  Trophy, Search, Bell, LogOut, GitFork,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type AdminNavKey =
  | 'dashboard' | 'teams' | 'schedule' | 'bracket' | 'venues' | 'stats' | 'branding' | 'settings'

const NAV: { key: AdminNavKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Turnieje', icon: LayoutGrid },
  { key: 'teams', label: 'Drużyny', icon: Users },
  { key: 'schedule', label: 'Terminarz', icon: CalendarDays },
  { key: 'bracket', label: 'Drabinka', icon: GitFork },
  { key: 'venues', label: 'Obiekty', icon: MapPin },
  { key: 'stats', label: 'Statystyki', icon: BarChart3 },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'settings', label: 'Ustawienia', icon: Settings },
]

export interface AdminShellProps {
  active: AdminNavKey
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function AdminShell({ active, title, subtitle, actions, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-4 py-4 font-bold">
          <Trophy className="size-5 text-primary" /> Tournament<span className="text-primary">App</span>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map(({ key, label, icon: Icon }) => (
            <a
              key={key}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                key === active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
              )}
            >
              <Icon className="size-4" /> {label}
            </a>
          ))}
        </nav>
        <div className="border-t p-2">
          <div className="flex items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">KS</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-xs leading-tight">
              <div className="truncate font-medium">Klub Sportowy</div>
              <div className="truncate text-muted-foreground">organizator@klub.pl</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-6">
          <div className="relative w-72 max-w-[40vw]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Szukaj turnieju, drużyny…" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon"><Bell className="size-4" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="size-8 cursor-pointer">
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">KS</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Klub Sportowy</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Settings className="size-4" /> Ustawienia konta</DropdownMenuItem>
                <DropdownMenuItem variant="destructive"><LogOut className="size-4" /> Wyloguj</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-col gap-1 border-b px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2 sm:ml-auto">{actions}</div>}
        </div>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
