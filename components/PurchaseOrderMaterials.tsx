import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

import { getPurchaseOrderMaterials } from '../utils/poMaterials';
import { Gap } from '../constants/theme';
export { getPurchaseOrderMaterials } from '../utils/poMaterials';

export function PurchaseOrderMaterials({ order }: { order: any }) {
  const colors = useTheme();
  return <View style={{ gap: Gap, marginVertical: 8 }}>
    {getPurchaseOrderMaterials(order).map((line, index) => (
      <Text key={`${line.materialId || 'material'}-${index}`} style={{ fontSize: 14, color: colors.textMuted }}>
        {index + 1}. {line.materialName || 'Material'}
        {!line.isWarehouseMaterial && line.quantity != null
          ? ` · ${line.quantity}${line.unit ? ` ${line.unit}` : ''}` : ''}
      </Text>
    ))}
  </View>;
}
