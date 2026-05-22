import { useAuth } from '../context/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  return (
    <header className="border-b-2 border-oxford-300 bg-white shrink-0">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-wrap items-center justify-center sm:justify-between gap-2 sm:gap-4">
        <span className="text-base sm:text-xl font-bold text-black tracking-wide order-1 sm:order-1">TACTICAL</span>
        <img
          src="/image.png"
          alt="Logo Tactical Support"
          className="h-8 sm:h-12 w-auto object-contain order-2 sm:order-2"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.classList.remove('hidden')
          }}
        />
        <span className="hidden font-bold text-oxford-600 text-sm sm:text-lg order-2">[Logo]</span>
        <span className="text-base sm:text-xl font-bold text-black tracking-wide order-3 sm:order-3">SUPPORT</span>
        {user && (
          <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-2 order-4">
            <span className="text-sm text-oxford-600">{user.nombre} ({user.rol})</span>
            <button
              type="button"
              onClick={logout}
              className="px-2 py-1 text-sm border border-oxford-300 rounded text-oxford-700 hover:bg-oxford-100"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
