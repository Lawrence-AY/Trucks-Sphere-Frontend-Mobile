const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(relative) {
  const filename = path.resolve(__dirname, relative);
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports,
    require: (name) => loadTs(path.relative(__dirname, path.resolve(path.dirname(filename), name + '.ts'))),
  });
  return module.exports;
}

function loadFunction(relative, name) {
  const filename = path.resolve(__dirname, relative);
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let code;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) code = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(code, name);
  const module = { exports: {} };
  const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  vm.runInNewContext(ts.transpileModule(code + '\nmodule.exports = ' + name, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, { module, escapeHtml: escape });
  return module.exports;
}

function memoValue(relative, name, context) {
  const filename = path.resolve(__dirname, relative);
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let code;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) code = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(code);
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule('module.exports = (' + code + ')();', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, { module, ...context });
  return module.exports;
}

test('unassigned warehouse shipments appear in active and total trips, with matching dashboard totals', () => {
  const lifecycle = loadTs('../utils/jobStatus.ts');
  const deliveries = [
    { id: 'warehouse', isWarehouseDelivery: true, status: 'DISPATCHED' },
    { id: 'done', isWarehouseDelivery: true, status: 'COMPLETED' },
    { id: 'cancelled', status: 'CANCELLED' },
  ];
  const context = { deliveries, ...lifecycle, search: '', filter: 'all', materialFilter: '', getStartOfPeriod: () => new Date(0) };
  const active = memoValue('../app/management/active.tsx', 'filtered', context);
  assert.deepEqual(Array.from(active, (item) => item.id), ['warehouse']);
  const all = memoValue('../app/management/trips.tsx', 'completedTrips', { ...context, showAllTrips: true });
  assert.equal(all.length, 2);
  const completed = memoValue('../app/management/trips.tsx', 'completedTrips', { ...context, showAllTrips: false });
  assert.equal(completed.length, 1);
  const stats = memoValue('../app/management/dashboard.tsx', 'stats', { ...context, drivers: [], vehicles: [], vendors: [], isDelayed: () => false });
  assert.equal(stats.totalTrips, all.length);
  assert.equal(stats.activeTrips, active.length);
});

test('inspection remains pending after site weigh-out and stops only after inspection or cancellation', () => {
  const { isAwaitingInspection } = loadTs('../utils/inspection.ts');
  const job = { status: 'SITE_WEIGHED_IN', siteWeighInWeight: 35 };
  assert.equal(isAwaitingInspection(job), true);
  assert.equal(isAwaitingInspection({ ...job, status: 'SITE_WEIGHED_OUT', siteWeighOutWeight: 12 }), true);
  assert.equal(isAwaitingInspection({ ...job, status: 'COMPLETED' }), true);
  assert.equal(isAwaitingInspection({ ...job, materialInspection: { mrfNumber: 'MIF1' } }), false);
  assert.equal(isAwaitingInspection({ ...job, status: 'canceled' }), false);
  assert.equal(isAwaitingInspection({ deliveryOrigin: 'warehouse', warehouseAcceptedAt: '2026-09-01' }), true);
  assert.equal(isAwaitingInspection({ isWarehouseDelivery: true }), false);
});

test('custom site delivery-note PDF shows captured source and omits quarry personnel and weights', () => {
  const build = loadFunction('../app/screens/delivery-note.tsx', 'buildDeliveryNoteHtml');
  const html = build({ isCustomSite: true, materialSource: 'Supplier <yard>', quarryPersonnel: 'Wrong operator', quarryCityTown: 'Wrong quarry', weighInWeight: '35', weighOutWeight: '12', netWeight: '23' });
  assert.match(html, /Supplier &lt;yard&gt;/);
  assert.doesNotMatch(html, /Wrong operator|Wrong quarry|Quarry Personnel|Weight Record/);
  const quarry = build({ quarryPersonnel: 'Quarry operator', quarryCityTown: 'Nairobi', weighInWeight: '35' });
  assert.match(quarry, /Quarry operator/);
});

