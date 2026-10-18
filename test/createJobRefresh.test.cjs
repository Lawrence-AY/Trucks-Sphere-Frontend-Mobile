const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function declaration(file, name) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast).replace(/^export /, '');
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = 'const ' + node.getText(ast) + ';';
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, name);
  return result;
}
function load(code, name, context) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code + `\nexports.handler = ${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, ...context });
  return exports.handler;
}

test('failed purchase-order fetch rejects instead of publishing an empty list', async () => {
  const offline = new Error('offline');
  const handler = load(declaration('../services/api.ts', 'fetchPurchaseOrders'), 'fetchPurchaseOrders', {
    backendRequest: async () => { throw offline; }, allPages: fetch => fetch(1),
    safeFetch: async (_name, fetch) => { try { return await fetch(); } catch { return []; } },
  });
  await assert.rejects(handler(undefined, { throwOnError: true }), /offline/);
  assert.equal((await handler()).length, 0);
});

test('site keeps its existing orders and open form when refresh fails', async () => {
  let orders = [{ id: 'existing' }], visible = true, error = '';
  const handler = load(declaration('../components/site/SiteScheduleScreen.tsx', 'loadFabData'), 'loadFabData', {
    fetchDrivers: async () => [], fetchVehicles: async () => [],
    fetchPurchaseOrders: async () => { throw new Error('offline'); },
    setPurchaseOrders: value => { orders = value; }, setFabVisible: value => { visible = value; },
    setFabPoLoading() {}, setFabSubmitError: value => { error = value; }, setAllDrivers() {}, setAllVehicles() {}, setDriverMap() {}, setFabDataLoaded() {},
  });
  await handler();
  assert.equal(orders[0].id, 'existing');
  assert.equal(visible, true);
  assert.match(error, /Unable to load purchase orders/);
});

test('quarry keeps its existing orders and open form when refresh fails', async () => {
  let orders = [{ id: 'existing' }], visible = true, error = '';
  const handler = load(declaration('../app/operator-quarry/dashboard.tsx', 'loadData'), 'loadData', {
    fetchPurchaseOrders: async () => { throw new Error('offline'); }, refresh: async () => {},
    setFreshPurchaseOrders: value => { orders = value; }, setAddVisible: value => { visible = value; },
    setPoLoading() {}, setSubmitError: value => { error = value; }, setRefreshing() {}, setLoading() {},
  });
  await handler(true);
  assert.equal(orders[0].id, 'existing');
  assert.equal(visible, true);
  assert.match(error, /Unable to refresh purchase orders/);
});

function availability() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../utils/poMaterials.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports });
  return exports.isPurchaseOrderOpen;
}

test('active weighbridge POs without ordered quantities remain selectable', () => {
  const isOpen = availability();
  const po = { status: 'active', bridgeCreated: true, vendorId: 'V001', materialId: 'MAT001', materialName: 'Murram' };
  assert.equal(isOpen(po), true);
  assert.equal(isOpen({ ...po, quantity: null }), true);
  assert.equal(isOpen({ ...po, quantity: '' }), true);
  assert.equal(isOpen({ ...po, materials: [{ materialId: 'MAT001', materialName: 'Murram' }] }), true);
  assert.equal(isOpen({ status: 'active' }), false);
});

test('known zero, exhausted and closed POs remain unavailable', () => {
  const isOpen = availability();
  const po = { status: 'active', vendorId: 'V001', materialId: 'MAT001' };
  assert.equal(isOpen({ ...po, quantity: 0 }), false);
  assert.equal(isOpen({ ...po, remainingQuantity: 0 }), false);
  assert.equal(isOpen({ ...po, quantity: 10, quantityDelivered: 10 }), false);
  for (const status of ['completed', 'cancelled', 'archived', 'closed', 'excess']) assert.equal(isOpen({ ...po, status }), false);
});

test('operations job creation accepts active POs as well as approved POs', async () => {
  const isOpen = availability();
  let selected;
  const po = { id: 'PO0001-V001', status: 'active', vendorId: 'V001', materialId: 'MAT001' };
  const handler = load(declaration('../app/operations/jobs/create.tsx', 'loadData'), 'loadData', {
    purchaseOrderRepository: { getAll: async () => [po, { ...po, id: 'closed', status: 'completed' }] },
    driverRepository: { getAll: async () => [] }, vehicleRepository: { getAll: async () => [] },
    isPurchaseOrderOpen: isOpen, setPos: value => { selected = value; }, setDrivers() {}, setVehicles() {}, setErrors() {},
  });
  await handler();
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, po.id);
});
