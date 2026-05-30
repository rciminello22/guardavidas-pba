import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Beach } from '../../lib/types';
import { Colors } from '../../lib/colors';

interface BeachForm {
  name: string;
  municipality: string;
}

interface GeoResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const EMPTY_FORM: BeachForm = { name: '', municipality: '' };

async function geocode(name: string, municipality: string): Promise<GeoResult | null> {
  const query = encodeURIComponent(`${name}, ${municipality}, Buenos Aires, Argentina`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GuardavidasPBA/1.0' },
  });
  const data = await res.json();
  if (!data || data.length === 0) return null;

  return {
    latitude: Number.parseFloat(data[0].lat),
    longitude: Number.parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

export default function AdminScreen() {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Beach | null>(null);
  const [form, setForm] = useState<BeachForm>(EMPTY_FORM);
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadBeaches = useCallback(async () => {
    const { data } = await supabase
      .from('beaches')
      .select('*')
      .order('municipality')
      .order('name');
    setBeaches(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBeaches(); }, [loadBeaches]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setGeoResult(null);
    setModalOpen(true);
  }

  function openEdit(beach: Beach) {
    setEditing(beach);
    setForm({ name: beach.name, municipality: beach.municipality });
    setGeoResult({ latitude: beach.latitude, longitude: beach.longitude, displayName: `${beach.name}, ${beach.municipality}` });
    setModalOpen(true);
  }

  async function handleGeocode() {
    if (!form.name || !form.municipality) {
      Alert.alert('Error', 'Completá nombre y municipio primero.');
      return;
    }
    setGeocoding(true);
    setGeoResult(null);
    const result = await geocode(form.name, form.municipality);
    setGeocoding(false);
    if (!result) {
      Alert.alert('No encontrado', 'No se pudo encontrar la ubicación. Probá con otro nombre o municipio.');
      return;
    }
    setGeoResult(result);
  }

  async function save() {
    if (!form.name || !form.municipality) {
      Alert.alert('Error', 'Completá todos los campos.');
      return;
    }
    if (!geoResult) {
      Alert.alert('Error', 'Primero buscá la ubicación de la playa.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name,
      municipality: form.municipality,
      latitude: geoResult.latitude,
      longitude: geoResult.longitude,
    };

    if (editing) {
      await supabase.from('beaches').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('beaches').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    loadBeaches();
  }

  async function toggleActive(beach: Beach) {
    await supabase.from('beaches').update({ is_active: !beach.is_active }).eq('id', beach.id);
    setBeaches((prev) => prev.map((b) => b.id === beach.id ? { ...b, is_active: !b.is_active } : b));
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Playas registradas</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={beaches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.beachItem, !item.is_active && styles.beachItemInactive]}>
            <View style={styles.beachInfo}>
              <Text style={styles.beachName}>{item.name}</Text>
              <Text style={styles.beachMunicipality}>{item.municipality}</Text>
            </View>
            <View style={styles.beachActions}>
              <TouchableOpacity style={styles.editItemBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editItemText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, item.is_active ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                onPress={() => toggleActive(item)}
              >
                <Text style={styles.toggleBtnText}>{item.is_active ? 'Activa' : 'Inactiva'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Editar playa' : 'Nueva playa'}</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={styles.closeBtn}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalForm} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Nombre de la playa</Text>
            <TextInput
              style={styles.input}
              placeholder="Playa Bristol"
              placeholderTextColor={Colors.textSecondary}
              value={form.name}
              onChangeText={(v) => { setForm((p) => ({ ...p, name: v })); setGeoResult(null); }}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Municipio</Text>
            <TextInput
              style={styles.input}
              placeholder="Mar del Plata"
              placeholderTextColor={Colors.textSecondary}
              value={form.municipality}
              onChangeText={(v) => { setForm((p) => ({ ...p, municipality: v })); setGeoResult(null); }}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.geoBtn, geocoding && styles.geoBtnDisabled]}
              onPress={handleGeocode}
              disabled={geocoding}
            >
              {geocoding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.geoBtnText}>📍 Buscar ubicación</Text>
              )}
            </TouchableOpacity>

            {geoResult && (
              <View style={styles.geoResult}>
                <Text style={styles.geoResultTitle}>✅ Ubicación encontrada</Text>
                <Text style={styles.geoResultText} numberOfLines={2}>{geoResult.displayName}</Text>
                <Text style={styles.geoResultCoords}>
                  {geoResult.latitude.toFixed(5)}, {geoResult.longitude.toFixed(5)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (saving || !geoResult) && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving || !geoResult}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar playa</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 16 },
  beachItem: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  beachItemInactive: { opacity: 0.5 },
  beachInfo: { flex: 1 },
  beachName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  beachMunicipality: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  beachActions: { gap: 6, alignItems: 'flex-end' },
  editItemBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  editItemText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#E8F5E9' },
  toggleBtnInactive: { backgroundColor: '#FFEBEE' },
  toggleBtnText: { fontSize: 12, fontWeight: '600' },
  separator: { height: 1, backgroundColor: Colors.border },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  modalForm: { padding: 20, gap: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.text, backgroundColor: Colors.card },
  geoBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  geoBtnDisabled: { opacity: 0.6 },
  geoBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  geoResult: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, borderLeftWidth: 4, borderLeftColor: Colors.success, gap: 4 },
  geoResultTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  geoResultText: { fontSize: 13, color: Colors.textSecondary },
  geoResultCoords: { fontSize: 12, color: Colors.textSecondary, fontFamily: 'monospace' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
