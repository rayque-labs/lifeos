import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { get, post, tokenStore } from './api'
import type { User } from './types'

type AuthValue = {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const clear = () => { tokenStore.clear(); setUser(null); setLoading(false) }
  const refreshUser = async () => setUser(await get<User>('/auth/me'))

  useEffect(() => {
    const onUnauthorized = () => clear()
    window.addEventListener('lifeos:unauthorized', onUnauthorized)
    if (!tokenStore.get()) setLoading(false)
    else get<User>('/auth/me').then(setUser).catch(clear).finally(() => setLoading(false))
    return () => window.removeEventListener('lifeos:unauthorized', onUnauthorized)
  }, [])

  const login = async (email: string, password: string) => {
    const result = await post<{ access_token: string }>('/auth/login', { email, password })
    tokenStore.set(result.access_token)
    await refreshUser()
  }
  const register = async (email: string, fullName: string, password: string) => {
    await post<User>('/auth/register', { email, full_name: fullName, password })
    await login(email, password)
  }
  const logout = async () => {
    try { await post<void>('/auth/logout', {}) } finally { clear() }
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
