const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, requireMock, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: requireMock, ...globals });
  return exports;
}
test('realtime browser listeners tolerate the native window shim and clean up on web', () => {
  const source = fs.readFileSync(path.join(__dirname, '../store/realTimeSyncStore.ts'), 'utf8');
  const snippet = source.slice(source.indexOf('    const resume ='), source.indexOf('\n    set({', source.indexOf('    const resume =')));
  for (const os of ['ios', 'android', 'web']) {
    const events = new Map(); let stopped = 0;
    const host = { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) };
    const exports = {};
    vm.runInNewContext(snippet + '\nexports.stop = liveSyncStop;', { exports, Platform: { OS: os }, window: os === 'web' ? host : {}, document: os === 'web' ? host : undefined, doPoll() {}, stopStream() { stopped++; } });
    assert.equal(events.size, os === 'web' ? 3 : 0);
    exports.stop(); assert.equal(events.size, 0); assert.equal(stopped, 1);
  }
});
test('collection pagination includes every vendor and rejects failed subsequent pages', async () => {
  const { allPages } = load('../services/allPages.ts', () => {});
  const calls = [];
  const rows = await allPages(async page => { calls.push(page); return { data: Array.from({ length: page === 1 ? 200 : 5 }, (_, i) => ({ id: (page - 1) * 200 + i })), total: 205 }; });
  assert.equal(rows.length, 205); assert.deepEqual(calls, [1, 2]);
  await assert.rejects(allPages(async page => { if (page === 2) throw Error('offline'); return { data: [{ id: 1 }], totalPages: 2 }; }), /offline/);
});
test('frontend and backend agree on bulk, bagged, and warehouse receiving routes', () => {
  const frontend = load('../utils/warehouse.ts', () => {});
  const backend = require('../../Trucks-Sphere-Backend/src/utils/receivingRoute.js');
  for (const [job, bulk] of [
    [{ materials: [{ unit: 'tonnes', materialName: 'Sand' }] }, true],
    [{ materials: [{ unit: 'bags', materialName: 'Sand' }] }, false],
    [{ materials: [{ unit: 'pieces' }] }, false],
    [{ isWarehouseDelivery: true, materials: [{ unit: 'kg' }] }, false],
    [{ materials: [{ isWarehouseMaterial: true, unit: 'kg' }] }, false],
    [{ status: 'SITE_WEIGHED_IN' }, true],
  ]) {
    assert.equal(frontend.isBulkMaterial(job), bulk);
    assert.equal(backend.isBulkMaterial(job), bulk);
    assert.equal(frontend.isStoremanMaterial(job), !bulk);
  }
});
test('web refresh runs on interval, focus and reconnect; skips hidden and overlapping calls; cleans up', async () => {
  const events = new Map(); let timer; let cleanup; let calls = 0; let release;
  const host = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const document = { ...host, visibilityState: 'visible' };
  const navigator = { onLine: true };
  const { useWebLiveRefresh } = load('../hooks/useWebLiveRefresh.ts', name => {
    if (name === 'react') return { useRef: value => ({ current: value }), useCallback: fn => fn };
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === 'expo-router') return { useFocusEffect: fn => { cleanup = fn(); } };
    throw new Error(name);
  }, { window: host, document, navigator, setInterval: (fn, delay) => { assert.equal(delay, 5000); timer = fn; return 1; }, clearInterval: () => { timer = null; } });
  useWebLiveRefresh(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  assert.equal(calls, 1, 'refresh immediately on screen focus');
  const first = timer();
  await events.get('focus')();
  assert.equal(calls, 1);
  release(); await first;
  document.visibilityState = 'hidden'; await timer(); assert.equal(calls, 1);
  document.visibilityState = 'visible'; navigator.onLine = false; await timer(); assert.equal(calls, 1);
  navigator.onLine = true; const second = events.get('online')(); assert.equal(calls, 2); release(); await second;
  cleanup(); assert.equal(events.size, 0); assert.equal(timer, null);
});
test('account deletion messages cover operational roles and normalize aliases without granting extra access', () => {
  const access = load('../utils/access.ts', () => { throw new Error('unexpected dependency'); });
  const { accountDeletionCopy } = load('../utils/accountDeletionCopy.ts', () => access);
  for (const role of ['superadmin', 'admin', 'adminlite', 'vendor', 'operator_quarry', 'operator_site', 'operator_fuel', 'operator_warehouse', 'storeman', 'inspector']) {
    const copy = accountDeletionCopy(role);
    assert.match(copy.recovery, /21-day/);
    assert.match(copy.retention, /do not keep your account active/);
    assert.doesNotMatch(copy.context, /operations and reports assigned to you/);
  }
  assert.match(accountDeletionCopy('warehouse_operator').context, /warehouse shipments/);
  assert.match(accountDeletionCopy('super_admin').context, /user and role management/);
  assert.doesNotMatch(accountDeletionCopy('adminlite').context, /user and role management/);
  assert.match(accountDeletionCopy('operator_fuel').context, /fuel dispensing/);
});

test('web bypasses stale persisted collection snapshots while native cache remains available', async () => {
  const file = '../store/realTimeSyncStore.ts';
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['loadCachedData', 'saveCachedData'].includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
  for (const os of ['web', 'ios']) {
    const exports = {}; let reads = 0; let writes = 0;
    vm.runInNewContext(ts.transpileModule(functions + '\nexports.load = loadCachedData; exports.save = saveCachedData;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, Platform: { OS: os }, getItem: async () => { reads++; return '[{"id":"old"}]'; }, setItem: async () => { writes++; },
    });
    const result = await exports.load('cache'); await exports.save('cache', [{ id: 'new' }]);
    assert.equal(reads, os === 'web' ? 0 : 1);
    assert.equal(writes, os === 'web' ? 0 : 1);
    assert.equal(result?.[0]?.id || null, os === 'web' ? null : 'old');
  }
});
