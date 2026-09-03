import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { Material, Vendor } from '../../../store/types';
import { previewPurchaseOrderNumber } from '../../../services/api';
import { showAlert } from '../../../utils/webAlert';

type Line = {
  materialId: string;
  quantity: string;
  unit: string;
};

const UNITS = [
  'Tonnes',
  'Bags',
  'Pieces',
  'Millimetres',
  'Metres',
  'Litres',
  'Cubic Metres',
  'Kilograms',
].map((name) => ({
  id: name,
  name,
}));

const withoutPrefix = (value: unknown, prefix: string) =>
  String(value || '').replace(new RegExp(`^${prefix}`, 'i'), '') || '-';

export default function CreatePurchaseOrderScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendorId, setVendorId] = useState('');

  const [lines, setLines] = useState<Line[]>([
    {
      materialId: '',
      quantity: '',
      unit: '',
    },
  ]);

  const [poNumber, setPoNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const keyboardVisible = useState(false)[0];

  useEffect(() => {
    Promise.all([
      vendorRepository.getAll(),
      materialRepository.getAll(),
    ])
      .then(([v, m]) => {
        setVendors(v);
        setMaterials(m);
      })
      .catch(() =>
        showAlert(
          'Unable to load form options',
          'Check your connection and try again.'
        )
      );
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setPoNumber('');
      return;
    }

    previewPurchaseOrderNumber(vendorId)
      .then(setPoNumber)
      .catch(() => setPoNumber(''));
  }, [vendorId]);

  function updateLine(
    index: number,
    field: keyof Line,
    value: string
  ) {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;

        if (field === 'materialId') {
          const material = materials.find(
            (item) => item.id === value
          );

          return {
            ...line,
            materialId: value,
            unit:
              material?.defaultUnit ||
              material?.measurementType ||
              'units',
          };
        }

        return {
          ...line,
          [field]: value,
        };
      })
    );
  }

  async function create() {
    if (
      !vendorId ||
      lines.some(
        (line) =>
          !line.materialId ||
          !line.unit ||
          !Number.isFinite(Number(line.quantity)) ||
          Number(line.quantity) <= 0
      )
    ) {
      await showAlert(
        'Missing required fields',
        'Select a vendor and complete every material, quantity, and unit.'
      );
      return;
    }

    setSaving(true);

    try {
      const vendor = vendors.find(
        (item) => item.id === vendorId
      );

      const vendorName =
        vendor?.companyName ||
        (vendor as any)?.name ||
        'Unknown';

      const orderLines = lines.map((line) => ({
        materialId: line.materialId,
        materialName:
          materials.find(
            (material) => material.id === line.materialId
          )?.name || '',
        quantity: Number(line.quantity),
        unit: line.unit,
      }));

      const created =
        await purchaseOrderRepository.create({
          clientRequestId: `po-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          vendorId,
          vendorNumber: withoutPrefix(
            vendor?.vendorId || vendor?.id,
            'V'
          ),
          vendorName,
          companyName: vendorName,
          materialId: orderLines[0].materialId,
          materialName: orderLines[0].materialName,
          quantity: orderLines[0].quantity,
          unit: orderLines[0].unit,
          materials: orderLines,
        });

      await showAlert(
        'Purchase order created',
        `${created.poNumber} created successfully.`
      );

      router.replace(
        '/management/purchase-orders' as any
      );
    } catch (error: any) {
      await showAlert(
        'Purchase order not created',
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'Check the fields and try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  const vendorOptions = vendors.map((v) => ({
    id: v.id,
    name: `${withoutPrefix(
      v.vendorId || v.id,
      'V'
    )} - ${
      v.companyName ||
      (v as any)?.name ||
      'Unknown Vendor'
    }`,
  }));

  const materialOptions = materials.map((m) => ({
    id: m.id,
    name: `${withoutPrefix(m.id, 'MAT')} - ${m.name}`,
  }));

  const previewLines = lines
    .filter(
      (line) => line.materialId || line.quantity
    )
    .map((line) => ({
      ...line,
      label:
        materialOptions.find(
          (option) => option.id === line.materialId
        )?.name || 'Select material',
    }));

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? insets.top
          : 0
      }
    >
      <View
        style={[
          styles.bar,
          {
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            router.back();
          }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#1E293B"
          />
        </TouchableOpacity>

        <Text style={styles.title}>
          Create Purchase Order
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? 'interactive'
            : 'on-drag'
        }
        showsVerticalScrollIndicator
      >
        {vendorId ? (
          <View
            style={[
              styles.preview,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: colors.textMuted,
              }}
            >
              PURCHASE ORDER NUMBER
            </Text>

            <Text
              style={{
                color: colors.primary,
                fontSize: 18,
                fontWeight: '800',
              }}
            >
              {poNumber || 'PO0001/V###'}
            </Text>

            {previewLines.length > 0 && (
              <View style={styles.previewLines}>
                <Text
                  style={{
                    color: colors.textMuted,
                  }}
                >
                  MATERIALS AND QUANTITIES
                </Text>

                {previewLines.map((line, index) => (
                  <Text
                    key={index}
                    style={{
                      color: colors.text,
                    }}
                  >
                    {line.label}: {line.quantity || '-'}{' '}
                    {line.unit || 'units'}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <Card>
          <Select
            label="Vendor"
            value={vendorId}
            options={vendorOptions}
            onSelect={setVendorId}
            icon="business-outline"
            required
            placeholder="Select vendor..."
          />

          {lines.map((line, index) => (
            <View
              key={index}
              style={styles.line}
            >
              <View style={styles.lineHeader}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: '700',
                  }}
                >
                  Material {index + 1}
                </Text>

                {lines.length > 1 && (
                  <TouchableOpacity
                    onPress={() =>
                      setLines((current) =>
                        current.filter(
                          (_, i) => i !== index
                        )
                      )
                    }
                  >
                    <Text style={styles.remove}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Select
                label="Material"
                value={line.materialId}
                options={materialOptions.filter(
                  (option) =>
                    option.id === line.materialId ||
                    !lines.some(
                      (other, i) =>
                        i !== index &&
                        other.materialId ===
                          option.id
                    )
                )}
                onSelect={(value) =>
                  updateLine(
                    index,
                    'materialId',
                    value
                  )
                }
                icon="cube-outline"
                required
                placeholder="Select material..."
              />

              <Input
                label="Quantity"
                value={line.quantity}
                onChangeText={(value) =>
                  updateLine(
                    index,
                    'quantity',
                    value
                  )
                }
                icon="scale-outline"
                keyboardType="numeric"
                required
                suffix={line.unit || 'units'}
              />

              <Select
                label="Unit"
                value={line.unit}
                options={UNITS}
                onSelect={(value) =>
                  updateLine(
                    index,
                    'unit',
                    value
                  )
                }
                icon="speedometer-outline"
                required
                placeholder="Select unit..."
              />
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.add,
              {
                borderColor: colors.primary,
              },
            ]}
            onPress={() =>
              setLines((current) => [
                ...current,
                {
                  materialId: '',
                  quantity: '',
                  unit: '',
                },
              ])
            }
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={colors.primary}
            />

            <Text
              style={{
                color: colors.primary,
                fontWeight: '700',
              }}
            >
              Add material
            </Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => {
              Keyboard.dismiss();
              router.back();
            }}
            variant="secondary"
            style={{ flex: 1 }}
          />

          <Button
            title="Create PO"
            onPress={create}
            icon="checkmark-circle"
            style={{ flex: 1 }}
            loading={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  bar: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },

  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },

  preview: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 5,
    marginBottom: Spacing.md,
  },

  previewLines: {
    marginTop: Spacing.sm,
    gap: 3,
  },

  line: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },

  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  remove: {
    color: '#DC2626',
    fontWeight: '700',
  },

  add: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});