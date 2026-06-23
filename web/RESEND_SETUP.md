# 📧 Configuración de Resend para Alertas de Contratos

## Paso 1: Crear API Key en Resend

1. Ve a [resend.com](https://resend.com)
2. En el dashboard, ve a **API Keys**
3. Crea una nueva clave (empieza con `re_`)
4. Copia la clave completa

## Paso 2: Configurar `.env.local`

En la raíz de `/web`, crea o edita `.env.local`:

```env
# Resend API Key (obtener de https://resend.com/api-keys)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email remitente - DEBE estar verificado en Resend
# Para pruebas: EMAIL_FROM=onboarding@resend.dev (dominio de prueba incluido)
# Para producción: EMAIL_FROM=noreply@tudominio.com (verificar el dominio en Resend)
EMAIL_FROM=onboarding@resend.dev

# Email destinatario para alertas de contratos vencidos
LEGAL_ALERTAS_EMAIL_TO=legla@tacticalsupport.com.mx
```

## Paso 3: Verificar Dominio (Producción)

Si usas tu dominio propio en producción:

1. Ve a **Domains** en Resend
2. Añade tu dominio
3. Verifica los registros DNS DKIM/SPF/DMARC
4. Una vez verificado, usa `EMAIL_FROM=noreply@tudominio.com`

## Paso 4: Prueba Manual

Para verificar que todo está correcto:

```bash
cd web
node --env-file=.env.local scripts/verificar-resend-legal.mjs
```

## Cómo Funciona el Envío

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
