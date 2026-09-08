import React, { Children, useState } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

/** Measure the available container, including space taken by desktop navigation. */
export function ResponsiveGrid({ children, style, minItemWidth = 220, maxColumns = 4, sideBySide = false, ...props }: ViewProps & { minItemWidth?: number; maxColumns?: number; sideBySide?: boolean }) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children);
  const columns = Math.max(1, Math.min(maxColumns, items.length, sideBySide ? items.length : Math.floor(width / minItemWidth)));
  return (
    <View {...props} onLayout={(event) => { setWidth(event.nativeEvent.layout.width); props.onLayout?.(event); }} style={[style, styles.grid]}>
      {items.map((child, index) => (
        <View key={React.isValidElement(child) ? child.key ?? index : index} style={{ width: `${100 / columns}%`, minWidth: 0, padding: 4 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ grid: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 0, alignItems: 'stretch' } });
