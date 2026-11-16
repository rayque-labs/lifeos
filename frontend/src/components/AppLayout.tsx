import { ProfilePhoto } from './Personalization'
import { AgentWellbeingNudge } from './AgentWellbeingNudge'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bell, CalendarDays, CheckSquare2, Plus, ChevronRight, CircleDollarSign, Grid2X2, House,
  FolderKanban, LayoutDashboard, LogOut, NotebookPen, Settings2, Sparkles, MessageCircle, X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const items = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/assistant', label: 'Assistente', icon: MessageCircle },
  { to: '/tasks', label: 'Tarefas', icon: CheckSquare2 },
  { to: '/projects', label: 'Projetos', icon: FolderKanban },
  { to: '/habits', label: 'Hábitos', icon: Sparkles },
  { to: '/notes', label: 'Notas', icon: NotebookPen },
  { to: '/calendar', label: 'Agenda', icon: CalendarDays },
  { to: '/finance', label: 'Finanças', icon: CircleDollarSign },
]
const titleByPath: Record<string, string> = Object.fromEntries(items.map(item => [item.to, item.label]))

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const home = location.pathname === '/'
  const otherPage = !['/', '/calendar', '/assistant'].includes(location.pathname)
  const title = titleByPath[location.pathname] || (location.pathname === '/settings' ? 'Configurações' : 'LifeOS')
  const leave = async () => { await logout(); navigate('/login') }

  return <div className="app-shell min-h-screen bg-[#f5f6f1] md:flex">
    {open && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-[#12251b]/35 md:hidden" onClick={() => setOpen(false)} />}
    <aside id="lifeos-more" className={`sidebar-scroll mono-more ${open ? 'is-open' : ''} fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#203c2e] px-4 py-5 text-white transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2 pb-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <img src="/lifeos-original.png" alt="" className="h-9 w-9" />
          <span className="text-xl font-bold tracking-tight">LifeOS</span>
        </Link>
        <button aria-label="Fechar menu" className="rounded-lg p-2 text-[#d5e1d7] hover:bg-white/10 md:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
      <p className="px-3 pb-2 text-sm font-semibold md:hidden">Mais</p>
      <nav className="mono-sidebar-links sidebar-scroll flex-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${isActive ? 'bg-[#C5FF4A] text-[#101010] shadow-sm' : 'text-[#d0ddd2] hover:bg-white/[.08] hover:text-white'}`}>
          <Icon size={17} strokeWidth={1.8} />{label}
        </NavLink>)}
      </nav>
      <div className="mt-4 border-t border-white/10 pt-3">
        <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${isActive ? 'bg-white/10 text-white' : 'text-[#d0ddd2] hover:bg-white/[.08]'}`}><Settings2 size={17} />Configurações</NavLink>
        <div className="mt-3 flex items-center gap-3 rounded-xl px-2 py-2">
          <ProfilePhoto />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user?.full_name}</p><p className="truncate text-[10px] text-[#aec1b2]">{user?.email}</p></div>
          <button aria-label="Sair" title="Sair" onClick={leave} className="rounded-lg p-2 text-[#c2d0c5] hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <main className="min-w-0 flex-1 md:ml-0">
      <header className="mono-top-header sticky top-0 z-20 flex items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-7 lg:px-10">
        {home ? <Link to="/" className="mono-mobile-brand md:hidden"><img src="/lifeos-original.png" alt="" /><span>LifeOS</span></Link>
          : <Link to="/" aria-label="Voltar ao início" className="mono-mobile-back md:hidden"><ArrowLeft size={23} /></Link>}
        <div className={`mono-header-title ${home ? 'hidden md:flex' : 'flex'} min-w-0 flex-1 items-center gap-2 text-xs text-[#94a097]`}><span className="hidden md:inline">LifeOS</span><ChevronRight size={13} className="hidden md:inline" /><span className="truncate font-semibold">{title}</span></div>
        {home && <Link to="/calendar" aria-label="Agenda e lembretes" className="mono-header-icon"><Bell size={21} /></Link>}
        <Link to="/settings" aria-label="Perfil e configurações" className="mono-header-icon"><ProfilePhoto /></Link>
      </header>
      <AgentWellbeingNudge />
      <div key={location.pathname === '/tasks' && new URLSearchParams(location.search).get('nova') === '1' ? location.key : location.pathname} className="mono-page-transition mx-auto max-w-[1440px] px-4 py-4 sm:px-7 sm:py-8 lg:px-10 lg:py-9"><Outlet /></div>
      <nav aria-label="Navegação principal" className="mono-bottom-nav fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 items-center md:hidden">
        <NavLink end to="/" className={({ isActive }) => `mono-nav-item ${isActive ? 'is-active' : ''}`}><House size={22}/><span>Início</span></NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `mono-nav-item ${isActive ? 'is-active' : ''}`}><CalendarDays size={22}/><span>Agenda</span></NavLink>
        <Link to="/tasks?nova=1" aria-label="Nova tarefa" className="mono-nav-item mono-nav-create"><span className="mono-nav-create-circle"><Plus size={26}/></span></Link>
        <NavLink to="/assistant" className={({ isActive }) => `mono-nav-item ${isActive ? 'is-active' : ''}`}><MessageCircle size={22}/><span>Chat</span></NavLink>
        <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="lifeos-more" className={`mono-nav-item ${open || otherPage ? 'is-active' : ''}`}><Grid2X2 size={22}/><span>Mais</span></button>
      </nav>
    </main>
  </div>
}
