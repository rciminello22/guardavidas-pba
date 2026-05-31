import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Profile, Beach } from '../../lib/types';
import { Colors } from '../../lib/colors';
import BeachPicker from '../components/BeachPicker';
import TimePicker from '../components/TimePicker';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentBeach, setCurrentBeach] = useState<Beach | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [lifeguardId, setLifeguardId] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // CN-016: exclude expo_push_token from profile screen query
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, beach_id, beach_name, lifeguard_id, is_admin, notify_wind, notify_uv, notify_precipitation, shift_start, shift_end, beaches(id, name, municipality, latitude, longitude)')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setFullName(data.full_name);
      setLifeguardId(data.lifeguard_id);
      setShiftStart((data.shift_start ?? '08:00').slice(0, 5));
      setShiftEnd((data.shift_end ?? '18:00').slice(0, 5));
      if (data.beaches) {
        const beach = data.beaches as unknown as Beach;
        setCurrentBeach(beach);
        setSelectedBeach(beach);
      }
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!fullName || !selectedBeach || !lifeguardId) {
      Alert.alert('Error', 'Completá todos los campos.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        beach_id: selectedBeach.id,
        beach_name: selectedBeach.name,
        lifeguard_id: lifeguardId,
        shift_start: shiftStart,
        shift_end: shiftEnd,
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) { Alert.alert('Error', 'No se pudo guardar el perfil.'); return; }

    setCurrentBeach(selectedBeach);
    setEditing(false);
    await loadProfile();
    Alert.alert('✅ Perfil actualizado');
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Estás seguro que querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: async () => await supabase.auth.signOut() },
    ]);
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
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.nameText}>{profile?.full_name}</Text>
          <Text style={styles.idText}>Legajo: {profile?.lifeguard_id}</Text>
          {currentBeach && (
            <Text style={styles.beachText}>🏖️ {currentBeach.name} — {currentBeach.municipality}</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Datos del guardavidas</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={styles.editBtn}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nombre completo</Text>
            {editing ? (
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            ) : (
              <Text style={styles.fieldValue}>{profile?.full_name}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Playa asignada</Text>
            {editing ? (
              <BeachPicker selectedId={selectedBeach?.id ?? null} initialBeach={selectedBeach} onSelect={setSelectedBeach} />
            ) : (
              <View style={styles.fieldRow}>
                <Text style={styles.beachIcon}>🏖️</Text>
                <Text style={styles.fieldValue}>
                  {currentBeach ? `${currentBeach.name} — ${currentBeach.municipality}` : '—'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Legajo</Text>
            {editing ? (
              <TextInput style={styles.input} value={lifeguardId} onChangeText={setLifeguardId} autoCapitalize="characters" />
            ) : (
              <Text style={styles.fieldValue}>{profile?.lifeguard_id}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Horario de turno</Text>
            {editing ? (
              <View style={styles.shiftRow}>
                <View style={styles.shiftItem}>
                  <Text style={styles.shiftSubLabel}>Entrada</Text>
                  <TimePicker label="Entrada" value={shiftStart} onChange={setShiftStart} />
                </View>
                <View style={styles.shiftItem}>
                  <Text style={styles.shiftSubLabel}>Salida</Text>
                  <TimePicker label="Salida" value={shiftEnd} onChange={setShiftEnd} />
                </View>
              </View>
            ) : (
              <Text style={styles.fieldValue}>🕐 {(profile?.shift_start ?? '08:00').slice(0, 5)} — {(profile?.shift_end ?? '18:00').slice(0, 5)}</Text>
            )}
          </View>

          {editing && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditing(false);
                  setFullName(profile?.full_name ?? '');
                  setSelectedBeach(currentBeach);
                  setLifeguardId(profile?.lifeguard_id ?? '');
                  setShiftStart(profile?.shift_start ?? '08:00');
                  setShiftEnd(profile?.shift_end ?? '18:00');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {profile?.expo_push_token && (
          <View style={styles.tokenCard}>
            <Text style={styles.tokenTitle}>🔔 Notificaciones activas</Text>
            <Text style={styles.tokenSubtitle}>Tu dispositivo está registrado para recibir alertas.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  avatarSection: { backgroundColor: Colors.primary, alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  nameText: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  idText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  beachText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card: { margin: 16, backgroundColor: Colors.card, borderRadius: 16, padding: 20 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  editBtn: { fontSize: 15, color: Colors.primary, fontWeight: '700' },
  field: { paddingVertical: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldValue: { fontSize: 17, fontWeight: '600', color: Colors.text },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  beachIcon: { fontSize: 18 },
  divider: { height: 1, backgroundColor: Colors.border },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  tokenCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: Colors.success },
  tokenTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  tokenSubtitle: { fontSize: 13, color: Colors.textSecondary },
  logoutBtn: { marginHorizontal: 16, borderWidth: 2, borderColor: Colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.danger },
  shiftRow: { flexDirection: 'row', gap: 12 },
  shiftItem: { flex: 1, gap: 4 },
  shiftSubLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});
