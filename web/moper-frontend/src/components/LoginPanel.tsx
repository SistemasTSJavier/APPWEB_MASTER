import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function LoginPanel() {
  const { login, loginPorCodigo } = useAuth()
  const [tab, setTab] = useState<'sesion' | 'codigo'>('sesion')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) setError(result.error || 'Error')
  }

  const handleCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await loginPorCodigo(codigo)
    setLoading(false)
    if (!result.ok) setError(result.error || 'Código no válido')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-oxford-50 p-4">
      <div className="w-full max-w-md bg-white border-2 border-oxford-300 rounded-xl shadow-lg overflow-hidden">
        <div className="bg-oxford-800 text-white px-4 py-3 text-center">
          <h1 className="text-lg font-bold">MOPER</h1>
          <p className="text-sm text-oxford-200">Movimiento de Personal</p>
        </div>
        <div className="p-4">
          <div className="flex border-b border-oxford-200 mb-4">
            <button
              type="button"
              onClick={() => { setTab('sesion'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium ${tab === 'sesion' ? 'border-b-2 border-black text-black' : 'text-oxford-500'}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setTab('codigo'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium ${tab === 'codigo' ? 'border-b-2 border-black text-black' : 'text-oxford-500'}`}
            >
              Código de acceso
            </button>
          </div>

          {tab === 'sesion' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-sm text-oxford-600">
                Inicie sesión con su cuenta (gerente, RH, control) para ver registros y firmar según su rol.
              </p>
              <div>
                <label className="block text-sm font-medium text-oxford-800 mb-1">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border-2 border-oxford-300 rounded px-3 py-2 text-black"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-oxford-800 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border-2 border-oxford-300 rounded px-3 py-2 text-black"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-black text-white rounded font-medium hover:bg-oxford-800 disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {tab === 'codigo' && (
            <form onSubmit={handleCodigo} className="space-y-4">
              <p className="text-sm text-oxford-600">
                Ingrese el código de acceso del registro para ver el resumen del MOPER y firmar como oficial (conformidad).
              </p>
              <div>
                <label className="block text-sm font-medium text-oxford-800 mb-1">Código de acceso</label>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  className="w-full border-2 border-oxford-300 rounded px-3 py-2 text-black font-mono uppercase"
                  placeholder="Ej. ABC12XYZ"
                  maxLength={12}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-black text-white rounded font-medium hover:bg-oxford-800 disabled:opacity-50"
              >
                {loading ? 'Verificando...' : 'Ver MOPER'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
