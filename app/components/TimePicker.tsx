import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../lib/colors';

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  return `${h}:00`;
});

export default function TimePicker({ label, value, onChange }: Readonly<TimePickerProps>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerLabel}>{label}</Text>
        <Text style={styles.triggerValue}>{value.slice(0, 5)}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.closeBtn}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={HOURS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, item === value && styles.itemSelected]}
                onPress={() => { onChange(item); setOpen(false); }}
              >
                <Text style={[styles.itemText, item === value && styles.itemTextSelected]}>
                  {item}
                </Text>
                {item === value && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.card,
  },
  triggerLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  triggerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  modal: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  closeBtn: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemSelected: { backgroundColor: Colors.primary + '11' },
  itemText: { fontSize: 18, color: Colors.text, fontWeight: '500' },
  itemTextSelected: { color: Colors.primary, fontWeight: '700' },
  check: { fontSize: 18, color: Colors.primary, fontWeight: '700' },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 20 },
});
