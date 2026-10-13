const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../utils/storemanInspection.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { STOREMAN_GENERAL_METRICS: metrics, storemanInspectionReady: ready } = exportsObject;
const verified = Object.fromEntries(metrics.map(metric => [metric, true]));
test('Pass requires every general metric to be verified', () => {
 assert.equal(ready('Pass'), false);
 assert.equal(ready('Pass', verified), true);
 for (const metric of metrics) assert.equal(ready('Pass', { ...verified, [metric]: false }), false);
});
test('Fail requires a nonblank reason, independently of metric checks', () => {
 assert.equal(ready('Failed', {}, ''), false);
 assert.equal(ready('Failed', verified, '   '), false);
 assert.equal(ready('Failed', {}, 'Damaged packaging'), true);
});
test('switching decisions applies the selected branch and no decision cannot complete', () => {
 assert.equal(ready(undefined, verified, 'Reason'), false);
 assert.equal(ready('Failed', {}, 'Damage'), true);
 assert.equal(ready('Pass', {}, 'Damage'), false);
 assert.equal(ready('Pass', verified, ''), true);
 assert.equal(ready('Failed', verified, ''), false);
});
