import React, { Children, useState } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Gap } from '../constants/theme';

/**
 * Equal-width rows keep the shared gutter from forcing columns to wrap.
 */
export function ResponsiveGrid({ children, style, minItemWidth = 220, maxColumns = 4, sideBySide = false, ...props }: ViewProps & { minItemWidth?: number; maxColumns?: number; sideBySide?: boolean }) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children);
  const columns = Math.max(1, Math.min(maxColumns, items.length, sideBySide ? items.length : Math.floor(width / minItemWidth) || 1));
  const rows = Array.from({ length: Math.ceil(items.length / columns) }, (_, row) => items.slice(row * columns, (row + 1) * columns));
  return (
    <View {...props} onLayout={(event) => { setWidth(event.nativeEvent.layout.width); props.onLayout?.(event); }} style={[style, styles.grid]}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={column} style={styles.cell}>{row[column]}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    minWidth: 0,
    gap: Gap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Gap,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  } as any,
});
