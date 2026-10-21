/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React, { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

const browserUint8Array = global.Uint8Array;
global.Uint8Array = Object.getPrototypeOf(Buffer.from('')).constructor;
const { transformSync } = require('esbuild');
global.Uint8Array = browserUint8Array;

const frontend = path.resolve(__dirname, '../../..');
const uiStore = { isConnected: true };
const edits = { pointerdown: jest.fn(), click: jest.fn(), keydown: jest.fn(), keyup: jest.fn() };

// react-select menus and parameter dialogs use portals outside the form's DOM
// subtree. They remain in the form's React event tree, where the guard must run.
function PortalEditor({ name }) {
  return createPortal(React.createElement('button', {
    type: 'button',
    'data-editor-portal': name,
    onPointerDown: edits.pointerdown,
    onClick: edits.click,
    onKeyDown: edits.keydown,
    onKeyUp: edits.keyup,
  }, `Edit ${name}`), document.body);
}

const dependencies = {
  'mobx-react-lite': { observer: (component) => component },
  'react-i18next': { useTranslation: () => ({ i18n: { language: 'en' }, t: (key, options) => options?.defaultValue || key }) },
  '@/stores/ui': { uiStore },
  '@/stores/device-manager': { ReadRegistersState: { Unsupported: 'unsupported', Disabled: 'disabled', Error: 'error' } },
  '@/components/alert': { Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children) },
  '@/components/button': { Button: ({ label, disabled, onClick }) => React.createElement('button', { disabled, onClick }, label) },
  '@/components/confirm': { Confirm: () => null },
  '@/components/loader': { Loader: () => null },
  '@/components/json-schema-editor/optional-params-select-dialog': {
    OptionalParamsSelectDialog: ({ isOpened }) => isOpened ? React.createElement(PortalEditor, { name: 'parameter-dialog' }) : null,
  },
  '@/pages/settings/device-manager/components/device-settings-editor': {
    DeviceSettingsEditor: () => React.createElement(PortalEditor, { name: 'native-editor' }),
  },
};
const result = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(frontend, 'src/pages/devices/device-settings.tsx'), 'utf8'), {
  loader: 'tsx', format: 'cjs', target: 'es2022', jsx: 'automatic',
}).code, {
  module: result,
  exports: result.exports,
  require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name.endsWith('.css') ? {} : require(name),
  console,
});
const { default: DeviceSettings } = result.exports;

let container;
let root;
let installer;
const render = () => act(() => root.render(React.createElement(DeviceSettings, { installer, deviceId: 'lighting-east' })));
const target = (name) => document.querySelector(`[data-editor-portal="${name}"]`);
const dispatch = (button, type, key = 'Enter') => {
  const event = type.startsWith('key')
    ? new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true })
    : new Event(type, { bubbles: true, cancelable: true });
  act(() => button.dispatchEvent(event));
  return event;
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  uiStore.isConnected = true;
  Object.values(edits).forEach((spy) => spy.mockClear());
  const match = {
    enabled: true, typeName: 'WB-MDM3', address: '30', portPath: '/dev/ttyRS485-1',
    tab: {
      schemaStore: { schemaTranslator: {}, commonParams: {} },
      isLoading: false, error: '', devicesWithTheSameId: [],
      readRegistersState: { state: 'unsupported', allowEditSettings: true },
    },
  };
  installer = {
    loaded: true, loading: false, error: '', isSaving: false, isDirty: false, allowSave: true,
    editor: { tabs: { hasInvalidConfig: false } },
    getDeviceMatches: () => [match], getDeviceMatch: () => match,
    openDevice: jest.fn(), reload: jest.fn(), save: jest.fn(), readRegisters: jest.fn(),
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  render();
  const parameters = [...container.querySelectorAll('button')].find((button) => button.textContent === 'device-manager.buttons.parameters');
  act(() => parameters.click());
  expect(target('parameter-dialog')).not.toBeNull();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('unlocked native editor and parameter dialog portal controls receive pointer and keyboard edits', () => {
  for (const name of ['native-editor', 'parameter-dialog']) {
    const button = target(name);
    expect(button.closest('fieldset')).toBeNull();
    for (const type of Object.keys(edits)) expect(dispatch(button, type).defaultPrevented).toBe(false);
  }
  for (const spy of Object.values(edits)) expect(spy).toHaveBeenCalledTimes(2);
});

test.each(['saving', 'offline'])('%s settings block portal pointer and keyboard edits and recover when unlocked', (mode) => {
  if (mode === 'saving') installer.isSaving = true;
  else uiStore.isConnected = false;
  render();
  for (const name of ['native-editor', 'parameter-dialog']) {
    const button = target(name);
    expect(button.disabled).toBe(false);
    expect(button.closest('fieldset')).toBeNull();
    for (const type of Object.keys(edits)) expect(dispatch(button, type).defaultPrevented).toBe(true);
    // Preserve native focus traversal while preventing react-select's Tab key
    // handler from committing a highlighted option during the locked state.
    for (const type of ['keydown', 'keyup']) expect(dispatch(button, type, 'Tab').defaultPrevented).toBe(false);
  }
  for (const spy of Object.values(edits)) expect(spy).not.toHaveBeenCalled();
  expect(installer.save).not.toHaveBeenCalled();
  expect(installer.readRegisters).not.toHaveBeenCalled();
  installer.isSaving = false;
  uiStore.isConnected = true;
  render();
  for (const type of Object.keys(edits)) expect(dispatch(target('native-editor'), type).defaultPrevented).toBe(false);
  for (const spy of Object.values(edits)) expect(spy).toHaveBeenCalledTimes(1);
});
