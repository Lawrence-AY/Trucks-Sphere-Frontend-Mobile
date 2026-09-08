const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function harness(result, withPassword = true) {
  const source = fs.readFileSync(path.join(__dirname, '../app/management/vendors/create.tsx'), 'utf8');
  const ast = ts.createSourceFile('create.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && ['validate', 'handleCreate'].includes(node.name?.text)) functions.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const calls = [], alerts = [];
  let resets = 0;
  const form = new Proxy({ companyName: 'Supplier', contactPerson: 'Test Person', phone: '0700000000', email: '', password: withPassword ? 'Test7$' : '', confirmPassword: withPassword ? 'Test7$' : '', status: 'active', accountStatus: 'active' }, { get: (target, key) => target[key] ?? '' });
  const context = {
    form, createInFlight: { current: false }, setSaving() {}, setErrors() {},
    setForm() { resets++; }, setGeneratedUsername() {}, getStrongPasswordError: () => null,
    vendorRepository: {
      createWithAccount: async (payload) => { calls.push({ account: payload.account }); return result; },
      create: async () => { calls.push({ profileOnly: true }); return { id: 'V1' }; },
    },
    Alert: { alert: (...args) => alerts.push(args) }, router: { back() {} }, module: { exports: {} },
  };
  vm.runInNewContext(ts.transpileModule(functions.join('\n') + '\nmodule.exports = { handleCreate };', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return { save: context.module.exports.handleCreate, calls, alerts, resets: () => resets };
}

test('vendor password creates an account even when email is blank', async () => {
  const h = harness({ vendor: { id: 'V1' }, username: 'testper' });
  await h.save();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].account.email, '');
  assert.equal(h.calls[0].account.password, 'Test7$');
  assert.match(h.alerts[0][1], /testper/);
  assert.equal(h.resets(), 1);
});

test('missing creation response preserves the form and does not throw an in-operator error', async () => {
  const h = harness(undefined);
  await h.save();
  assert.equal(h.resets(), 0);
  assert.equal(h.alerts[0][0], 'Error');
  assert.match(h.alerts[0][1], /did not confirm/);
});

test('a vendor profile without any account details remains supported', async () => {
  const h = harness(undefined, false);
  await h.save();
  assert.equal(h.calls[0].profileOnly, true);
  assert.match(h.alerts[0][1], /without a login account/);
});
