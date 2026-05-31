export type AlertType = 'viento' | 'uv' | 'precipitacion';

export interface Beach {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  beach_id: string | null;
  beach_name: string | null;
  lifeguard_id: string;
  expo_push_token?: string | null;
  is_admin: boolean;
  notify_wind: boolean;
  notify_uv: boolean;
  notify_precipitation: boolean;
  shift_start: string;
  shift_end: string;
}

export interface Alert {
  id: string;
  user_id: string;
  type: AlertType;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface WeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  precipitation: number;
  uv_index: number;
  weathercode: number;
}

export interface WeatherThresholds {
  wind_kmh: number;
  uv_index: number;
  precipitation_mmh: number;
}

export const THRESHOLDS: WeatherThresholds = {
  wind_kmh: 40,
  uv_index: 8,
  precipitation_mmh: 5,
};
