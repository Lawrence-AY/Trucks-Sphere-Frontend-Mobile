const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function harness(platform = 'web', browser = true) {
  const nativeCalls = [];
  const nativeAlert = (...args) => nativeCalls.push(args);
  const native = { Alert: { alert: nativeAlert }, Platform: { OS: platform }, StyleSheet: { create: (s) => s } };
  const cache = {};
  function load(relative) {
    const filename = path.resolve(__dirname, relative);
    if (cache[filename]) return cache[filename].exports;
    const module = { exports: {} }; cache[filename] = module;
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, ...(browser ? { window: {} } : {}), require: (name) => {
      if (name === 'react-native') return native;
      if (name === 'react') return React;
      if (name === 'react-native-paper') return { Card: 'PaperCard' };
      if (name.endsWith('/useTheme')) return { useTheme: () => ({ border: '#ccc' }) };
      if (name.endsWith('/constants/theme')) return { Spacing: { md: 12, sm: 8 } };
      return load(path.relative(__dirname, path.resolve(path.dirname(filename), name + '.ts')));
    } });
    return module.exports;
  }
  const helpers = load('../utils/webAlert.ts');
  return { helpers, queue: load('../utils/webAlertQueue.ts'), native, nativeAlert, nativeCalls, load };
}

test('all native Alert.alert calls use the web queue with every button preserved', () => {
  const h = harness(); const called = [];
  h.native.Alert.alert('Choose', 'A message', [
    { text: 'Camera', onPress: () => called.push('camera') },
    { text: 'Upload', onPress: () => called.push('upload') },
    { text: 'Delete', style: 'destructive', onPress: () => called.push('delete') },
    { text: 'Cancel', style: 'cancel' },
  ]);
  const current = h.queue.getWebAlert();
  assert.equal(current.buttons.length, 4);
  assert.equal(current.buttons[2].style, 'destructive');
  assert.deepEqual(called, []);
  h.queue.selectWebAlertButton(current.id, 1);
  h.queue.selectWebAlertButton(current.id, 1);
  assert.deepEqual(called, ['upload']);
  assert.equal(h.queue.getWebAlert(), null);
});

test('queued alerts survive before the host subscribes and preserve callback-created alerts', () => {
  const h = harness();
  h.native.Alert.alert('First', '', [{ text: 'OK', onPress: () => h.native.Alert.alert('Third') }]);
  h.native.Alert.alert('Second');
  let updates = 0; const unsubscribe = h.queue.subscribeWebAlerts(() => updates++);
  h.queue.selectWebAlertButton(h.queue.getWebAlert().id, 0);
  assert.equal(h.queue.getWebAlert().title, 'Second');
  h.queue.selectWebAlertButton(h.queue.getWebAlert().id, 0);
  assert.equal(h.queue.getWebAlert().title, 'Third');
  assert.equal(updates, 3); unsubscribe();
});

test('success callbacks and promises wait for acknowledgement', async () => {
  const h = harness(); let navigated = false; let settled = false;
  const promise = h.helpers.showAlertWithCallback('Saved', 'Material saved', () => { navigated = true; }).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(navigated, false); assert.equal(settled, false);
  h.queue.dismissWebAlert(h.queue.getWebAlert().id);
  assert.equal(navigated, false);
  h.queue.selectWebAlertButton(h.queue.getWebAlert().id, 0);
  await promise; assert.equal(navigated, true); assert.equal(settled, true);
});

test('confirmation never approves on Escape or backdrop dismissal', async () => {
  const h = harness();
  const cancelled = h.helpers.showConfirm('Delete?', 'This removes the record.');
  h.queue.dismissWebAlert(h.queue.getWebAlert().id, true);
  assert.equal(await cancelled, false);
  const dismissed = h.helpers.showConfirm('Delete?', 'This removes the record.');
  h.queue.dismissWebAlert(h.queue.getWebAlert().id);
  assert.equal(await dismissed, false);
  const accepted = h.helpers.showConfirm('Delete?', 'This removes the record.');
  h.queue.selectWebAlertButton(h.queue.getWebAlert().id, 1);
  assert.equal(await accepted, true);
});

test('noncancelable dialogs retain their action and synced confirmations appear once', async () => {
  const h = harness(); let syncCount = 0;
  h.helpers.setAlertSyncHandler(() => syncCount++);
  h.native.Alert.alert('Required');
  const id = h.queue.getWebAlert().id;
  h.queue.dismissWebAlert(id, true);
  assert.equal(h.queue.getWebAlert().id, id);
  h.queue.selectWebAlertButton(id, 0);
  const result = h.helpers.showSyncedConfirm('Continue?', 'Review first');
  h.queue.selectWebAlertButton(h.queue.getWebAlert().id, 1);
  assert.equal(await result, true); assert.equal(syncCount, 1); assert.equal(h.queue.getWebAlert(), null);
});

test('native alerts keep the native implementation and server rendering has no browser dependency', () => {
  const h = harness('android', false);
  h.helpers.showSyncedAlert('Saved', 'Done');
  assert.equal(h.native.Alert.alert, h.nativeAlert);
  assert.equal(h.nativeCalls.length, 1);
  const server = harness('web', false);
  server.native.Alert.alert('Server');
  assert.equal(server.queue.getWebAlert(), null);
});

test('all shared card variants flatten conditional and nested fragments before Paper injects props', () => {
  const h = harness();
  const { Card } = h.load('../components/ui/Card.tsx');
  for (const variant of ['default', 'elevated', 'outlined']) {
    const children = [React.createElement('Input', { key: 'name', label: 'Name' }), false,
      React.createElement(React.Fragment, { key: 'fields' }, React.createElement('Select', { label: 'Category' }),
        React.createElement(React.Fragment, null, React.createElement('Input', { label: 'Description' })))];
    const rendered = Card({ variant, children });
    assert.deepEqual(React.Children.toArray(rendered.props.children).map((child) => child.props.label), ['Name', 'Category', 'Description']);
    assert.ok(React.Children.toArray(rendered.props.children).every((child) => child.type !== React.Fragment));
    const keys = React.Children.toArray(rendered.props.children).map((child) => child.key);
    assert.equal(new Set(keys).size, keys.length);
  }
});
