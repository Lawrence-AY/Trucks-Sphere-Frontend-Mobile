const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TabRouter } = require('expo-router/build/react-navigation/routers/TabRouter');
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
const ts = require('typescript');
const vm = require('node:vm');
const backModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../utils/backNavigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: backModule.exports });
const { getBackTarget } = backModule.exports;

test('Back targets active tab history before a root stack that can leave the app area', () => {
  const state = { key: 'root', type: 'stack', index: 1, routes: [
    { key: 'main' },
    { key: 'management', state: { key: 'management-tabs', type: 'tab', index: 1,
      history: [{ key: 'orders' }, { key: 'details' }], routes: [{ key: 'orders' }, { key: 'details' }] } },
  ] };
  assert.equal(getBackTarget(state), 'management-tabs');
  state.routes[1].state.history = [{ key: 'details' }];
  assert.equal(getBackTarget(state), 'root');
});

test('Back prioritizes an inner edit stack and ignores history in inactive tabs', () => {
  const state = { key: 'tabs', type: 'tab', index: 1, history: [{}, {}], routes: [
    { state: { key: 'inactive', type: 'stack', index: 2, routes: [{}, {}, {}] } },
    { state: { key: 'edit-stack', type: 'stack', index: 1, routes: [{}, {}] } },
  ] };
  assert.equal(getBackTarget(state), 'edit-stack');
  state.routes[1].state.index = 0;
  assert.equal(getBackTarget(state), 'tabs');
  state.history = [{}];
  assert.equal(getBackTarget(state), undefined);
});

const areas = ['management', 'vendor', 'operator-site', 'operator-quarry', 'operator-fuel', 'warehouse', 'inspector'];

function navigator(area, initialRouteName = 'dashboard') {
  const layout = fs.readFileSync(path.join(__dirname, `../app/${area}/_layout.tsx`), 'utf8');
  const backBehavior = layout.match(/<Tabs\s[^>]*backBehavior="([^"]+)"/)?.[1];
  const router = TabRouter({ backBehavior, initialRouteName });
  const options = {
    routeNames: ['dashboard', 'orders', 'details', 'edit', 'materials'],
    routeParamList: {}, routeGetIdList: {},
  };
  let state = router.getInitialState(options);
  return {
    visit(name, params) {
      state = router.getStateForAction(state, { type: 'NAVIGATE', payload: { name, params } }, options);
      assert.ok(state);
    },
    back() {
      const next = router.getStateForAction(state, { type: 'GO_BACK' }, options);
      if (next) state = next;
      return next;
    },
    current: () => state.routes[state.index],
  };
}

for (const area of areas) {
  test(`${area}: back retraces list, detail and edit visits`, () => {
    const nav = navigator(area);
    nav.visit('orders');
    nav.visit('details', { id: 'PO001' });
    nav.visit('edit', { id: 'PO001' });
    nav.back();
    assert.equal(nav.current().name, 'details');
    assert.equal(nav.current().params.id, 'PO001');
    nav.back();
    assert.equal(nav.current().name, 'orders');
    nav.back();
    assert.equal(nav.current().name, 'dashboard');
    assert.equal(nav.back(), null);
  });

  test(`${area}: repeated visits preserve the previous route and record`, () => {
    const nav = navigator(area);
    nav.visit('orders');
    nav.visit('details', { id: 'PO001' });
    nav.visit('materials');
    nav.visit('details', { id: 'PO002' });
    nav.back();
    assert.equal(nav.current().name, 'materials');
    nav.back();
    assert.equal(nav.current().name, 'details');
    assert.equal(nav.current().params.id, 'PO001');
    nav.back();
    assert.equal(nav.current().name, 'orders');
  });

  test(`${area}: a direct entry does not invent a dashboard visit`, () => {
    const nav = navigator(area, 'details');
    assert.equal(nav.back(), null);
    assert.equal(nav.current().name, 'details');
  });
}

test('returning from a shared screen preserves the role area navigation state', () => {
  const router = StackRouter({ initialRouteName: 'management' });
  const options = { routeNames: ['management', 'screens'], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  const managementKey = state.routes[0].key;
  state = router.getStateForAction(state, { type: 'PUSH', payload: { name: 'screens', params: { screen: 'receipt-note', id: 'DO001' } } }, options);
  state = router.getStateForAction(state, { type: 'GO_BACK' }, options);
  assert.equal(state.routes[state.index].key, managementKey);
});
