import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays, CheckSquare2, ChevronRight, CircleDollarSign, Command,
  FolderKanban, LayoutDashboard, LogOut, Menu, NotebookPen, Settings2, Sparkles, X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const items = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tarefas', icon: CheckSquare2 },
  { to: '/projects', label: 'Projetos', icon: FolderKanban },
  { to: '/habits', label: 'Hábitos', icon: Sparkles },
  { to: '/notes', label: 'Notas', icon: NotebookPen },
  { to: '/calendar', label: 'Calendário', icon: CalendarDays },
  { to: '/finance', label: 'Finanças', icon: CircleDollarSign },
]
const titleByPath: Record<string, string> = Object.fromEntries(items.map(item => [item.to, item.label]))

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const title = titleByPath[location.pathname] || (location.pathname === '/settings' ? 'Configurações' : 'LifeOS')
  const leave = async () => { await logout(); navigate('/login') }

  return <div className="app-shell min-h-screen bg-[#f5f6f1] md:flex">
    {open && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-[#12251b]/35 md:hidden" onClick={() => setOpen(false)} />}
    <aside className={`sidebar-scroll fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#203c2e] px-4 py-5 text-white transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2 pb-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9f16f] text-[#203c2e]"><Command size={21} /></span>
          <span><span className="block text-[17px] font-bold tracking-tight">lifeos</span><span className="text-[10px] uppercase tracking-[.2em] text-[#b6c9ba]">personal system</span></span>
        </Link>
        <button aria-label="Fechar menu" className="rounded-lg p-2 text-[#d5e1d7] hover:bg-white/10 md:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#99b09f]">Workspace</p>
      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${isActive ? 'bg-[#d9f16f] text-[#243b2e] shadow-sm' : 'text-[#d0ddd2] hover:bg-white/[.08] hover:text-white'}`}>
          <Icon size={17} strokeWidth={1.8} />{label}
        </NavLink>)}
      </nav>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.06] p-3.5">
        <div className="flex items-center gap-2 text-[#d9f16f]"><Sparkles size={15} /><span className="text-xs font-semibold">Um passo de cada vez</span></div>
        <p className="mt-2 text-xs leading-5 text-[#bfd0c2]">Organize suas prioridades e mantenha o foco no que importa.</p>
      </div>
      <div className="mt-4 border-t border-white/10 pt-3">
        <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${isActive ? 'bg-white/10 text-white' : 'text-[#d0ddd2] hover:bg-white/[.08]'}`}><Settings2 size={17} />Configurações</NavLink>
        <div className="mt-3 flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbe8d9] text-xs font-bold text-[#35513f]">{user?.full_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user?.full_name}</p><p className="truncate text-[10px] text-[#aec1b2]">{user?.email}</p></div>
          <button aria-label="Sair" title="Sair" onClick={leave} className="rounded-lg p-2 text-[#c2d0c5] hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <main className="min-w-0 flex-1 md:ml-0">
      <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-[#e8ebe5] bg-[#f7f8f4]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
        <button aria-label="Abrir menu" onClick={() => setOpen(true)} className="rounded-xl p-2 text-[#40564a] hover:bg-white md:hidden"><Menu size={19} /></button>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-[#94a097]"><span className="hidden sm:inline">LifeOS</span><ChevronRight size={13} className="hidden sm:inline" /><span className="truncate font-semibold text-[#40564a]">{title}</span></div>
        <div className="hidden items-center gap-2 text-xs text-[#8a978d] sm:flex"><span className="h-2 w-2 rounded-full bg-[#86b764]" /> Seus dados estão sincronizados</div>
        <button onClick={() => navigate('/settings')} aria-label="Configurações" className="rounded-xl p-2 text-[#697a6e] hover:bg-white"><Settings2 size={18} /></button>
      </header>
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-9"><Outlet /></div>
      <footer className="px-5 pb-6 text-center text-[11px] text-[#a0aaa2]">LifeOS · Um espaço para organizar o que importa</footer>
    </main>
  </div>
}
