interface ModulePlaceholderViewProps {
  title: string
  hint: string
}

export function ModulePlaceholderView({
  title,
  hint,
}: ModulePlaceholderViewProps) {
  return (
    <div className="placeholder">
      <div className="placeholder__card">
        <h1 className="placeholder__title">{title}</h1>
        <p className="placeholder__hint">{hint}</p>
        <p className="placeholder__note">
          Módulo pendiente de conectar a datos y pantallas específicas.
        </p>
      </div>
    </div>
  )
}
