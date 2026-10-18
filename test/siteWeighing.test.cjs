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
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast)) && (node.name.getText(ast) !== 'filtered' || node.initializer?.getText(ast).startsWith('useMemo('))) declarations.push('const ' + node.getText(ast) + ';');
  ts.forEachChild(node, visit);
 }
 visit(ast);
 assert.equal(declarations.length, names.length);
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(declarations.join('\n') + '\nmodule.exports = { ' + names.join(',') + ' };', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, { module, ...context });
 return module.exports;
}


const normalizeJobStatus = value => ({ site_in: 'SITE_WEIGHED_IN', delivered: 'COMPLETED', cancelled: 'CANCELLED', completed: 'COMPLETED' }[value] || String(value).toUpperCase());
const isWarehouseMaterial = job => job.isWarehouseDelivery || job.deliveryOrigin === 'warehouse';
const queued = { id: 'warehouse', isWarehouseDelivery: true, status: 'DISPATCHED' };
const quarry = { id: 'quarry', status: 'DISPATCHED', weighInWeight: 10, weighOutWeight: 30 };
function schedule(deliveries) {
 return loadDeclarations('../components/site/SiteScheduleScreen.tsx', ['allScheduled'], { deliveries, useMemo: fn => fn(), normalizeJobStatus, isWarehouseMaterial }).allScheduled;
}
function weights(deliveries) {
 return loadDeclarations('../app/operator-site/weights.tsx', ['eligibleJobs'], { deliveries, operatorSiteId: '', useMemo: fn => fn(), normalizeJobStatus }).eligibleJobs;
}
test('warehouse and quarry deliveries move from schedule to weights after site weigh-in', () => {
 const deliveries = [queued, quarry];
 assert.deepEqual(Array.from(schedule(deliveries), job => job.id), ['warehouse', 'quarry']);
 assert.equal(weights(deliveries).length, 0);
 const arrived = deliveries.map(job => ({ ...job, siteWeighInWeight: 30, status: 'SITE_WEIGHED_IN' }));
 assert.equal(schedule(arrived).length, 0);
 assert.deepEqual(Array.from(weights(arrived), job => job.id), ['warehouse', 'quarry']);
 const finished = arrived.map(job => ({ ...job, siteWeighOutWeight: 12, status: 'SITE_WEIGHED_OUT' }));
 assert.equal(schedule(finished).length, 0);
 assert.equal(weights(finished).length, 0);
});
test('denied, flagged and completed warehouse shipments cannot enter either queue', () => {
 for (const patch of [{ warehouseDeniedAt: 'now' }, { isFlagged: true }, { securityFlag: { status: 'flagged' } }, { status: 'CANCELLED' }, { status: 'COMPLETED' }, { materialInspection: { mrfNumber: 'MIF1' } }]) {
  assert.equal(schedule([{ ...queued, ...patch }]).length, 0);
  assert.equal(weights([{ ...queued, siteWeighInWeight: 30, ...patch }]).length, 0);
 }
});
test('a dynamic weigh-in page selects only the requested delivery', () => {
 const deliveries = [queued, quarry];
 const result = loadDeclarations('../components/site/SiteScheduleScreen.tsx', ['filtered'], { deliveries, jobId: 'warehouse', allScheduled: deliveries, search: '', useMemo: fn => fn() }).filtered;
 assert.deepEqual(Array.from(result, job => job.id), ['warehouse']);
});

test('warehouse weigh-in needs no lot while quarry weigh-in retains lot validation', async () => {
 for (const warehouse of [true, false]) {
  let saved = false;
  let errors = {};
  const { handleConfirmWeightIn } = loadDeclarations('../components/site/SiteScheduleScreen.tsx', ['handleConfirmWeightIn'], {
   getWeightInput: () => '30', getLotInput: () => '', isWarehouseMaterial,
   setSubmitErrors: fn => { errors = fn(errors); },
   submitWeightIn: (job, weight) => { saved = true; assert.equal(weight, 30); },
   Alert: { alert: () => assert.fail('Unexpected alert') },
  });
  await handleConfirmWeightIn({ id: 'job', isWarehouseDelivery: warehouse });
  assert.equal(saved, warehouse);
  assert.equal(Boolean(errors.job), !warehouse);
 }
});


