const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

test('stock refresh requests the mounted API route and clears a previous failure', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/management/stocks.tsx'), 'utf8');
  const ast = ts.createSourceFile('stocks.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'load') callback = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const records = [{ id: 'receipt', remainingQuantity: 10 }];
  let rows = [], error = 'Previous failure';
  const context = { loadVersion: { current: 0 }, setLoading() {}, setRows: (value) => { rows = value; }, setError: (value) => { error = value; },
    api: { get: async (url) => { if (url !== '/api/stocks') throw Error('Route not found'); return { data: { data: records } }; } }, module: { exports: {} } };
  vm.runInNewContext(ts.transpileModule(`module.exports = ${callback}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  await context.module.exports(true);
  assert.equal(rows, records);
  assert.equal(error, '');
});