test('both goods receipt PDF builders include escaped banker information', () => {
  const common = { banker: 'Banker <One>', weightIn: 35, weightOut: 12, netWeight: 23, quantityOrdered: 23 };
  for (const [file, name] of [['../app/screens/receipt-note.tsx', 'buildReceiptNoteHtml'], ['../app/operator-site/weights.tsx', 'buildReceiptHtml']]) {
    const html = loadFunction(file, name)(common);
    assert.match(html, /Banker &lt;One&gt;/);
  }
});

test('PO availability checks all material lines and rejects completed or excess orders', () => {
 const { isPurchaseOrderOpen, formatPurchaseOrderMaterials } = loadTs('../utils/poMaterials.ts');
 const po = { status: 'approved', materials: [{ materialName: 'Sand', quantity: 10, quantityDelivered: 12 }, { materialName: 'Stone', quantity: 20, quantityDelivered: 5 }] };
 assert.equal(isPurchaseOrderOpen(po), true);
 assert.equal(formatPurchaseOrderMaterials(po), 'Sand, Stone');
 for (const status of [' COMPLETED ', 'excess', 'over_delivered', 'canceled']) assert.equal(isPurchaseOrderOpen({ ...po, status }), false);
 assert.equal(isPurchaseOrderOpen({ status: 'approved', quantity: 10, quantityDelivered: 12 }), false);
 assert.equal(isPurchaseOrderOpen({ ...po, materials: po.materials.map(m => ({ ...m, remainingQuantity: 0 })) }), false);
});

test('trip material lists include every manifest line and resolve legacy PO references', () => {
 const { getTripMaterials } = loadTs('../utils/poMaterials.ts');
 const materials = [{ materialId: 'sand' }, { materialId: 'stone' }, { materialId: 'gravel' }];
 assert.equal(getTripMaterials({ materials }).length, 3);
 assert.equal(getTripMaterials({ purchaseOrderId: 'po' }, [{ id: 'po', materials }]).length, 3);
 assert.equal(getTripMaterials({ materialId: 'sand', additionalItems: materials.slice(1) }).length, 3);
});
test('flag view identities are per-user and stable across unrelated trip updates', () => {
 const { flagViewKey } = loadTs('../utils/siteFlags.ts');
 const job = { id: 'trip', securityFlag: { status: 'flagged', flaggedAt: '2026-09-09', reason: 'Review' } };
 const key = flagViewKey('alice', job);
 assert.equal(key, flagViewKey('alice', { ...job, updatedAt: 'later' }));
 assert.notEqual(key, flagViewKey('bob', job));
 assert.notEqual(key, flagViewKey('alice', { ...job, securityFlag: { ...job.securityFlag, flaggedAt: '2026-09-10' } }));
 const viewed = new Set([key]); viewed.add(key); assert.equal(viewed.size, 1);
});

test('opening flagged items decrements the shared badge once per item and user', () => {
 const filename = path.resolve(__dirname, '../store/flagViewsStore.ts');
 const module = { exports: {} };
 const { createStore } = require('zustand/vanilla');
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module, exports: module.exports,
  require: (name) => {
   if (name === 'zustand') return { create: createStore };
   if (name === 'zustand/middleware') return { persist: (initializer) => initializer, createJSONStorage: () => ({}) };
   if (name === 'react-native') return { Platform: { OS: 'web' } };
   if (name === 'expo-secure-store') return {};
   return loadTs('../utils/siteFlags.ts');
  },
 });
 const store = module.exports.useFlagViewsStore;
 const { flagViewKey, isDeliveryFlagged } = loadTs('../utils/siteFlags.ts');
 const jobs = [{ id: 'one', isFlagged: true }, { id: 'two', isFlagged: true }];
 const count = (user) => jobs.filter(job => isDeliveryFlagged(job) && !store.getState().viewed[flagViewKey(user, job)]).length;
 assert.equal(count('alice'), 2);
 store.getState().markViewed('alice', jobs[0]); assert.equal(count('alice'), 1);
 store.getState().markViewed('alice', jobs[0]); assert.equal(count('alice'), 1);
 store.getState().markViewed('alice', jobs[1]); assert.equal(count('alice'), 0);
 assert.equal(count('bob'), 2);
});
