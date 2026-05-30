import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import {
  fetchWeather,
  getWeatherDescription,
  getWeatherIcon,
  getUvLabel,
  getWindLabel,
  getWindDirection,
} from '../../lib/weather';
import { registerForPushNotifications } from '../../lib/notifications';
import { WeatherData, THRESHOLDS } from '../../lib/types';
import { Colors } from '../../lib/colors';

interface WeatherCardProps {
  label: string;
  value: string;
  unit: string;
  icon: string;
  statusColor: string;
  statusLabel: string;
  subtitle?: string;
}

function WeatherCard({ label, value, unit, icon, statusColor, statusLabel, subtitle }: Readonly<WeatherCardProps>) {
  return (
    <View style={[styles.card, { borderLeftColor: statusColor, borderLeftWidth: 5 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.cardValue}>
        {value}
        <Text style={styles.cardUnit}> {unit}</Text>
      </Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function DashboardScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState<string>('Obteniendo ubicación...');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, beaches(*)')
        .eq('id', user.id)
        .single();

      if (!profile?.beaches) {
        setError('No tenés una playa asignada. Actualizá tu perfil.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { latitude, longitude, name, municipality } = profile.beaches;
      setLocationName(`${name} — ${municipality}`);

      const weatherData = await fetchWeather(latitude, longitude);
      setWeather(weatherData);
      setLastUpdated(new Date());

      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        await supabase.from('profiles').update({ expo_push_token: pushToken }).eq('id', user.id);
      }

      await checkAndCreateAlerts(user.id, weatherData, profile);
    } catch (err: any) {
      setError(err.message ?? 'Error al obtener datos del clima.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function checkAndCreateAlerts(userId: string, data: WeatherData, profile: any) {
    if (!profile) return;

    const alerts: { type: string; message: string }[] = [];

    if (profile.notify_wind && data.windspeed > THRESHOLDS.wind_kmh) {
      alerts.push({
        type: 'viento',
        message: `⚠️ Viento peligroso: ${data.windspeed.toFixed(1)} km/h del ${getWindDirection(data.winddirection)} (límite: ${THRESHOLDS.wind_kmh} km/h)`,
      });
    }
    if (profile.notify_uv && data.uv_index > THRESHOLDS.uv_index) {
      alerts.push({
        type: 'uv',
        message: `☀️ UV extremo: índice ${data.uv_index.toFixed(1)} (límite: ${THRESHOLDS.uv_index})`,
      });
    }
    if (profile.notify_precipitation && data.precipitation > THRESHOLDS.precipitation_mmh) {
      alerts.push({
        type: 'precipitacion',
        message: `🌧️ Precipitación intensa: ${data.precipitation.toFixed(1)} mm/h (límite: ${THRESHOLDS.precipitation_mmh} mm/h)`,
      });
    }

    if (alerts.length > 0) {
      await supabase.from('alerts').insert(
        alerts.map((a) => ({
          user_id: userId,
          type: a.type,
          message: a.message,
          is_read: false,
        }))
      );
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        loadData();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Obteniendo condiciones climáticas...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const uvInfo = weather ? getUvLabel(weather.uv_index) : { label: '-', color: Colors.textSecondary };
  const windInfo = weather ? getWindLabel(weather.windspeed) : { label: '-', color: Colors.textSecondary };
  const precipColor = weather && weather.precipitation > THRESHOLDS.precipitation_mmh
    ? Colors.danger
    : Colors.success;

  const hasActiveAlerts = weather && (
    weather.windspeed > THRESHOLDS.wind_kmh ||
    weather.uv_index > THRESHOLDS.uv_index ||
    weather.precipitation > THRESHOLDS.precipitation_mmh
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      <View style={styles.locationBar}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationText} numberOfLines={1}>{locationName}</Text>
        {lastUpdated && (
          <Text style={styles.updatedText}>
            {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {hasActiveAlerts && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertBannerText}>
            🚨 CONDICIONES PELIGROSAS ACTIVAS
          </Text>
        </View>
      )}

      {weather && (
        <>
          <View style={styles.mainWeather}>
            <Text style={styles.mainIcon}>{getWeatherIcon(weather.weathercode)}</Text>
            <Text style={styles.mainTemp}>{weather.temperature.toFixed(1)}°C</Text>
            <Text style={styles.mainDesc}>{getWeatherDescription(weather.weathercode)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Condiciones actuales</Text>
          <View style={styles.bento}>
            <WeatherCard
              label="Viento"
              value={weather.windspeed.toFixed(1)}
              unit="km/h"
              icon="💨"
              statusColor={windInfo.color}
              statusLabel={windInfo.label}
              subtitle={`Dirección: ${getWindDirection(weather.winddirection)}`}
            />
            <WeatherCard
              label="Índice UV"
              value={weather.uv_index.toFixed(1)}
              unit=""
              icon="☀️"
              statusColor={uvInfo.color}
              statusLabel={uvInfo.label}
            />
            <WeatherCard
              label="Precipitación"
              value={weather.precipitation.toFixed(1)}
              unit="mm/h"
              icon="🌧️"
              statusColor={precipColor}
              statusLabel={
                weather.precipitation > THRESHOLDS.precipitation_mmh ? 'Peligrosa' : 'Normal'
              }
            />
          </View>

        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 32,
    gap: 16,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  locationIcon: {
    fontSize: 16,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  updatedText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  alertBanner: {
    backgroundColor: Colors.danger,
    paddingVertical: 12,
    alignItems: 'center',
  },
  alertBannerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainWeather: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.primary,
  },
  mainIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  mainTemp: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 64,
  },
  mainDesc: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  bento: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 0,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  cardUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  thresholdsBox: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  thresholdsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  thresholdRow: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