test('PO0017 saved Access weight 2300 leaves schedule and survives queue reload', () => {
 const original = { id: 'PO0017-V008-D007-T006-J0001', jobId: 'PO0017/V008/D007/T006/J0001', poNumber: 'PO0017/V008',
  vendorName: 'Abdifattah Ali Kurawa', driverName: 'Kibaki Kubaki', plateNumber: 'KDD678L', materialName: 'Ballast',
  quarryLocation: 'Ngomeni', status: 'DISPATCHED', weighInWeight: 1000, weighOutWeight: 2300 };
 assert.equal(schedule([original]).length, 1);
 const persisted = JSON.parse(JSON.stringify({ ...original, status: 'SITE_WEIGHED_IN', siteWeighInWeight: 2300, siteArrivalWeight: 2300 }));
 assert.equal(schedule([persisted]).length, 0);
 const waiting = weights([persisted]);
 assert.equal(waiting.length, 1);
 assert.equal(waiting[0].siteWeighInWeight, 2300);
 assert.equal(waiting[0].jobId, original.jobId);
 assert.equal(weights([{ ...persisted, status: 'SITE_WEIGHED_OUT', siteWeighOutWeight: 1000 }]).length, 0);
});


test('site history includes listener and other operators across all sites and dates', () => {
 const allDeliveries = [
  {id: 'listener', siteId: 'A', status: 'SITE_WEIGHED_OUT', accessBridgeKey: 'capture', receivedBy: 'Scale operator', siteWeighOutAt: '2026-09-01T08:00:00Z'},
  {id: 'other-shift', siteId: 'B', status: 'COMPLETED', receivedByUid: 'other', receivedAt: '2026-10-13T08:00:00Z'},
  {id: 'active', siteId: 'C', status: 'SITE_WEIGHED_IN'},
 ];
 const context = { allDeliveries, dateRange: null, materialFilter: '', matchesMaterial: () => true, filter: 'all', startDate: new Date('2026-10-13T00:00:00Z'), useMemo: fn => fn(), normalizeJobStatus, generateReceiptNoteId: () => 'receipt' };
 const result = loadDeclarations('../app/operator-site/history.tsx', ['deliveries', 'completedRecords'], context);
 assert.deepEqual(Array.from(result.completedRecords, job => job.id), ['other-shift', 'listener']);
 const today = loadDeclarations('../app/operator-site/history.tsx', ['deliveries', 'completedRecords'], {...context, filter: 'today'});
 assert.deepEqual(Array.from(today.completedRecords, job => job.id), ['other-shift']);
});

test('site history retains listener attribution without requiring an app user UID', () => {
 const { receiver, listenerRecord } = loadDeclarations('../app/operator-site/history.tsx', ['receiver', 'listenerRecord'], {});
 assert.equal(receiver({receivedBy: 'Weighbridge operator'}), 'Weighbridge operator');
 assert.equal(receiver({siteWeighOutByName: 'Final operator', receivedByName: 'Arrival operator'}), 'Final operator');
 assert.equal(receiver({}), 'Not recorded');
 assert.equal(listenerRecord({accessBridgeKey: 'capture'}), true);
});


test('history material filter matches additional material lines and can be cleared', () => {
 const getPurchaseOrderMaterials = record => record.materials || [record, ...(record.additionalItems || [])];
 for (const role of ['operator-site', 'operator-quarry']) {
  const load = materialFilter => loadDeclarations(`../app/${role}/history.tsx`, ['matchesMaterial'], { materialFilter, getPurchaseOrderMaterials }).matchesMaterial;
  const record = { materialName: 'Sand', additionalItems: [{ materialName: 'Stone' }] };
  assert.equal(load('Stone')(record), true);
  assert.equal(load('Cement')(record), false);
  assert.equal(load('')(record), true);
  assert.equal(load('Stone')({ materials: [{ materialName: 'Sand' }, { materialName: 'Stone' }] }), true);
 }
});

test('report date range includes both boundary days in Nairobi time', () => {
 const source = fs.readFileSync(path.join(__dirname, '../components/DateRangeFilter.tsx'), 'utf8');
 const ast = ts.createSourceFile('filter.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'isInDateRange');
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(declaration.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: module.exports });
 const check = module.exports.isInDateRange;
 const range = { startDate: '2026-10-01', endDate: '2026-10-18' };
 assert.equal(check('2026-09-30T21:00:00Z', range), true);
 assert.equal(check('2026-10-18T20:59:59Z', range), true);
 assert.equal(check('2026-09-30T20:59:59Z', range), false);
 assert.equal(check('2026-10-18T21:00:00Z', range), false);
 assert.equal(check('invalid', range), false);
 assert.equal(check(null, range), false);
 assert.equal(check({ seconds: Date.parse('2026-10-10T00:00:00Z') / 1000 }, range), true);
 assert.equal(check(null, null), true);
});
