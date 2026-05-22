import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { API } from '../api'

const TOKEN_KEY = 'moper_token'

export interface User {
  id: number
  email: string
  nombre: string
  rol: string
}

export interface RegistroMoperResumen {
  id: number
  folio: string | null
  oficial_nombre?: string | null
  curp?: string | null
  fecha_ingreso?: string | null
  fecha_inicio_efectiva?: string | null
  servicio_actual_nombre?: string | null
  servicio_nuevo_nombre?: string | null
  puesto_actual_nombre?: string | null
  puesto_nuevo_nombre?: string | null
  sueldo_actual?: number | null
  sueldo_nuevo?: number | null
  motivo?: string | null
  creado_por?: string | null
  solicitado_por?: string | null
  created_at?: string | null
  firma_conformidad_at?: string | null
  firma_conformidad_nombre?: string | null
  firma_conformidad_imagen?: string | null
  firma_rh_at?: string | null
  firma_rh_nombre?: string | null
  firma_rh_imagen?: string | null
  firma_gerente_at?: string | null
  firma_gerente_nombre?: string | null
  firma_gerente_imagen?: string | null
  firma_control_at?: string | null
  firma_control_nombre?: string | null
  firma_control_imagen?: string | null
  completado?: boolean
  codigo_acceso?: string | null
  [key: string]: unknown
}

interface AuthState {
  user: User | null
  token: string | null
  accesoPorCodigo: { codigo: string; registro: RegistroMoperResumen } | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginPorCodigo: (codigo: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  clearCodigoAcceso: () => void
  setRegistroPorCodigo: (registro: RegistroMoperResumen) => void
  authHeaders: () => Record<string, string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [accesoPorCodigo, setAccesoPorCodigo] = useState<{ codigo: string; registro: RegistroMoperResumen } | null>(null)
  const [loading, setLoading] = useState(true)

  const authHeaders = useCallback((): Record<string, string> => {
    const t = token ?? localStorage.getItem(TOKEN_KEY)
    if (!t) return {}
    return { Authorization: `Bearer ${t}` }
  }, [token])

  useEffect(() => {
    const t = token ?? localStorage.getItem(TOKEN_KEY)
    if (!t) {
      setLoading(false)
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      setLoading(false)
      setToken(null)
      setUser(null)
      localStorage.removeItem(TOKEN_KEY)
    }, 12000)
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.user) {
          setUser(data.user)
          setToken(t)
        } else {
          setToken(null)
          setUser(null)
          localStorage.removeItem(TOKEN_KEY)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null)
          setUser(null)
          localStorage.removeItem(TOKEN_KEY)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
        clearTimeout(timeout)
      })
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error || 'Error al iniciar sesión' }
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      setAccesoPorCodigo(null)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Error de conexión' }
    }
  }, [])

  const loginPorCodigo = useCallback(async (codigo: string) => {
    const c = codigo.trim().toUpperCase()
    if (!c) return { ok: false, error: 'Ingrese el código' }
    try {
      const res = await fetch(`${API}/api/moper/codigo/${encodeURIComponent(c)}`)
      const registro = await res.json()
      if (!res.ok) return { ok: false, error: registro.error || 'Código no válido' }
      setAccesoPorCodigo({ codigo: c, registro })
      setUser(null)
      setToken(null)
      localStorage.removeItem(TOKEN_KEY)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Error de conexión' }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setAccesoPorCodigo(null)
    localStorage.removeItem(TOKEN_KEY)
  }, [])

  const clearCodigoAcceso = useCallback(() => {
    setAccesoPorCodigo(null)
  }, [])

  const setRegistroPorCodigo = useCallback((registro: RegistroMoperResumen) => {
    setAccesoPorCodigo((prev) => (prev ? { ...prev, registro } : null))
  }, [])

  const value: AuthContextValue = {
    user,
    token,
    accesoPorCodigo,
    loading,
    login,
    loginPorCodigo,
    logout,
    clearCodigoAcceso,
    setRegistroPorCodigo,
    authHeaders,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
