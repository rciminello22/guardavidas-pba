import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Beach } from '../../lib/types';
import { Colors } from '../../lib/colors';

interface BeachPickerProps {
  selectedId: string | null;
  initialBeach?: Beach | null;
  onSelect: (beach: Beach) => void;
}

export default function BeachPicker({ selectedId, initialBeach, onSelect }: Readonly<BeachPickerProps>) {
  const [open, setOpen] = useState(false);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [filtered, setFiltered] = useState<Beach[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(initialBeach ?? null);

  useEffect(() => {
    if (initialBeach) setSelectedBeach(initialBeach);
  }, [initialBeach]);

  useEffect(() => {
    if (open && beaches.length === 0) loadBeaches();
  }, [open]);

  useEffect(() => {
    if (selectedId && beaches.length > 0) {
      const found = beaches.find((b) => b.id === selectedId);
      if (found) setSelectedBeach(found);
    }
  }, [selectedId, beaches]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? beaches.filter(
            (b) =>
              b.name.toLowerCase().includes(q) ||
              b.municipality.toLowerCase().includes(q)
          )
        : beaches
    );
  }, [search, beaches]);

  async function loadBeaches() {
    setLoading(true);
    const { data } = await supabase
      .from('beaches')
      .select('*')
      .eq('is_active', true)
      .order('municipality')
      .order('name');
    setBeaches(data ?? []);
    setFiltered(data ?? []);
    setLoading(false);
  }

  function handleSelect(beach: Beach) {
    setSelectedBeach(beach);
    onSelect(beach);
    setOpen(false);
    setSearch('');
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={selectedBeach ? styles.triggerText : styles.triggerPlaceholder}>
          {selectedBeach ? `${selectedBeach.name} — ${selectedBeach.municipality}` : 'Seleccioná tu playa'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccioná tu playa</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }}>
              <Text style={styles.closeBtn}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Buscar playa o municipio..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.item, item.id === selectedId && styles.itemSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMunicipality}>{item.municipality}</Text>
                  </View>
                  {item.id === selectedId && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  triggerPlaceholder: {
    fontSize: 16,
    color: Colors.textSecondary,
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  search: {
    margin: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.card,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemSelected: {
    backgroundColor: Colors.primary + '11',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  itemMunicipality: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  check: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 20,
  },
});
