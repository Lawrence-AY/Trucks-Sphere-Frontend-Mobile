import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
export function KeyboardDone() {
  const colors = useTheme();
  if (Platform.OS !== 'ios') return null;
  return <InputAccessoryView nativeID="trucksphere-keyboard-done" backgroundColor={colors.surface}>
    <View style={{ alignItems: 'flex-end', borderTopWidth: 1, borderColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Done editing" onPress={Keyboard.dismiss} style={{ minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.primaryText, fontWeight: '700', fontSize: 16 }}>Done</Text>
      </Pressable>
    </View>
  </InputAccessoryView>;
}
