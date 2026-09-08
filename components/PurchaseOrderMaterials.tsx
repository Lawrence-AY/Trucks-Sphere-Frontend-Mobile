import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export function getPurchaseOrderMaterials(order: any): any[] {
  return Array.isArray(order.materials) && order.materials.length ? order.materials : [order];
}

export function PurchaseOrderMaterials({ order }: { order: any }) {
  const colors = useTheme();
  return <View style={{ gap: 4, marginVertical: 8 }}>
    {getPurchaseOrderMaterials(order).map((line, index) => (
      <Text key={`${line.materialId || 'material'}-${index}`} style={{ fontSize: 14, color: colors.textMuted }}>
        {line.materialName || 'Material'}
        {!line.isWarehouseMaterial && line.quantity != null
          ? ` · ${line.quantity}${line.unit ? ` ${line.unit}` : ''}` : ''}
      </Text>
    ))}
  </View>;
}
