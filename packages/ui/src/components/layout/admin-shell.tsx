import * as React from 'react'
import {
  LayoutGrid, Users, CalendarDays, MapPin, BarChart3, Palette, Settings,
  Trophy, Search, Bell, LogOut, GitFork,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Heading } from '@/components/ui/typography'
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
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">
            Tournament<span className="text-primary">App</span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zarządzanie
          </div>
          {NAV.map(({ key, label, icon: Icon }) => {
            const isActive = key === active
            return (
              <a
                key={key}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:opacity-100'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <Icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                {label}
              </a>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-sidebar-accent/50">
            <Avatar className="size-8">
              <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">KS</AvatarFallback>
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          <div className="relative w-72 max-w-[40vw]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-9" placeholder="Szukaj turnieju, drużyny…" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Powiadomienia"><Bell className="size-4" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="size-8 cursor-pointer">
                  <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">KS</AvatarFallback>
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

        <div className="flex flex-col gap-3 border-b bg-card px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0">
            <Heading>{title}</Heading>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 sm:ml-auto">{actions}</div>}
        </div>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
