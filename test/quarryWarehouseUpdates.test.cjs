const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadDeclarations(file, names, context) {
 const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
 const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const declarations = [];
 function visit(node) {
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) declarations.push('const ' + node.getText(ast) + ';');
  ts.forEachChild(node, visit);
 }
 visit(ast);
 assert.equal(declarations.length, names.length);
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(declarations.join('\n') + '\nmodule.exports = { ' + names.join(',') + ' };', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, { module, ...context });
 return module.exports;
}

test('finishing the weigh-out receipt clears the form and opens history', () => {
 const calls = [];
 const { closeDeliveryNote } = loadDeclarations('../app/operator-quarry/weigh-out.tsx', ['closeDeliveryNote'], {
  closeWeighOutForm: () => calls.push('clear'),
  setDeliveryNoteVisible: value => calls.push(value),
  setDeliveryNoteData: value => calls.push(value),
  router: { replace: route => calls.push(route) },
 });
 closeDeliveryNote();
 assert.deepEqual(calls, ['clear', false, null, '/operator-quarry/history']);
});

test('weigh-out updates the queue and history only after a successful save, including partial responses', async () => {
 for (const reject of [false, true]) {
  let updated;
  let receipt = false;
  let failed = false;
  const { handleConfirmSubmit } = loadDeclarations('../app/operator-quarry/weigh-out.tsx', ['handleConfirmSubmit'], {
   dispatchedMaterials: [{ materialId: 'sand', materialName: 'Sand' }], submitting: false, weightOut: '30',
   activeJob: { id: 'job1', jobId: 'J1', weighInWeight: 10 }, selectedQuarryId: 'q1', operatorQuarryId: 'q1', operatorQuarryLocation: 'Quarry',
   quarries: [], geoLocation: null, user: { uid: 'operator' }, driverPhotoURL: null,
   setConfirmVisible() {}, setSubmitting() {}, formatPurchaseOrderMaterials: () => 'Sand',
   updateDeliveryOrder: async () => { assert.equal(updated, undefined); if (reject) throw Error('Save failed'); return { updatedAt: 'server-time' }; },
   optimisticUpdate: (collection, record) => { assert.equal(collection, 'deliveryOrders'); updated = record; },
   setDeliveryNoteData() {}, setDeliveryNoteVisible: value => { receipt = value; },
   Alert: { alert: () => { failed = true; } },
  });
  await handleConfirmSubmit();
  assert.equal(failed, reject);
  assert.equal(receipt, !reject);
  if (reject) assert.equal(updated, undefined);
  else {
   assert.equal(updated.id, 'job1');
   assert.equal(updated.weighOutWeight, 30);
   assert.equal(updated.status, 'DISPATCHED');
   assert.ok(updated.weighOutAt);
  }
 }
});

test('quarry history CSV aligns both scale readings and actual weigh timestamps with headers', () => {
 const { exportHeaders, buildExportRows } = loadDeclarations('../app/operator-quarry/history.tsx', ['exportHeaders', 'buildExportRows'], {
  formatPurchaseOrderMaterials: () => 'Sand, Stone', formatEAT: value => value,
 });
 const [row] = buildExportRows([{ jobId: 'J1', weighInWeight: 0, weighOutWeight: 25, weighInAt: 'in', weighOutAt: 'out', updatedAt: 'unrelated' }]);
 assert.equal(row.length, exportHeaders.length);
 const cells = Object.fromEntries(exportHeaders.map((header, index) => [header, row[index]]));
 assert.equal(cells['Quarry Weigh-In (t)'], '0');
 assert.equal(cells['Quarry Weigh-Out (t)'], '25');
 assert.equal(cells['Qty Loaded (t)'], '25.0');
 assert.equal(cells['Quarry In-Time'], 'in');
 assert.equal(cells['Quarry Out-Time'], 'out');
 assert.equal(buildExportRows([{}])[0][exportHeaders.indexOf('Quarry Weigh-In (t)')], '');
});

test('warehouse image selection attaches the selected file to the created shipment', async () => {
 let selected;
 const picker = loadDeclarations('../app/warehouse/index.tsx', ['choosePackagingPhoto'], {
  ImagePicker: { requestMediaLibraryPermissionsAsync: async () => ({ granted: true }), launchImageLibraryAsync: async () => ({ assets: [{ uri: 'file:///shipment.png', fileName: 'shipment.png', mimeType: 'image/png' }] }) },
  setPackagingPhoto: value => { selected = value; }, Alert: { alert: () => assert.fail('Unexpected error') },
 });
 await picker.choosePackagingPhoto();
 assert.equal(selected.name, 'shipment.png');
 let uploaded;
 let jobs = [];
 const { handleSubmit } = loadDeclarations('../app/warehouse/index.tsx', ['handleSubmit'], {
  dispatchMethod: 'purchase_order', csvFileName: '', csvHeaders: [], canSubmit: true, purchaseOrderId: 'PO1', vendorId: 'V1', driverName: 'Shipment Driver', plateNumber: 'KAA 001A', packagingPhoto: selected, user: { uid: 'warehouse' },
  lines: [{ productName: 'Cement', quantity: '10', unit: 'Bags' }],
  createWarehouseJob: async () => ({ id: 'shipment1', jobId: 'WH1' }),
  uploadWarehousePackagingPhoto: async (id, file) => { uploaded = { id, file }; return { photoURL: 'https://example.test/shipment.png' }; },
  setSaving: () => {}, setJobs: update => { jobs = update(jobs); }, setSheetVisible: () => {}, resetSheet: () => {}, Alert: { alert: () => {} },
 });
 await handleSubmit();
 assert.equal(uploaded.id, 'shipment1');
 assert.equal(uploaded.file.uri, 'file:///shipment.png');
 assert.equal(jobs.length, 0, 'Submitted shipments leave the warehouse queue for storekeeper receiving');
});

test('warehouse CSV and PDF exports include MRF Source and MRF Number for each product', async () => {
 for (const format of ['csv', 'pdf']) {
  let exported;
  const capture = (headers, rows) => { exported = { headers, rows }; return 'report'; };
  const { exportReport } = loadDeclarations('../app/warehouse/reports.tsx', ['exportReport'], {
   mine: [{ jobId: 'WH1', items: [{ materialName: 'Shoes', source: 'BATA', mrfNo: 'MRF56' }, { materialName: 'Gloves', source: 'ACME', mrfNo: 'MRF57' }] }],
   setExporting() {}, buildCsvContent: capture, buildHtmlContent: capture,
   shareCsvAsFile: async () => {}, sharePdfAsFile: async () => {}, Alert: { alert: () => assert.fail('Export failed') },
  });
  await exportReport(format);
  const sourceColumn = exported.headers.indexOf('MRF Source');
  const mrfColumn = exported.headers.indexOf('MRF Number');
  assert.ok(sourceColumn >= 0); assert.ok(mrfColumn >= 0);
  assert.equal(exported.rows.length, 2);
  assert.equal(exported.rows[0][sourceColumn], 'BATA'); assert.equal(exported.rows[0][mrfColumn], 'MRF56');
  assert.equal(exported.rows[1][sourceColumn], 'ACME'); assert.equal(exported.rows[1][mrfColumn], 'MRF57');
 }
});
