import { WeatherData } from './types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: 'temperature_2m,windspeed_10m,precipitation,uv_index,weathercode',
    timezone: 'America/Argentina/Buenos_Aires',
    forecast_days: '1',
  });

  const response = await fetch(`${BASE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Error al obtener el clima: ${response.status}`);
  }

  const data = await response.json();
  const current = data.current;

  return {
    temperature: current.temperature_2m,
    windspeed: current.windspeed_10m,
    precipitation: current.precipitation,
    uv_index: current.uv_index,
    weathercode: current.weathercode,
  };
}

export function getWeatherDescription(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 9) return 'Niebla';
  if (code <= 19) return 'Llovizna';
  if (code <= 29) return 'Lluvia';
  if (code <= 39) return 'Nieve';
  if (code <= 49) return 'Niebla';
  if (code <= 59) return 'Llovizna';
  if (code <= 69) return 'Lluvia';
  if (code <= 79) return 'Nieve';
  if (code <= 84) return 'Lluvia intensa';
  if (code <= 94) return 'Tormenta';
  return 'Tormenta severa';
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 9) return '🌫️';
  if (code <= 49) return '🌧️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 84) return '🌧️';
  return '⛈️';
}

export function getUvLabel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: 'Bajo', color: '#4CAF50' };
  if (uv <= 5) return { label: 'Moderado', color: '#CDDC39' };
  if (uv <= 7) return { label: 'Alto', color: '#FF9800' };
  if (uv <= 10) return { label: 'Muy alto', color: '#F44336' };
  return { label: 'Extremo', color: '#9C27B0' };
}

export function getWindLabel(kmh: number): { label: string; color: string } {
  if (kmh <= 20) return { label: 'Suave', color: '#4CAF50' };
  if (kmh <= 40) return { label: 'Moderado', color: '#FF9800' };
  return { label: 'PELIGROSO', color: '#F44336' };
}
