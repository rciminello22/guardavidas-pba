import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../lib/colors';
import { THRESHOLDS } from '../../lib/types';
import { registerForPushNotifications } from '../../lib/notifications';

interface NotifSetting {
  key: 'notify_wind' | 'notify_uv' | 'notify_precipitation';
  icon: string;
  title: string;
  description: string;
  threshold: string;
}

const SETTINGS: NotifSetting[] = [
  {
    key: 'notify_wind',
    icon: '💨',
    title: 'Alerta de viento',
    description: 'Recibís una alerta cuando el viento supera el límite.',
    threshold: `Umbral: > ${THRESHOLDS.wind_kmh} km/h`,
  },
  {
    key: 'notify_uv',
    icon: '☀️',
    title: 'Alerta UV',
    description: 'Recibís una alerta cuando el índice UV es muy alto.',
    threshold: `Umbral: > ${THRESHOLDS.uv_index}`,
  },
  {
    key: 'notify_precipitation',
    icon: '🌧️',
    title: 'Alerta de lluvia',
    description: 'Recibís una alerta cuando hay precipitaciones intensas.',
    threshold: `Umbral: > ${THRESHOLDS.precipitation_mmh} mm/h`,
  },
];

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    notify_wind: true,
    notify_uv: true,
    notify_precipitation: true,
  });
  const [hasPushToken, setHasPushToken] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  async function loadPrefs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('notify_wind, notify_uv, notify_precipitation, expo_push_token')
      .eq('id', user.id)
      .single();

    if (data) {
      setPrefs({
        notify_wind: data.notify_wind,
        notify_uv: data.notify_uv,
        notify_precipitation: data.notify_precipitation,
      });
      setHasPushToken(!!data.expo_push_token);
    }
    setLoading(false);
  }

  async function togglePref(key: keyof typeof prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ [key]: value })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      setPrefs(prefs);
      Alert.alert('Error', 'No se pudo guardar la preferencia.');
    }
  }

  async function requestPushPermission() {
    const token = await registerForPushNotifications();
    if (!token) {
      Alert.alert(
        'Permiso denegado',
        'Para recibir notificaciones, habilitá los permisos en Configuración del dispositivo.'
      );
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
    setHasPushToken(true);
    Alert.alert('✅ ¡Listo!', 'Vas a recibir notificaciones de alertas.');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {!hasPushToken && (
          <View style={styles.permissionBanner}>
            <Text style={styles.permissionIcon}>🔕</Text>
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Notificaciones desactivadas</Text>
              <Text style={styles.permissionDesc}>
                Activá las notificaciones para recibir alertas climáticas.
              </Text>
            </View>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPushPermission}>
              <Text style={styles.permissionBtnText}>Activar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipos de alerta</Text>
          <Text style={styles.sectionSubtitle}>
            {saving ? 'Guardando...' : 'Elegí qué alertas querés recibir.'}
          </Text>
        </View>

        {SETTINGS.map((setting, index) => (
          <View key={setting.key}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Text style={styles.settingIcon}>{setting.icon}</Text>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDesc}>{setting.description}</Text>
                  <View style={styles.thresholdBadge}>
                    <Text style={styles.thresholdText}>{setting.threshold}</Text>
                  </View>
                </View>
              </View>
              <Switch
                value={prefs[setting.key]}
                onValueChange={(v) => togglePref(setting.key, v)}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={prefs[setting.key] ? Colors.primary : Colors.textSecondary}
                disabled={saving}
              />
            </View>
            {index < SETTINGS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ ¿Cómo funcionan las alertas?</Text>
          <Text style={styles.infoText}>
            La Edge Function de Supabase verifica las condiciones climáticas de tu ubicación
            cada 30 minutos. Si se supera algún umbral, recibirás una notificación push
            y la alerta aparecerá en la sección "Alertas".
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    padding: 16,
    gap: 12,
  },
  permissionIcon: {
    fontSize: 28,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  permissionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  settingLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  settingIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  settingInfo: {
    flex: 1,
    gap: 4,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  settingDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  thresholdBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  thresholdText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  infoBox: {
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
