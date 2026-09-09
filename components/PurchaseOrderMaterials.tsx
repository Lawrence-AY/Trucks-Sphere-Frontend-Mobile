import { PurchaseOrderDeliveryVariance } from './PurchaseOrderDeliveryVariance';
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

import { getPurchaseOrderMaterials } from '../utils/poMaterials';
export { getPurchaseOrderMaterials } from '../utils/poMaterials';

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
    <PurchaseOrderDeliveryVariance order={order} />
  </View>;
}
