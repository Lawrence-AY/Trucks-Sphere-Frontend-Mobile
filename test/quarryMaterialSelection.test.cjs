const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../utils/poMaterials.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: exportsObject });
const { getJobPurchaseOrderMaterials, getTripMaterials, materialSelectionKey, selectedDispatchMaterials, formatTripMaterials } = exportsObject;
const sand = { materialId: 'sand', materialName: 'Sand', quantity: 100, unit: 'Tonnes' };
const stone = { materialId: 'stone', materialName: 'Stone', quantity: 80, unit: 'Tonnes' };
const po = { id: 'po1', poNumber: 'PO001', materials: [sand, stone] };

test('job details and quarry selection show every PO line despite single-material trip context', () => {
  const job = { purchaseOrderId: 'po1', materialId: 'sand', materials: [sand] };
  assert.deepEqual(getJobPurchaseOrderMaterials(job, [po]), [sand, stone]);
  assert.deepEqual(getTripMaterials(job, [po]), [sand]);
});
test('PO ID takes priority over ambiguous PO numbers; legacy number matching works', () => {
  const other = { id: 'other', poNumber: 'PO001', materials: [stone] };
  assert.deepEqual(getJobPurchaseOrderMaterials({ purchaseOrderId: 'po1', poNumber: 'PO001' }, [other, po]), [sand, stone]);
  assert.deepEqual(getJobPurchaseOrderMaterials({ poNumber: 'PO001' }, [po]), [sand, stone]);
});
test('no matching PO preserves legacy job materials and additional items', () => {
  const job = { materialId: 'sand', materialName: 'Sand', additionalItems: [stone] };
  const lines = getJobPurchaseOrderMaterials(job);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].materialName, 'Stone');
});
test('only selected loads reach dispatched documents, while PO keeps all lines', () => {
  const lines = getJobPurchaseOrderMaterials({ purchaseOrderId: 'po1' }, [po]);
  assert.equal(selectedDispatchMaterials(lines, []).length, 0);
  const selected = selectedDispatchMaterials(lines, [materialSelectionKey(stone, 1)]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].materialId, 'stone');
  const document = formatTripMaterials({ materials: selected, purchaseOrderId: 'po1' }, [po]);
  assert.match(document, /Stone/);
  assert.doesNotMatch(document, /Sand/);
  assert.equal(po.materials.length, 2);
});
test('repeated material IDs remain independently selectable; single material auto-selects', () => {
  const lines = [sand, { ...sand, quantity: 20 }];
  assert.notEqual(materialSelectionKey(lines[0], 0), materialSelectionKey(lines[1], 1));
  assert.equal(selectedDispatchMaterials(lines, [materialSelectionKey(lines[1], 1)])[0].quantity, 20);
  assert.equal(selectedDispatchMaterials([sand], []).length, 1);
});

function htmlBuilder(file, name) {
  const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter(node =>
    (ts.isFunctionDeclaration(node) && node.name?.text === name)
    || (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === 'escapeHtml'))
  ).map(node => node.getText(ast)).join('\n');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(declarations + `\nmodule.exports = ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, { module });
  return module.exports;
}
test('printed delivery note omits banker even when record supplies one', () => {
  const html = htmlBuilder('../app/screens/delivery-note.tsx', 'buildDeliveryNoteHtml')({ jobId: 'J1', banker: 'BankerSecret', materialName: 'Stone' });
  assert.doesNotMatch(html, /Banker|BankerSecret/);
  assert.match(html, /Stone/);
});
