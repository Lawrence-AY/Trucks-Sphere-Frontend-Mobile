const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, relative), exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => name in overrides ? overrides[name] : require(name) });
  return exports;
}
const warehouse = load('../utils/warehouse.ts');
const workflow = load('../utils/storeReceiving.ts', { './warehouse': warehouse });
const metrics = load('../utils/storemanInspection.ts');
const incoming = { id: 'one', jobId: 'WH001/J0001', isWarehouseDelivery: true, warehouseAcceptedAt: 'today', status: 'SITE_WEIGHED_OUT', driverName: 'Driver', materials: [{ materialId: 'one', materialName: 'Bolts', quantity: 12, unit: 'Pieces' }] };
const received = { ...incoming, receivingStatus: 'received_pending_inspection', storeReceiving: { condition: 'Pass', materialReceipts: [{ materialName: 'Bolts', receivedQuantity: 10, photoURLs: ['photo'] }] } };

test('queues separate receiving, pending inspection, rejection, approval and legacy inspections', () => {
  assert.equal(workflow.isStoreIncoming(incoming), true);
  assert.equal(workflow.isStoreIncoming(received), false);
  assert.equal(workflow.isStorePendingInspection(received), true);
  for (const receivingStatus of ['receiving_rejected', 'inspection_rejected', 'inventory_added']) {
    const job = { ...received, receivingStatus };
    assert.equal(workflow.isStoreIncoming(job), false);
    assert.equal(workflow.isStorePendingInspection(job), false);
  }
  assert.equal(workflow.isStoreIncoming({ ...incoming, materialInspection: { materialReceipts: [{}] } }), false);
  assert.equal(workflow.isStoreIncoming({ ...incoming, warehouseAcceptedAt: null }), false);
  assert.equal(workflow.isStoreIncoming({ ...incoming, siteWeighInWeight: 12 }), false);
});

function fixture({ inspection = false, failUpload = false, failSave = false } = {}) {
  const states = [], refs = [], calls = [];
  let stateIndex = 0, refIndex = 0;
  let jobs = [inspection ? received : incoming];
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef(initial) { const index = refIndex++; refs[index] ||= { current: initial }; return refs[index]; },
  };
  const save = async (id, payload) => {
    calls.push({ type: 'save', payload });
    if (failSave) { failSave = false; throw new Error('Network unavailable'); }
    return { ...jobs[0], receivingStatus: inspection ? 'inventory_added' : 'received_pending_inspection', storeReceiving: received.storeReceiving };
  };
  const store = Object.assign(selector => selector({ refresh: async () => {} }), { getState: () => ({ optimisticUpdate: (_, job) => { calls.push({ type: 'cache' }); jobs = [job]; } }) });
  const component = load('../components/StoreReceivingWorkflow.tsx', {
    react, 'react-native': Object.fromEntries(['Image', 'RefreshControl', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name]).concat([['Platform', { OS: 'web' }]])),
    'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'local-photo' }] }) },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-router': { useLocalSearchParams: () => ({ id: 'one' }) },
    '../hooks/useTheme': { useTheme: () => ({}) }, '../store/realtimeData': { useDeliveryOrders: () => jobs },
    '../store/realTimeSyncStore': { useRealTimeSyncStore: store },
    '../services/api': { receiveStoreDelivery: save, inspectStoreDelivery: save },
    '../services/uploadService': { uploadReceivingPhoto: async () => { calls.push({ type: 'upload' }); if (failUpload) throw new Error('Upload failed'); return { photoURL: 'remote-photo' }; } },
    '../utils/storeReceiving': workflow, '../utils/storemanInspection': metrics,
    './InspectionChoice': { InspectionChoice: 'Choice' }, './EnterpriseUI': { SearchField: 'Search' }, './StoreReceiptDetails': { StoreReceiptDetails: 'Details' },
  }).default;
  const render = () => { stateIndex = 0; refIndex = 0; return component({ inspection }); };
  const nodes = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const find = predicate => { const matches = nodes(render()).filter(predicate); assert.equal(matches.length, 1); return matches[0]; };
  const button = () => find(node => node.props?.accessibilityRole === 'button');
  const setDecision = value => find(node => node.type === 'Choice').props.onChange(value);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const fillIntake = async () => {
    find(node => node.props?.accessibilityLabel === 'Received quantity for Bolts').props.onChangeText('10');
    setDecision('Pass');
    assert.equal(button().props.disabled, true, 'photo remains mandatory');
    find(node => node.type === 'TouchableOpacity' && node.props.children?.props?.children === 'Add material photo *').props.onPress();
    await tick();
  };
  return { render, find, button, setDecision, calls, tick, fillIntake };
}
test('receiving saves only after photo upload and never displays quality checkboxes', async () => {
  const ui = fixture();
  await ui.fillIntake();
  assert.equal(ui.button().props.disabled, false);
  ui.button().props.onPress();
  await ui.tick();
  assert.deepEqual(ui.calls.map(call => call.type), ['upload', 'save', 'cache']);
  assert.equal(ui.calls[1].payload.condition, 'Pass');
  assert.equal(ui.calls[1].payload.qualityChecks, undefined);
  assert.deepEqual(Array.from(ui.calls[1].payload.quantities), ['10']);
});
test('failed photo upload never submits intake and preserves entered quantities', async () => {
  const ui = fixture({ failUpload: true });
  await ui.fillIntake(); ui.button().props.onPress(); await ui.tick();
  assert.deepEqual(ui.calls.map(call => call.type), ['upload']);
  assert.equal(ui.find(node => node.props?.accessibilityLabel === 'Received quantity for Bolts').props.value, '10');
  assert.equal(ui.button().props.disabled, false);
});
test('retry keeps the request ID and uploaded evidence; double taps cannot submit twice', async () => {
  const ui = fixture({ failSave: true });
  await ui.fillIntake();
  const button = ui.button(); button.props.onPress(); button.props.onPress(); await ui.tick();
  assert.deepEqual(ui.calls.map(call => call.type), ['upload', 'save']);
  ui.button().props.onPress(); await ui.tick();
  assert.deepEqual(ui.calls.map(call => call.type), ['upload', 'save', 'save', 'cache']);
  assert.equal(ui.calls[1].payload.requestId, ui.calls[2].payload.requestId);
});
test('inspection approval stays disabled until every visible quality checkbox is selected', async () => {
  const ui = fixture({ inspection: true });
  ui.setDecision('Pass');
  for (const metric of metrics.STOREMAN_GENERAL_METRICS) {
    assert.equal(ui.button().props.disabled, true);
    const checkbox = ui.find(node => node.props?.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === metric);
    assert.equal(checkbox.props.accessibilityState.checked, false);
    checkbox.props.onPress();
  }
  assert.equal(ui.button().props.disabled, false);
  ui.button().props.onPress(); await ui.tick();
  assert.deepEqual(ui.calls.map(call => call.type), ['save', 'cache']);
  assert.ok(metrics.STOREMAN_GENERAL_METRICS.every(metric => ui.calls[0].payload.qualityChecks[metric]));
});
test('inspection failure requires a reason without requiring approval checkboxes', async () => {
  const ui = fixture({ inspection: true });
  ui.setDecision('Failed'); assert.equal(ui.button().props.disabled, true);
  ui.find(node => node.props?.accessibilityLabel === 'Rejection reason').props.onChangeText('Contaminated');
  assert.equal(ui.button().props.disabled, false);
  ui.button().props.onPress(); await ui.tick();
  assert.equal(ui.calls[0].payload.result, 'Failed');
  assert.equal(ui.calls[0].payload.reason, 'Contaminated');
});
