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
  latitude: string;
  longitude: string;
}

const EMPTY_FORM: BeachForm = { name: '', municipality: '', latitude: '', longitude: '' };

export default function AdminScreen() {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Beach | null>(null);
  const [form, setForm] = useState<BeachForm>(EMPTY_FORM);
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
    setModalOpen(true);
  }

  function openEdit(beach: Beach) {
    setEditing(beach);
    setForm({
      name: beach.name,
      municipality: beach.municipality,
      latitude: beach.latitude.toString(),
      longitude: beach.longitude.toString(),
    });
    setModalOpen(true);
  }

  async function save() {
    const { name, municipality, latitude, longitude } = form;
    if (!name || !municipality || !latitude || !longitude) {
      Alert.alert('Error', 'Completá todos los campos.');
      return;
    }
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Error', 'Latitud y longitud deben ser números.');
      return;
    }

    setSaving(true);
    if (editing) {
      await supabase.from('beaches').update({ name, municipality, latitude: lat, longitude: lon }).eq('id', editing.id);
    } else {
      await supabase.from('beaches').insert({ name, municipality, latitude: lat, longitude: lon });
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
              <Text style={styles.beachCoords}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
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

          <ScrollView contentContainerStyle={styles.modalForm}>
            {[
              { label: 'Nombre', key: 'name', placeholder: 'Playa Bristol', caps: 'words' },
              { label: 'Municipio', key: 'municipality', placeholder: 'Mar del Plata', caps: 'words' },
              { label: 'Latitud', key: 'latitude', placeholder: '-38.0023', keyboard: 'decimal-pad' },
              { label: 'Longitud', key: 'longitude', placeholder: '-57.5575', keyboard: 'decimal-pad' },
            ].map((field) => (
              <View key={field.key}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textSecondary}
                  value={form[field.key as keyof BeachForm]}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
                  autoCapitalize={(field.caps as any) ?? 'none'}
                  keyboardType={(field.keyboard as any) ?? 'default'}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
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
  list: { padding: 16, gap: 0 },
  beachItem: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  beachItemInactive: { opacity: 0.5 },
  beachInfo: { flex: 1 },
  beachName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  beachMunicipality: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  beachCoords: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
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
  modalForm: { padding: 20, gap: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.text, backgroundColor: Colors.card },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
