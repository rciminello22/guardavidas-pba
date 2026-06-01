import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.106.2';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const THRESHOLDS = {
  wind_kmh: 40,
  uv_index: 8,
  precipitation_mmh: 5,
};

interface WeatherResult {
  windspeed: number;
  winddirection: number;
  uv_index: number;
  precipitation: number;
}

interface Profile {
  id: string;
  expo_push_token: string | null;
  notify_wind: boolean;
  notify_uv: boolean;
  notify_precipitation: boolean;
  shift_start: string | null;
  shift_end: string | null;
}

function getWindDirection(degrees: number): string {
  const dirs = [
    'Norte', 'Norte-Noreste', 'Noreste', 'Este-Noreste',
    'Este', 'Este-Sureste', 'Sureste', 'Sur-Sureste',
    'Sur', 'Sur-Suroeste', 'Suroeste', 'Oeste-Suroeste',
    'Oeste', 'Oeste-Noroeste', 'Noroeste', 'Norte-Noroeste',
  ];
  return dirs[Math.round(degrees / 22.5) % 16];
}

async function getWeather(lat: number, lon: number): Promise<WeatherResult> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'windspeed_10m,winddirection_10m,precipitation,uv_index',
    timezone: 'America/Argentina/Buenos_Aires',
    forecast_days: '1',
  });

  const res = await fetch(`${OPEN_METEO_BASE}?${params}`);
  const data = await res.json();
  const c = data.current;

  return {
    windspeed: c.windspeed_10m,
    winddirection: c.winddirection_10m,
    uv_index: c.uv_index,
    precipitation: c.precipitation,
  };
}

async function sendPushNotifications(tokens: string[], title: string, body: string) {
  // Batch push notifications in one request
  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'alertas',
  }));

  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}

function isWithinShift(shiftStart: string | null, shiftEnd: string | null): boolean {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [startH, startM] = (shiftStart ?? '08:00').split(':').map(Number);
  const [endH, endM] = (shiftEnd ?? '18:00').split(':').map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= (startH * 60 + startM) && current <= (endH * 60 + endM);
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Optimización: query por playa, no por usuario
    // 500 playas → 500 llamadas a Open-Meteo en vez de 15.000
    const { data: beaches, error } = await supabase
      .from('beaches')
      .select('id, name, latitude, longitude, profiles(id, expo_push_token, notify_wind, notify_uv, notify_precipitation, shift_start, shift_end)')
      .eq('is_active', true);

    if (error) throw error;
    if (!beaches || beaches.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let beachesProcessed = 0;
    let alertsCreated = 0;
    let pushSent = 0;

    for (const beach of beaches) {
      const profiles = (beach.profiles ?? []) as Profile[];
      if (profiles.length === 0) continue;

      try {
        // Una sola llamada al clima por playa
        const weather = await getWeather(beach.latitude, beach.longitude);

        // Determinar qué alertas se triggean para esta playa
        const triggeredAlerts: { type: string; message: string }[] = [];

        if (weather.windspeed > THRESHOLDS.wind_kmh) {
          triggeredAlerts.push({
            type: 'viento',
            message: `⚠️ Viento peligroso en ${beach.name}: ${weather.windspeed.toFixed(1)} km/h del ${getWindDirection(weather.winddirection)}`,
          });
        }
        if (weather.uv_index > THRESHOLDS.uv_index) {
          triggeredAlerts.push({
            type: 'uv',
            message: `☀️ UV extremo en ${beach.name}: índice ${weather.uv_index.toFixed(1)}`,
          });
        }
        if (weather.precipitation > THRESHOLDS.precipitation_mmh) {
          triggeredAlerts.push({
            type: 'precipitacion',
            message: `🌧️ Lluvia intensa en ${beach.name}: ${weather.precipitation.toFixed(1)} mm/h`,
          });
        }

        if (triggeredAlerts.length === 0) {
          beachesProcessed++;
          continue;
        }

        // Crear alertas para cada guardavidas según sus preferencias
        const newAlerts: { user_id: string; type: string; message: string; is_read: boolean }[] = [];
        const pushTokens: string[] = [];
        const pushBody = triggeredAlerts.map((a) => a.message).join(' | ');

        for (const profile of profiles) {
          for (const alert of triggeredAlerts) {
            const wantsAlert =
              (alert.type === 'viento' && profile.notify_wind) ||
              (alert.type === 'uv' && profile.notify_uv) ||
              (alert.type === 'precipitacion' && profile.notify_precipitation);

            if (wantsAlert) {
              newAlerts.push({ user_id: profile.id, type: alert.type, message: alert.message, is_read: false });
            }
          }

          if (profile.expo_push_token && isWithinShift(profile.shift_start, profile.shift_end)) {
            const wantsAnyAlert = triggeredAlerts.some((a) =>
              (a.type === 'viento' && profile.notify_wind) ||
              (a.type === 'uv' && profile.notify_uv) ||
              (a.type === 'precipitacion' && profile.notify_precipitation)
            );
            if (wantsAnyAlert) pushTokens.push(profile.expo_push_token);
          }
        }

        if (newAlerts.length > 0) {
          await supabase.from('alerts').insert(newAlerts);
          alertsCreated += newAlerts.length;
        }

        if (pushTokens.length > 0) {
          await sendPushNotifications(pushTokens, `🚨 Alerta — ${beach.name}`, pushBody);
          pushSent += pushTokens.length;
        }

        beachesProcessed++;
      } catch (beachErr) {
        console.error(`Error processing beach [${beach.id.slice(0, 8)}...]:`, beachErr);
      }
    }

    return new Response(
      JSON.stringify({ beachesProcessed, alertsCreated, pushSent }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
