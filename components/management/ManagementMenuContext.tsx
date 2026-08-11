import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

const ManagementMenuContext = createContext<() => void>(() => {});

export function ManagementMenuProvider({ openMenu, children }: { openMenu: () => void; children: ReactNode }) {
  return <ManagementMenuContext.Provider value={openMenu}>{children}</ManagementMenuContext.Provider>;
}

/** Native header action shared by standard and search-enabled management screens. */
export function ManagementHeaderMenuButton() {
  const openMenu = useContext(ManagementMenuContext);
  const colors = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      onPress={openMenu}
      style={styles.button}
    >
      <Ionicons name="menu-outline" size={23} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
});
