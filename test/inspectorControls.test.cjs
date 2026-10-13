const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/inspector/index.tsx'), 'utf8');
const ast = ts.createSourceFile('inspector.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
 let found;
 function visit(node) { if (predicate(node)) found = node; ts.forEachChild(node, visit); }
 visit(ast);
 assert.ok(found);
 return found;
}
function run(code, context) {
 return vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
}
test('Pass requires checked metrics while Fail allows unchecked metrics and is separately validated for its reason', () => {
 const node = find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'incompleteQuality');
 const lines = [{ materialId: 'sand' }];
 function invalid(result, answers) { return Boolean(run(node.initializer.getText(ast), { lines, materialChecks: { sand: { result } }, qualityChecks: { sand: answers }, GENERAL_QUALITY_METRICS: ['a', 'b'] })); }
 assert.equal(invalid('Pass', { a: true, b: true }), false);
 assert.equal(invalid('Failed', { a: false, b: true }), false);
 assert.equal(invalid('Failed', { a: false }), false);
 assert.equal(invalid('Pass', { a: false, b: true }), true);
 assert.equal(invalid('', { a: true, b: true }), true);
});
test('delivery refreshes preserve inspection drafts and changing jobs initializes a new form', () => {
 const node = find(node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('initializedInspection.current === active.id'));
 let resets = 0;
 const context = { active: { id: 'one' }, initializedInspection: { current: null }, activeMaterialLines: [{ materialId: 'sand' }], form: {}, setPhotos() {}, setQualityChecks() {}, setReceivedQuantities() {}, setDamagedQuantities() {}, setMaterialChecks() { resets++; } };
 const effect = run('(' + node.arguments[0].getText(ast) + ')', context);
 effect(); assert.equal(resets, 1);
 context.active = { id: 'one', updatedAt: 'new' };
 effect(); assert.equal(resets, 1);
 context.active = { id: 'two' };
 effect(); assert.equal(resets, 2);
});

test('actual Pass and Fail controls invoke selection and render the new checked state', () => {
 const componentSource = fs.readFileSync(require('node:path').join(__dirname, '../components/InspectionChoice.tsx'), 'utf8');
 const module = { exports: {} };
 const palette = { success: 'green', danger: 'red', border: 'gray', surface: 'white', text: 'black', onPrimary: 'white' };
 vm.runInNewContext(ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: module.exports,
  require: name => name === 'react-native' ? { Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: value => value } } : name === '../hooks/useTheme' ? { useTheme: () => palette } : require(name),
 });
 let value = '';
 const render = () => module.exports.InspectionChoice({ value, label: 'Overall inspection', onChange: next => { value = next; } });
 let buttons = render().props.children;
 assert.equal(buttons[0].props.accessibilityState.checked, false);
 buttons[0].props.onPress();
 buttons = render().props.children;
 assert.equal(value, 'Pass');
 assert.equal(buttons[0].props.accessibilityState.checked, true);
 assert.equal(buttons[0].props.style({ pressed: false })[1].backgroundColor, 'green');
 buttons[1].props.onPress();
 buttons = render().props.children;
 assert.equal(value, 'Failed');
 assert.equal(buttons[0].props.accessibilityState.checked, false);
 assert.equal(buttons[1].props.accessibilityState.checked, true);
 assert.equal(buttons[1].props.style({ pressed: false })[1].backgroundColor, 'red');
 buttons[0].props.onPress();
 assert.equal(value, 'Pass');
});
