/**
 * HamburgerMenu is now integrated into app/(tabs)/_layout.tsx
 * This file is kept for backward compatibility.
 * The hamburger menu appears on every screen's headerRight via the tab layout.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

// Placeholder - actual implementation is in the tab layout
const HamburgerMenuPlaceholder = () => <View style={styles.placeholder} />;

const styles = StyleSheet.create({
  placeholder: { width: 0, height: 0 },
});

export default HamburgerMenuPlaceholder;
