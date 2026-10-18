const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../utils/materialCategories.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { normalizeMaterialCategory, normalizeMaterialCategories } = exportsObject;

test('legacy categories group consistently across management, site and quarry', () => {
  for (const [raw, expected] of [['aggregate', 'Aggregates'], [' Aggregates ', 'Aggregates'], ['binder', 'Cement'],
    ['steel', 'Steel'], ['liquids', 'Liquid'], ['block', 'Blocks'], ['warehouse', 'Warehouse'], ['', 'Other']]) {
    assert.equal(normalizeMaterialCategory(raw), expected);
  }
});

test('warehouse designation takes precedence without changing source records', () => {
  const source = [{ id: 'one', category: 'aggregate', isWarehouseMaterial: true }, { id: 'two', category: 'binder' }];
  const result = normalizeMaterialCategories(source);
  assert.equal(result[0].category, 'Warehouse');
  assert.equal(result[1].category, 'Cement');
  assert.equal(source[0].category, 'aggregate');
  assert.equal(result[1].id, 'two');
});
