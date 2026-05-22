# MOPER – Frontend (integración en plataforma interna)

Frontend del **Movimiento de Personal (MOPER)** listo para integrar en tu plataforma. El backend sigue siendo el proyecto `server/` del repositorio principal (o tu API desplegada).

## Contenido de esta carpeta

| Carpeta / archivo | Descripción |
|-------------------|-------------|
| `src/` | React + TypeScript (formulario, firmas, PDF, panel lateral) |
| `public/` | `logo.png`, `plantilla.png` (PDF) |
| `dist/` | Build de producción (opcional; regenerar con `npm run build`) |

## Requisitos

- Node 18+
- Backend MOPER en ejecución (API REST bajo `/api`)

## Configuración

1. Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Define la URL de tu API:

```env
VITE_API_URL=https://tu-servidor-moper.ejemplo.com
```

- **Vacío** (`VITE_API_URL=`): las peticiones van a `/api` del **mismo origen** (útil si tu plataforma hace proxy a MOPER).
- **Con URL**: el front llama a `https://tu-servidor.../api/...` (CORS debe estar permitido en el backend).

3. Si el módulo vive en un subpath (ej. `https://intranet.com/moper/`):

```env
VITE_BASE_PATH=/moper/
```

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. El proxy de Vite envía `/api` a `http://localhost:3000` (levanta el `server` del repo principal).

## Build para producción

```bash
npm run build
```

Salida en `dist/`. Sirve esa carpeta desde tu plataforma o súbela a tu CDN.

## Integrar en tu plataforma

### Opción A – Iframe

```html
<iframe src="https://intranet.tuempresa.com/moper/" title="MOPER" class="w-full min-h-screen border-0"></iframe>
```

Despliega el contenido de `dist/` en la ruta `/moper/` y configura `VITE_BASE_PATH=/moper/` antes del build.

### Opción B – Misma app, proxy API

Tu plataforma sirve el build de MOPER y en el servidor haces proxy:

- `/moper/*` → archivos estáticos de `dist/`
- `/api/*` → backend MOPER

En ese caso deja `VITE_API_URL` vacío.

### Opción C – Componente React en monorepo

Copia `src/` a tu proyecto y monta la app:

```tsx
import { AuthProvider } from './moper/context/AuthContext'
import App from './moper/App'

export function ModuloMoper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
```

Asegura `VITE_API_URL` en el build de tu app y los estilos de Tailwind (o importa `index.css`).

## Endpoints que usa el frontend

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Sesión |
| GET | `/api/moper` | Listado pendientes/aprobados |
| GET | `/api/moper/:id` | Detalle registro |
| POST | `/api/moper` | Crear registro |
| PATCH | `/api/moper/:id` | Actualizar |
| PATCH | `/api/moper/:id/cancelar` | Cancelar |
| POST | `/api/moper/:id/firma` | Firmas |
| GET | `/api/moper/codigo/:codigo` | Acceso oficial por código |
| GET | `/api/folios/preview` | Vista previa folio |
| PATCH | `/api/folios/sequence` | Ajustar folio |

## Assets en `public/`

- `logo.png` – encabezado y marca de agua en PDF  
- `plantilla.png` – fondo del PDF (encabezado/pie)

Sin ellos la app funciona; el PDF se genera sin plantilla/logo.

## CORS

Si `VITE_API_URL` apunta a otro dominio, el backend debe permitir el origen de tu plataforma en CORS.
