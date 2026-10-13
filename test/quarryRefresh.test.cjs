const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('weigh-in includes another shift location-only job without including other quarries or weighed jobs', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/operator-quarry/weigh-in.tsx'), 'utf8');
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'deliveries') declaration = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const job = { id: 'pending', status: 'CREATED', quarryId: '', quarryName: 'Quarry', quarryLocation: 'Ngomeni', createdByUid: 'other-shift' };
  const exports = {};
  vm.runInNewContext(ts.transpileModule('const ' + declaration + '; exports.jobs = deliveries;', {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, useMemo: fn => fn(), normalizeJobStatus: status => status,
    operatorUid: 'current-shift', operatorQuarryId: '', operatorQuarryLocation: ' ngomeni ',
    allDeliveries: [job, { ...job, id: 'other', quarryLocation: 'Elsewhere' },
      { ...job, id: 'weighed', weighInWeight: 12 }, { ...job, id: 'cancelled', status: 'CANCELLED' }],
  });
  assert.deepEqual(Array.from(exports.jobs, job => job.id), ['pending']);
});

function storeFixture() {
  const request = deferred();
  let state;
  const source = fs.readFileSync(path.join(__dirname, '../store/realTimeSyncStore.ts'), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source + '\nfetchWithETag = () => pending;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports, pending: request.promise, __DEV__: false, console,
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    require(name) {
      if (name === 'zustand') return { create: init => {
        state = init(patch => { state = { ...state, ...patch }; }, () => state);
        return {};
      } };
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      return {};
    },
  });
  return { request, state: () => state, data: () => state.getData('deliveryOrders') };
}

test('a poll begun before job creation cannot remove the confirmed job', async () => {
  const f = storeFixture();
  f.state().subscribe('deliveryOrders');
  f.state().optimisticUpdate('deliveryOrders', { id: 'job', status: 'CREATED' });
  f.request.resolve({ data: [], failed: false, notModified: false, hash: 'old' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.data().length, 1);
  assert.equal(f.data()[0].id, 'job');
});

test('manual refresh cannot undo a weigh-in saved while its request is pending', async () => {
  const f = storeFixture();
  f.state().subscribe('deliveryOrders');
  const refreshing = f.state().refresh('deliveryOrders');
  f.state().optimisticUpdate('deliveryOrders', { id: 'job', status: 'QUARRY_WEIGHED_IN', weighInWeight: 12 });
  f.request.resolve({ data: [{ id: 'job', status: 'CREATED' }], failed: false, notModified: false, hash: 'old' });
  await refreshing;
  assert.equal(f.data()[0].status, 'QUARRY_WEIGHED_IN');
  assert.equal(f.state().isLoading('deliveryOrders'), false);
});

test('weigh-in waits for persistence; failure retains form and success navigates once', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/operator-quarry/weigh-in.tsx'), 'utf8');
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleSaveDraft') handler = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const fail of [true, false]) {
    const request = deferred(); const actions = []; const exports = {};
    vm.runInNewContext(ts.transpileModule('const ' + handler + '; exports.save = handleSaveDraft;', {
      compilerOptions: { target: ts.ScriptTarget.ES2020 },
    }).outputText, {
      exports, saving: false, activeJob: { id: 'job' }, weightIn: '12', user: {},
      setSaving() {}, closeWeighInForm: () => actions.push('close'),
      optimisticUpdate: () => actions.push('update'), router: { navigate: () => actions.push('navigate') },
      Alert: { alert: () => actions.push('error') },
      updateDeliveryOrder: async () => { await request.promise; if (fail) throw new Error('offline'); return { id: 'job' }; },
    });
    const saving = exports.save();
    assert.deepEqual(actions, []);
    request.resolve(); await saving;
    assert.deepEqual(actions, fail ? ['error'] : ['update', 'close', 'navigate']);
  }
});
