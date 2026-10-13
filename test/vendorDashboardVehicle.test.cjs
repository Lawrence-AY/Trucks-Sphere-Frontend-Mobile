const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, overrides = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: name => name in overrides ? overrides[name] : require(name) });
  return exports;
}
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
const native = Object.fromEntries(['Modal', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View', 'RefreshControl'].map(name => [name, name]));
native.StyleSheet = { create: value => value };
function hooks() {
  const state = [], refs = []; let i = 0, r = 0;
  return { reset: () => { i = 0; r = 0; }, react: {
    useState: initial => { const index = i++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useRef: initial => { const index = r++; return refs[index] ||= { current: initial }; }, useMemo: fn => fn(),
  } };
}
test('all six vendor cards render with live counts and navigate, including completed trips', () => {
  const h = hooks(), routes = [];
  const collections = { drivers: [{ vendorId: 'V1' }], vehicles: [{ vendorId: 'V1' }], purchaseOrders: [{ vendorId: 'V1' }], deliveryOrders: [{ id: 'a', vendorId: 'V1', status: 'COMPLETED' }, { id: 'b', vendorId: 'V1', status: 'SITE_WEIGHED_OUT' }, { id: 'c', vendorId: 'V1', status: 'CANCELLED' }], fuelRecords: [{ vendorId: 'V1', fuelAmount: '12.5' }] };
  const Screen = load('../app/vendor/dashboard.tsx', {
    react: h.react, 'react-native': native, 'expo-router': { router: { push: route => routes.push(route) } }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '../../components/TripMaterials': { TripMaterials: 'Materials' }, '../../components/ResponsiveGrid': { ResponsiveGrid: 'Grid' },
    '../../hooks/useTheme': { useTheme: () => ({}) }, '../../constants/theme': { Gap: 12, Spacing: {} },
    '@/store/authStore': { useAuthStore: () => ({ user: { vendorId: 'V1' } }) },
    '@/store/realtimeData': { useRealtimeCollection: name => ({ data: collections[name] || [], loading: false }) },
    '@/store/realTimeSyncStore': { useRealTimeSyncStore: fn => fn({ refresh: async () => {} }) },
    '../../utils/helpers': { formatEAT: () => '', normalizeVendorId: id => id }, '../../utils/jobStatus': load('../utils/jobStatus.ts'),
    '../../components/EnterpriseUI': Object.fromEntries(['DataCard', 'DetailRow', 'EmptyState', 'MetricTile', 'PageShell', 'SectionTitle'].map(name => [name, name])),
  }).default;
  const render = () => { h.reset(); return nodes(Screen()); };
  let cards = render().filter(node => node.type === 'MetricTile');
  assert.deepEqual(cards.map(card => card.props.label), ['Orders Summary', 'Drivers', 'Trucks', 'Trips', 'Completed', 'Fuel Dispensed']);
  assert.equal(cards[4].props.value, 2);
  assert.equal(cards[5].props.value, '12.5L');
  cards.forEach(card => card.props.onPress());
  assert.deepEqual(routes, ['/vendor/orders', '/vendor/drivers', '/vendor/trucks', '/vendor/trips', '/vendor/trips?status=completed', '/vendor/fuel']);
  collections.drivers.push({ vendorId: 'V1' });
  assert.equal(render().find(node => node.type === 'MetricTile' && node.props.label === 'Drivers').props.value, 2);
});

test('vehicle editing is prefilled, validates input, saves through repository and refreshes the shared store', async () => {
  const h = hooks(), calls = [], vehicle = { id: 'T1', registrationNumber: 'KAA123A', make: 'Isuzu', model: 'FVZ', capacity: 20, capacityUnit: 'tonnes', status: 'active' };
  let fail = true;
  const Modal = load('../components/EditVehicleModal.tsx', {
    react: h.react, 'react-native': native, '../hooks/useTheme': { useTheme: () => ({}) },
    '../services/repositories/VehicleRepository': { vehicleRepository: { update: async (id, data) => { calls.push({ type: 'put', id, data }); if (fail) { fail = false; throw new Error('offline'); } return { ...vehicle, ...data }; } } },
    '../store/realTimeSyncStore': { useRealTimeSyncStore: { getState: () => ({ optimisticUpdate: (_, item) => calls.push({ type: 'cache', item }) }) } },
  }).EditVehicleModal;
  const render = () => { h.reset(); return nodes(Modal({ vehicle, onClose: () => calls.push({ type: 'close' }), onSaved: item => calls.push({ type: 'saved', item }) })); };
  const input = label => render().find(node => node.props?.accessibilityLabel === label);
  const save = () => render().find(node => node.props?.accessibilityRole === 'button').props.onPress();
  const tick = () => new Promise(resolve => setImmediate(resolve));
  assert.equal(input('Plate Number').props.value, 'KAA123A');
  assert.equal(input('Model').props.value, 'FVZ');
  input('Capacity (tonnes)').props.onChangeText('-1'); save(); await tick(); assert.equal(calls.length, 0);
  input('Capacity (tonnes)').props.onChangeText('25'); input('Plate Number').props.onChangeText(' kaa 999b ');
  save(); await tick(); assert.deepEqual(calls.map(call => call.type), ['put']);
  assert.equal(input('Plate Number').props.value, ' kaa 999b ');
  save(); await tick();
  assert.deepEqual(calls.map(call => call.type), ['put', 'put', 'cache', 'saved', 'close']);
  assert.equal(calls[1].data.registrationNumber, 'KAA999B'); assert.equal(calls[1].data.capacity, 25);
});
