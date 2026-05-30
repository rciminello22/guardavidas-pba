import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

async function sendPushNotification(token: string, title: string, body: string) {
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'alertas',
    }),
  });
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all profiles with assigned beach
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, expo_push_token, notify_wind, notify_uv, notify_precipitation, beaches(id, name, municipality, latitude, longitude)')
      .not('beach_id', 'is', null);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let alertsCreated = 0;
    let pushSent = 0;

    for (const profile of profiles) {
      try {
        const beach = profile.beaches as any;
        if (!beach) continue;

        const weather = await getWeather(beach.latitude, beach.longitude);
        const newAlerts: { user_id: string; type: string; message: string; is_read: boolean }[] = [];
        const pushMessages: string[] = [];

        if (profile.notify_wind && weather.windspeed > THRESHOLDS.wind_kmh) {
          const msg = `⚠️ Viento peligroso en ${beach.name}: ${weather.windspeed.toFixed(1)} km/h del ${getWindDirection(weather.winddirection)}`;
          newAlerts.push({ user_id: profile.id, type: 'viento', message: msg, is_read: false });
          pushMessages.push(msg);
        }

        if (profile.notify_uv && weather.uv_index > THRESHOLDS.uv_index) {
          const msg = `☀️ UV extremo en ${beach.name}: índice ${weather.uv_index.toFixed(1)}`;
          newAlerts.push({ user_id: profile.id, type: 'uv', message: msg, is_read: false });
          pushMessages.push(msg);
        }

        if (profile.notify_precipitation && weather.precipitation > THRESHOLDS.precipitation_mmh) {
          const msg = `🌧️ Lluvia intensa en ${beach.name}: ${weather.precipitation.toFixed(1)} mm/h`;
          newAlerts.push({ user_id: profile.id, type: 'precipitacion', message: msg, is_read: false });
          pushMessages.push(msg);
        }

        if (newAlerts.length > 0) {
          await supabase.from('alerts').insert(newAlerts);
          alertsCreated += newAlerts.length;

          if (profile.expo_push_token && pushMessages.length > 0) {
            await sendPushNotification(
              profile.expo_push_token,
              `🚨 Alerta — ${beach.name}`,
              pushMessages.join(' | ')
            );
            pushSent++;
          }
        }
      } catch (profileErr) {
        console.error(`Error processing profile ${profile.id}:`, profileErr);
      }
    }

    return new Response(
      JSON.stringify({ processed: profiles.length, alertsCreated, pushSent }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
