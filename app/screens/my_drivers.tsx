import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDrivers } from '../../services/api';

export default function MyDriversScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    fetchDrivers().then(data => {
      setDrivers(data);
    }).catch(() => {});
  }, []);

  const vendorDrivers = drivers.filter(d =>
    (d.name || '').toLowerCase().includes((search || '').toLowerCase())
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
      </View>
      <FlatList data={vendorDrivers} keyExtractor={d => d.id} contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accent + '15' }]}>
              <Text style={[styles.avatarText, { color: colors.accent }]}>{item.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.text, { color: colors.textSecondary }]}>{item.phone}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 }, searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' }, name: { fontSize: 15, fontWeight: '600' }, text: { fontSize: 13 },
});