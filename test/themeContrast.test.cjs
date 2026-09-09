const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
 return module.exports;
}
const { Colors } = load('../constants/theme.ts');
const { contrastRatio, readableTextColor } = load('../utils/contrast.ts');
test('dark-mode text and form values remain readable on every standard surface', () => {
 for (const ink of ['text', 'textSecondary', 'textMuted', 'textTertiary', 'primaryText']) {
  for (const surface of ['background', 'surface', 'inputBg', 'primaryLight', 'receiptBg']) {
   assert.ok(contrastRatio(Colors.dark[ink], Colors.dark[surface]) >= 4.5, ink + ' on ' + surface);
  }
 }
});
test('filled action labels contrast with their background in both themes', () => {
 for (const theme of Object.values(Colors)) {
  for (const [bg, ink] of [['accent','onAccent'],['success','onSuccess'],['warning','onWarning'],['danger','onDanger']]) assert.ok(contrastRatio(theme[ink], theme[bg]) >= 4.5, bg);
  assert.ok(contrastRatio('#FFFFFF', theme.primary) >= 4.5, 'primary');
 }
});
test('category labels stay readable on dark, light and selected category backgrounds', () => {
 assert.equal(readableTextColor('#FFFFFF', '#000000'), '#FFFFFF');
 for (const color of ['#0F766E', '#2563EB', '#F59E0B', '#10B981']) {
  for (const bg of [Colors.dark.surface, Colors.light.surface, color]) assert.ok(contrastRatio(readableTextColor(color, bg), bg) >= 4.5);
 }
});
