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
  canSubmit: true, purchaseOrderId: 'PO1', vendorId: 'V1', packagingPhoto: selected, user: { uid: 'warehouse' },
  lines: [{ productName: 'Cement', quantity: '10', unit: 'Bags' }],
  createWarehouseJob: async () => ({ id: 'shipment1', jobId: 'WH1' }),
  uploadWarehousePackagingPhoto: async (id, file) => { uploaded = { id, file }; return { photoURL: 'https://example.test/shipment.png' }; },
  setSaving: () => {}, setJobs: update => { jobs = update(jobs); }, setSheetVisible: () => {}, resetSheet: () => {}, Alert: { alert: () => {} },
 });
 await handleSubmit();
 assert.equal(uploaded.id, 'shipment1');
 assert.equal(uploaded.file.uri, 'file:///shipment.png');
 assert.equal(jobs[0].packagingPhotoURL, 'https://example.test/shipment.png');
});
