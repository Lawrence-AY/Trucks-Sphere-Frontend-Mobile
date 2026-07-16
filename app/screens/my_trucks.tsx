import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchVehicles } from '../../services/api';

export default function MyTrucksScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [trucks, setTrucks] = useState<any[]>([]);

  useEffect(() => {
    fetchVehicles().then(data => {
      setTrucks(data);
    }).catch(() => {});
  }, []);

  const vendorTrucks = trucks.filter(t =>
    (t.plate || t.plateNumber || '').toLowerCase().includes((search || '').toLowerCase())
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
      </View>
      <FlatList data={vendorTrucks} keyExtractor={t => t.id} contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.plate, { color: colors.accent }]}>{item.plate || item.plateNumber}</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>{item.model}</Text>
            <Text style={[styles.text, { color: colors.textTertiary }]}>Driver: {item.driverName}</Text>
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 }, searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 }, card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 8 },
  plate: { fontSize: 15, fontWeight: '700' }, text: { fontSize: 13, marginTop: 2 },
});