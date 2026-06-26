import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/theme';
import { useLocation } from '../hooks/useLocation';

interface LocationPickerProps {
  onLocationChange: (location: { latitude: number; longitude: number; address: string }) => void;
  label?: string;
  initialAddress?: string;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationChange,
  label = 'Capture Location',
  initialAddress,
}) => {
  const colors = useTheme();
  const { latitude, longitude, address, loading, getCurrentLocation } = useLocation();
  const [currentAddress, setCurrentAddress] = useState(initialAddress || '');

  useEffect(() => {
    if (address && latitude && longitude) {
      setCurrentAddress(address);
      onLocationChange({ latitude, longitude, address });
    }
  }, [address, latitude, longitude]);

  const handleGetLocation = async () => {
    const result = await getCurrentLocation();
    if (result) {
      setCurrentAddress(result.address || '');
      onLocationChange(result);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.locationBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
        onPress={handleGetLocation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="location-outline" size={22} color={colors.primary} />
        )}
        <Text
          style={[styles.address, { color: currentAddress ? colors.text : colors.textMuted }]}
          numberOfLines={2}
        >
          {currentAddress || 'Tap to capture location'}
        </Text>
        <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {currentAddress && (
        <View style={styles.coordsRow}>
          <Text style={[styles.coords, { color: colors.textMuted }]}>
            {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 50,
  },
  address: {
    flex: 1,
    fontSize: 13,
    marginLeft: Spacing.sm,
    marginRight: Spacing.sm,
  },
  coordsRow: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  coords: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default LocationPicker;
