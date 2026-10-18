import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { router } from '../../../../utils/router';
import { showAlert } from '../../../../utils/webAlert';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing } from '../../../../constants/theme';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { StackScreen } from '../../../../components/ui/StackScreen';
import { purchaseOrderRepository } from '../../../../services/repositories/PurchaseOrderRepository';
import { vendorRepository } from '../../../../services/repositories/VendorRepository';
import { materialRepository } from '../../../../services/repositories/MaterialRepository';
import { vendorOptions } from '../../../../utils/vendorOptions';
import { getPurchaseOrderMaterials } from '../../../../utils/poMaterials';
import { PurchaseOrder, Vendor, Material } from '@/store/types';

type Line = { materialId: string; quantity: string };

export default function EditPurchaseOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([purchaseOrderRepository.getById(id), vendorRepository.getAll(), materialRepository.getAll()])
      .then(([order, v, m]) => {
        if (!order) throw new Error('Purchase order not found.');
        setPo(order); setVendors(v); setMaterials(m); setVendorId(order.vendorId || '');
        setLines(getPurchaseOrderMaterials(order).map(line => ({ materialId: line.materialId || '', quantity: line.quantity == null ? '' : String(line.quantity) })));
      }).catch(err => setError(err?.message || 'Unable to load purchase order.'))
      .finally(() => setLoading(false));
  }, [id]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line));
    setError('');
  }

  async function save() {
    if (saving || !po) return;
    if (!vendorId || !lines.length || lines.some(line => {
      const material = materials.find(m => m.id === line.materialId);
      return !material || (!material.isWarehouseMaterial && (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0));
    })) { setError('Select a vendor and material, and enter a positive quantity for each material.'); return; }
    if (lines.length > 1 && lines.some(line => materials.find(m => m.id === line.materialId)?.isWarehouseMaterial)) {
      setError('A warehouse reference purchase order can contain only one material.'); return;
    }
    setSaving(true); setError('');
    try {
      await purchaseOrderRepository.update(id, {
        vendorId,
        materials: lines.map(line => ({ materialId: line.materialId, quantity: materials.find(m => m.id === line.materialId)?.isWarehouseMaterial ? null : Number(line.quantity) })),
      } as any);
      router.replace(`/management/purchase-orders/${id}` as any);
      await showAlert('Saved', 'Purchase order updated successfully.');
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Unable to save purchase order.'); }
    finally { setSaving(false); }
  }

  const editable = po && !['cancelled', 'archived', 'completed'].includes(po.status);
  return (
    <StackScreen title="Edit purchase order" subtitle={po?.poNumber} fallbackHref="/management/purchase-orders" loading={loading} scroll={false}>
      {!loading && !editable ? <Text style={{ color: colors.danger }}>{error || 'This purchase order is closed and cannot be edited.'}</Text> : null}
      {!loading && editable ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.xl }}>
        <Card>
          <Select label="Vendor" value={vendorId} options={vendorOptions(vendors)} onSelect={setVendorId} required />
          {lines.map((line, index) => {
            const material = materials.find(m => m.id === line.materialId);
            return <View key={index} style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              <Select label={`Material ${index + 1}`} value={line.materialId}
                options={materials.filter(m => (m.status !== 'inactive' && (m as any).active !== false) || m.id === line.materialId).map(m => ({ id: m.id, name: `${m.id} - ${m.name}` }))}
                onSelect={value => updateLine(index, { materialId: value, quantity: '' })} required />
              {!material?.isWarehouseMaterial ? <Input label="Quantity" value={line.quantity} onChangeText={value => updateLine(index, { quantity: value })} keyboardType="numeric" suffix={material?.measurementType || material?.defaultUnit || (material as any)?.unit || ''} required /> : null}
              {lines.length > 1 ? <Button title="Remove material" variant="ghost" onPress={() => setLines(current => current.filter((_, i) => i !== index))} /> : null}
            </View>;
          })}
          <Button title="Add material" variant="secondary" onPress={() => setLines(current => [...current, { materialId: '', quantity: '' }])} />
        </Card>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        <Button title="Save Changes" onPress={save} loading={saving} disabled={saving} />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} disabled={saving} />
      </ScrollView> : null}
    </StackScreen>
  );
}
