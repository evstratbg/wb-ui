/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const browserUint8Array = global.Uint8Array;
global.Uint8Array = Object.getPrototypeOf(Buffer.from('')).constructor;
const { transformSync } = require('esbuild');
global.Uint8Array = browserUint8Array;

const frontend = path.resolve(__dirname, '../../..');
let role = 'admin';
let language = 'ru';
const uiStore = { isConnected: true };
const dependencies = {
  'mobx-react-lite': { observer: (component) => component },
  'react-i18next': { useTranslation: () => ({ i18n: { language } }) },
  '@/stores/ui': { uiStore },
  '@/stores/auth': {
    UserRole: { Admin: 'admin', Operator: 'operator' },
    authStore: { hasRights: (required) => ({ user: 0, operator: 1, admin: 2 })[role] >= ({ user: 0, operator: 1, admin: 2 })[required] },
  },
  '@/components/alert': { Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children) },
  '@/components/button': { Button: ({ label, disabled, onClick }) => React.createElement('button', { disabled, onClick }, label) },
};
const result = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(frontend, 'src/pages/devices/device-diagnostics.tsx'), 'utf8'), { loader: 'tsx', format: 'cjs', target: 'es2022', jsx: 'automatic' }).code, {
  module: result,
  exports: result.exports,
  require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name.endsWith('.css') ? {} : require(name),
  console,
});
const { default: DeviceDiagnostics, buildDriverLogParams } = result.exports;

let container;
let root;
let installer;
let logsProxy;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  role = 'admin';
  language = 'ru';
  uiStore.isConnected = true;
  const match = { portName: 'RS-485', portPath: '/dev/ttyRS485-1', address: 30, typeName: 'WB-MDM3', enabled: true, tab: { embeddedSoftware: { firmware: { current: '2.11', available: '2.12' }, bootloader: { current: '1.2' } }, devicesWithTheSameId: [] } };
  installer = { loaded: true, loading: false, error: '', getDeviceMatches: jest.fn(() => [match]), getDeviceMatch: jest.fn(() => match), openDevice: jest.fn(), readRegisters: jest.fn(), save: jest.fn() };
  logsProxy = { Load: jest.fn().mockResolvedValue([{ time: 1000, level: 3, msg: 'fixture message' }]) };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const render = (props = {}) => act(() => root.render(React.createElement(DeviceDiagnostics, { deviceId: 'dev[1].*', device: { error: '' }, cells: [], installer, logsProxy, ...props })));
const button = (text) => [...container.querySelectorAll('button')].find((item) => item.textContent === text);

test('diagnostics uses literal scoped journal queries with a bounded native limit', () => {
  expect(buildDriverLogParams('dev[1].*')).toEqual({ service: 'wb-mqtt-serial.service', limit: 20, pattern: 'dev[1].*', regex: false, 'case-sensitive': true });
  expect(buildDriverLogParams('dev[1].*', false)).toEqual({ service: 'wb-mqtt-serial.service', limit: 20 });
});

test('diagnostics renders real errors, exact connection and cached versions without reading hardware or journals automatically', () => {
  render({ device: { error: 'driver error' }, cells: [{ id: 'dev[1].*/Output', deviceId: 'dev[1].*', name: 'Output', controlId: 'Output', error: ['r', 'w', 'p'] }, { id: 'other/Fault', deviceId: 'other', error: ['r'] }] });
  expect(container.textContent).toContain('driver error');
  expect(container.textContent).toContain('Ошибка чтения');
  expect(container.textContent).toContain('Ошибка записи');
  expect(container.textContent).toContain('Период чтения больше заданного');
  expect(container.textContent).not.toContain('Fault');
  for (const value of ['/dev/ttyRS485-1', 'WB-MDM3', '2.11', '2.12', '1.2']) expect(container.textContent).toContain(value);
  expect(logsProxy.Load).not.toHaveBeenCalled();
  expect(installer.openDevice).not.toHaveBeenCalled();
  expect(installer.readRegisters).not.toHaveBeenCalled();
  expect(installer.save).not.toHaveBeenCalled();
});

test('journal loads only explicitly and labels unfiltered results as potentially unrelated devices', async () => {
  render();
  await act(async () => button('Загрузить журнал драйвера').click());
  expect(logsProxy.Load).toHaveBeenLastCalledWith(buildDriverLogParams('dev[1].*'));
  expect(container.textContent).toContain('fixture message');
  await act(async () => button('Последние записи без фильтра').click());
  expect(logsProxy.Load).toHaveBeenLastCalledWith(buildDriverLogParams('dev[1].*', false));
  expect(container.textContent).toContain('Они могут относиться к любым устройствам');
});

test('operator can read driver logs but cannot access installer configuration or firmware', async () => {
  role = 'operator';
  language = 'en';
  render();
  expect(installer.getDeviceMatch).not.toHaveBeenCalled();
  expect(installer.getDeviceMatches).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain('/dev/ttyRS485-1');
  expect(container.textContent).toContain('available to administrators');
  await act(async () => button('Load driver journal').click());
  expect(logsProxy.Load).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toMatch(/[А-Яа-яЁё]/);
});

test('ordinary user and disconnected interface cannot request journal data', () => {
  role = 'user';
  render();
  expect(container.querySelector('button')).toBeNull();
  role = 'operator';
  uiStore.isConnected = false;
  render();
  expect(button('Загрузить журнал драйвера').disabled).toBe(true);
  expect(logsProxy.Load).not.toHaveBeenCalled();
});

test('empty or failed journal response gives recovery and a new device discards stale pending results', async () => {
  logsProxy.Load.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('unavailable'));
  render();
  await act(async () => button('Загрузить журнал драйвера').click());
  expect(container.textContent).toContain('Записей не найдено');
  await act(async () => button('Загрузить журнал драйвера').click());
  expect(container.textContent).toContain('Не удалось загрузить журнал');
  let resolve;
  logsProxy.Load.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  act(() => button('Загрузить журнал драйвера').click());
  render({ deviceId: 'other' });
  await act(async () => resolve([{ msg: 'stale result' }]));
  expect(container.textContent).not.toContain('stale result');
});
