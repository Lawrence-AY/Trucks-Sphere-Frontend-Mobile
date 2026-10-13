const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadHeader(platform) {
  const effects = [];
  const calls = [];
  let wentBack = false;
  const navigation = { setOptions: value => calls.push(value), canGoBack: () => true, goBack: () => { wentBack = true; } };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../hooks/useScreenSearchHeader.tsx'), 'utf8');
  const mocks = {
    react: { useLayoutEffect: effect => effects.push(effect) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: platform } },
    'expo-router': { useNavigation: () => navigation },
    '../components/ManagementSearchHeader': { ScreenSearchHeader: 'SearchHeader' },
    '../components/ui/BackButton': { BackButton: 'BackButton' },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports: module.exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; } });
  return { hook: module.exports.useScreenSearchHeader, effects, calls, wentBack: () => wentBack };
}

test('native search header retains menu actions, search updates and stack back navigation', () => {
  const state = loadHeader('ios');
  let search;
  assert.equal(state.hook({ title: 'Receive', search: '', onChangeSearch: value => { search = value; } }), null);
  state.effects[0]();
  assert.equal(state.calls[0].headerShown, true);
  const menu = { action: 'quarry issues and menu' };
  const header = state.calls[0].header({ options: { headerTintColor: '#123456', headerRight: props => { assert.equal(props.tintColor, '#123456'); return menu; } }, back: { title: 'Previous' } });
  assert.equal(header.props.right, menu);
  header.props.onChangeSearch('KAA');
  assert.equal(search, 'KAA');
  header.props.left.props.onPress();
  assert.equal(state.wentBack(), true);
  const cleanup = state.effects[1]();
  cleanup();
  assert.equal(state.calls.at(-1).header, undefined);
});

test('web renders a single inline search header and hides the navigator header', () => {
  const state = loadHeader('web');
  const header = state.hook({ title: 'Materials', search: 'sand', onChangeSearch() {} });
  assert.equal(header.type, 'SearchHeader');
  assert.equal(header.props.search, 'sand');
  state.effects[0]();
  assert.equal(state.calls[0].headerShown, false);
});

test('quarry editing shows the title while retaining header actions', () => {
  const state = loadHeader('android');
  state.hook({ title: 'Weigh Out', search: '', onChangeSearch() {}, hideSearch: true });
  state.effects[0]();
  const header = state.calls[0].header({ options: { headerRight: () => 'menu' } });
  assert.equal(header.props.hideSearch, true);
  assert.equal(header.props.right, 'menu');
});
