import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Result = 'Pass' | 'Failed';
export function InspectionChoice({ value, onChange, label, disabled = false }: {
  value?: Result | ''; onChange: (value: Result) => void; label: string; disabled?: boolean;
}) {
  const colors = useTheme();
  return <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
    {(['Pass', 'Failed'] as const).map((result) => {
      const selected = value === result;
      const color = result === 'Pass' ? colors.success : colors.danger;
      return <Pressable key={result} accessibilityRole="radio" accessibilityLabel={label + ': ' + (result === 'Pass' ? 'Pass' : 'Fail')}
        accessibilityState={{ checked: selected, disabled }} disabled={disabled}
        onPress={() => onChange(result)}
        style={({ pressed }) => [styles.button, { borderColor: selected ? color : colors.border, backgroundColor: selected ? color : colors.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
        <Text pointerEvents="none" style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '700' }}>{selected ? '\u2713 ' : ''}{result === 'Pass' ? 'Pass' : 'Fail'}</Text>
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 12 }, button: { flexGrow: 1, flexBasis: 0, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderRadius: 10, padding: 12 } });
