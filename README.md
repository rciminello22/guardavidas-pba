# Guardavidas PBA — Sistema de Alertas Climáticas

App React Native + Expo para guardavidas de la provincia de Buenos Aires. Monitorea condiciones climáticas en tiempo real y envía alertas push cuando se superan umbrales de riesgo.

## Stack

- **React Native + Expo SDK 56** con Expo Router (file-based navigation)
- **Supabase** — Auth, base de datos (PostgreSQL), Edge Functions
- **Open-Meteo API** — Clima en tiempo real (gratuita, sin API key)
- **Expo Push Notifications**
- **Expo Location** (GPS del dispositivo)

## Umbrales de alerta

| Condición | Umbral |
|-----------|--------|
| Viento | > 40 km/h |
| Índice UV | > 8 |
| Precipitación | > 5 mm/h |

---

## Setup

### 1. Variables de entorno

Creá un archivo `.env` en la raíz del proyecto con:

```
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Encontrás estos valores en **Supabase → Settings → API**.

### 2. Base de datos (Supabase)

1. Abrí el **SQL Editor** en tu proyecto de Supabase
2. Ejecutá el contenido de `supabase/migrations/001_init.sql`
3. Esto crea las tablas `profiles` y `alerts` con RLS habilitado

### 3. Edge Function (Supabase)

La función `check-weather` verifica las condiciones climáticas de cada guardavidas cada 30 minutos.

**Instalá la CLI de Supabase:**
```bash
npm install -g supabase
```

**Login y link al proyecto:**
```bash
supabase login
supabase link --project-ref tu-project-ref
```

**Deploy de la función:**
```bash
supabase functions deploy check-weather
```

**Programar la ejecución cada 30 minutos** (en Supabase Dashboard → Edge Functions → Schedules):
```
*/30 * * * *
```

O via CLI:
```bash
supabase functions create-cron "check-weather" "*/30 * * * *" --function-name check-weather
```

### 4. Instalar dependencias y correr el proyecto

```bash
npm install
npx expo start
```

Escaneá el QR con **Expo Go** (iOS/Android) para desarrollo.

> ⚠️ Las notificaciones push requieren un **development build** en Android (SDK 53+). Para iOS en Expo Go funcionan normalmente.

---

## Estructura del proyecto

```
app/
  _layout.tsx          # Root layout con auth guard
  (auth)/
    login.tsx          # Login con Supabase
    register.tsx       # Registro con perfil
  (tabs)/
    index.tsx          # Dashboard con clima actual
    alerts.tsx         # Lista de alertas
    profile.tsx        # Perfil del guardavidas
    notifications.tsx  # Configuración de notificaciones
lib/
  supabase.ts          # Cliente Supabase
  weather.ts           # Open-Meteo API
  notifications.ts     # Push notification helpers
  types.ts             # Tipos TypeScript
  colors.ts            # Paleta de colores
supabase/
  migrations/
    001_init.sql       # Schema de la base de datos
  functions/
    check-weather/
      index.ts         # Edge Function (Deno)
```

---

## Pantallas

| Pantalla | Descripción |
|----------|-------------|
| **Login** | Autenticación con email y contraseña |
| **Registro** | Crea cuenta + perfil (nombre, playa, legajo) |
| **Dashboard** | Clima actual vía GPS: temperatura, viento, UV, precipitación |
| **Alertas** | Lista de alertas con filtro leídas/no leídas |
| **Perfil** | Datos editables del guardavidas |
| **Notificaciones** | Toggle por tipo de alerta |

---

## Flujo de alertas

1. La app obtiene coordenadas GPS del dispositivo
2. Consulta Open-Meteo con `latitude` y `longitude`
3. Si se supera un umbral → inserta alerta en `alerts` table
4. La Edge Function corre cada 30 min → mismo chequeo para todos los usuarios registrados con ubicación guardada
5. Las alertas aparecen en la pantalla "Alertas"
6. Si el guardavidas tiene push token → recibe notificación push

---

## Notas de producción

- Para builds de producción usá [EAS Build](https://docs.expo.dev/build/introduction/)
- Las notificaciones push en Android requieren development build (no funcionan en Expo Go desde SDK 53)
- El `projectId` de EAS debe estar en `app.json` bajo `extra.eas.projectId`
