# 📧 Configuración de Resend (Alertas Legal + MOPER)

## Paso 1: Crear API Key en Resend

1. Ve a [resend.com](https://resend.com) e inicia sesión (o crea cuenta).
2. En el dashboard → **API Keys** → **Create API Key**.
3. Copia la clave completa (empieza con `re_`).

## Paso 2: Configurar `web/.env.local`

En la carpeta **`web`**, crea el archivo `.env.local` (junto a `package.json`) con al menos:

```env
# ── Resend (correo) ─────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Remitente — en PRUEBAS usa el dominio de Resend (ya verificado):
EMAIL_FROM=onboarding@resend.dev

# Destino alertas legales (contratos)
LEGAL_ALERTAS_EMAIL_TO=gerentelegal@tacticalsupport.com.mx

# Destino notificaciones MOPER completados (recomendado: Nóminas)
MOPER_CONTABILIDAD_EMAIL_TO=nominas@tacticalsupport.com.mx

# Enlaces en el correo MOPER (obligatorio en producción)
APP_URL=https://tu-dominio.vercel.app
# En local:
# APP_URL=http://localhost:3000
```

> **Importante:** Sin comillas en los valores. Después de guardar, **reinicia** `npm run dev`.

### Modo prueba vs producción

| Variable | Pruebas | Producción |
|----------|---------|------------|
| `EMAIL_FROM` | `onboarding@resend.dev` | `notificaciones@tacticalsupport.com.mx` (dominio verificado) |
| `MOPER_CONTABILIDAD_EMAIL_TO` | Correo de tu cuenta Resend* | `nominas@tacticalsupport.com.mx` |

\* Con `onboarding@resend.dev`, Resend **solo entrega** al email con el que creaste la cuenta en Resend. Para enviar a `nominas@...` debes **verificar el dominio** `tacticalsupport.com.mx`.

## Paso 3: Verificar dominio (producción)

1. Resend → **Domains** → **Add Domain** → `tacticalsupport.com.mx`
2. Añade en tu DNS los registros **SPF**, **DKIM** y **DMARC** que muestra Resend.
3. Cuando el dominio esté **Verified**, cambia en `.env.local` y en Vercel:

```env
EMAIL_FROM=notificaciones@tacticalsupport.com.mx
```

## Paso 4: Probar envío

```bash
cd web

# Prueba alertas legal
node --env-file=.env.local scripts/verificar-resend-legal.mjs

# Prueba notificaciones MOPER
node --env-file=.env.local scripts/verificar-resend-moper.mjs
```

Si ambos scripts muestran `OK`, Resend está listo.

## Paso 5: Variables en Vercel (producción)

En el proyecto de Vercel → **Settings** → **Environment Variables**, añade las mismas claves:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `LEGAL_ALERTAS_EMAIL_TO`
- `MOPER_CONTABILIDAD_EMAIL_TO`
- `APP_URL` (URL pública de la app, sin barra final)

Redeploy después de guardar.

---

## Cómo se envían los correos MOPER

| Cuándo | Qué pasa |
|--------|----------|
| **Automático** | Al registrarse la **última firma** de un MOPER → correo a `MOPER_CONTABILIDAD_EMAIL_TO` con enlace `/moper?registro={id}` |
| **Manual** | Admin/RH en MOPER → botón **Recordar** / **Reenviar** en un registro pendiente |

Archivos: `lib/moper-email.ts`, `lib/moper-registros-server.ts` (`notificarContabilidadMoperPorId`).

---

## Cómo Funciona el Envío (Alertas Legal)

### Automático (Diario)

- **Servidor**: Cron en `/api/cron/legal-contratos-email` (Vercel Cron)
- **Frecuencia**: 1 vez cada 24 horas máximo
- **Envía**: Solo colaboradores con contrato a vencer en **≤ 8 días**

### Manual (Admin/Gerente Legal)

- **Ruta**: Botón "Reenviar ahora (admin)" en `/gerente-legal/contratos`
- **Endpoint**: `POST /api/gerente-legal/contratos-alertas/enviar`
- **Fuerza**: Se envía sin respetar límite de tiempo

## Estructura del Email

```html
Asunto: ALERTA LEGAL: X contrato(s) por vencer (8 días o menos)

Cuerpo:
- Tabla con: N°, Nombre, Servicio, Planta, Vencimiento, Tiempo restante
- Remitente: EMAIL_FROM
- Destinatario: LEGAL_ALERTAS_EMAIL_TO
```

## Troubleshooting

### ❌ "RESEND_API_KEY no configurada"

- Verifica que `.env.local` existe
- Reinicia: `npm run dev`
- Usa: `node --env-file=.env.local scripts/verificar-resend-legal.mjs`

### ❌ "API KEY con formato incorrecto"

- Debe empezar con `re_`
- Sin comillas en `.env.local`
- Copia la clave completa (sin espacios al inicio/final)

### ❌ "El dominio del remitente no está verificado"

- En pruebas: usa `EMAIL_FROM=onboarding@resend.dev`
- En producción: verifica tu dominio en Resend **Domains**

### ❌ "No llega el email"

- Revisa que `LEGAL_ALERTAS_EMAIL_TO` sea un email válido
- Verifica spam/basura
- Comprueba logs en Resend dashboard

## Archivos Relacionados

- **API Route**: [app/api/gerente-legal/contratos-alertas/enviar/route.ts](app/api/gerente-legal/contratos-alertas/enviar/route.ts)
- **Lógica de Envío**: [lib/legal-contratos-email.ts](lib/legal-contratos-email.ts)
- **Server Logic**: [lib/legal-contratos-server.ts](lib/legal-contratos-server.ts)
- **Frontend**: [app/gerente-legal/contratos/GerenteLegalContratosClient.tsx](app/gerente-legal/contratos/GerenteLegalContratosClient.tsx)
- **Validación de Env**: [lib/env-resend.ts](lib/env-resend.ts)
