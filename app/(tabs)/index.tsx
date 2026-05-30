import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import {
  fetchWeather,
  getWeatherDescription,
  getWeatherIcon,
  getUvLabel,
  getWindLabel,
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
}

function WeatherCard({ label, value, unit, icon, statusColor, statusLabel }: WeatherCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: statusColor, borderLeftWidth: 5 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Text style={styles.cardValue}>
        {value}
        <Text style={styles.cardUnit}> {unit}</Text>
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
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

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Se necesita permiso de ubicación para mostrar el clima.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      const [weatherData, geoResult] = await Promise.all([
        fetchWeather(latitude, longitude),
        Location.reverseGeocodeAsync({ latitude, longitude }),
      ]);

      setWeather(weatherData);
      setLastUpdated(new Date());

      if (geoResult.length > 0) {
        const geo = geoResult[0];
        setLocationName(
          [geo.city, geo.region].filter(Boolean).join(', ') || 'Ubicación actual'
        );
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const pushToken = await registerForPushNotifications();
        await supabase.from('profiles').update({
          expo_push_token: pushToken,
          latitude,
          longitude,
        }).eq('id', user.id);

        await checkAndCreateAlerts(user.id, weatherData);
      }
    } catch (err: any) {
      setError(err.message ?? 'Error al obtener datos del clima.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function checkAndCreateAlerts(userId: string, data: WeatherData) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('notify_wind, notify_uv, notify_precipitation')
      .eq('id', userId)
      .single();

    if (!profile) return;

    const alerts: { type: string; message: string }[] = [];

    if (profile.notify_wind && data.windspeed > THRESHOLDS.wind_kmh) {
      alerts.push({
        type: 'viento',
        message: `⚠️ Viento peligroso: ${data.windspeed.toFixed(1)} km/h (límite: ${THRESHOLDS.wind_kmh} km/h)`,
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

  useEffect(() => {
    loadData();
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
          <View style={styles.grid}>
            <WeatherCard
              label="Viento"
              value={weather.windspeed.toFixed(1)}
              unit="km/h"
              icon="💨"
              statusColor={windInfo.color}
              statusLabel={windInfo.label}
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
            <WeatherCard
              label="Temperatura"
              value={weather.temperature.toFixed(1)}
              unit="°C"
              icon="🌡️"
              statusColor={Colors.primary}
              statusLabel="Actual"
            />
          </View>

          <View style={styles.thresholdsBox}>
            <Text style={styles.thresholdsTitle}>Umbrales de alerta</Text>
            <Text style={styles.thresholdRow}>💨 Viento: &gt; {THRESHOLDS.wind_kmh} km/h</Text>
            <Text style={styles.thresholdRow}>☀️ UV: &gt; {THRESHOLDS.uv_index}</Text>
            <Text style={styles.thresholdRow}>🌧️ Lluvia: &gt; {THRESHOLDS.precipitation_mmh} mm/h</Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  card: {
    width: '47%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginHorizontal: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
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
