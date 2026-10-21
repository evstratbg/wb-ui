/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// esbuild checks Node's Buffer against its own realm's Uint8Array at load time.
const browserUint8Array = global.Uint8Array;
global.Uint8Array = Object.getPrototypeOf(Buffer.from('')).constructor;
const { transformSync } = require('esbuild');
global.Uint8Array = browserUint8Array;

const frontend = path.resolve(__dirname, '../../..');
const fetchMock = jest.fn();

function loadSource(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(frontend, relativePath), 'utf8');
  const code = transformSync(source, { loader: relativePath.endsWith('.tsx') ? 'tsx' : 'ts', format: 'cjs', target: 'es2022', jsx: 'automatic' }).code;
  const result = { exports: {} };
  vm.runInNewContext(code, {
    module: result,
    exports: result.exports,
    require: (name) => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (/\.css$/.test(name)) return {};
      return require(name);
    },
    console,
    Date,
    fetch: (...args) => fetchMock(...args),
    AbortController,
    setTimeout,
    clearTimeout,
  }, { filename: relativePath });
  return result.exports;
}

const historyUrl = loadSource('src/stores/history/history-url.ts');
let language = 'ru';
const historySource = loadSource('src/pages/devices/device-history.tsx', {
  'mobx-react-lite': { observer: (component) => component },
  'react-i18next': { useTranslation: () => ({ i18n: { language } }) },
  '@/stores/history/history-url': historyUrl,
  '@/components/dropdown': {
    Dropdown: ({ options, value, onChange, ariaLabel }) => React.createElement('select', {
      value,
      'aria-label': ariaLabel,
      onChange: (event) => onChange({ value: event.target.value }),
    }, options.map((option) => React.createElement('option', { key: option.value, value: option.value }, option.label))),
  },
  '@/pages/overview/overview-history': {
    __esModule: true,
    default: function Chart({ cell, locale, historyProxy, clockOffset }) {
      const [period, setPeriod] = React.useState(86400);
      return React.createElement('button', { 'data-cell': cell.id, 'data-locale': locale, 'data-proxy': historyProxy.id, 'data-clock-offset': clockOffset, onClick: () => setPeriod(3600) }, String(period));
    },
  },
});
const { default: DeviceHistory, getDeviceHistoryChannels, getDefaultHistoryCell, isHistoryPlotCell } = historySource;
const cell = (deviceId, controlId, extra = {}) => ({ id: `${deviceId}/${controlId}`, deviceId, controlId, name: controlId, hidden: false, isComplete: true, valueType: 'number', type: 'value', units: '', readOnly: true, ...extra });

test('history channel choices stay inside the selected device and exclude unavailable controls', () => {
  const cells = [cell('a', 'value'), cell('a', 'text', { valueType: 'string' }), cell('a', 'switch', { valueType: 'boolean' }), cell('a', 'hidden', { hidden: true }), cell('a', 'pending', { isComplete: false }), cell('a', 'button', { valueType: 'pushbutton' }), cell('b', 'other')];
  expect(getDeviceHistoryChannels('a', cells).map((item) => item.controlId)).toEqual(['value', 'text', 'switch']);
  expect(isHistoryPlotCell(cells[1])).toBe(false);
  expect(isHistoryPlotCell(cells[2])).toBe(true);
});

test('history starts with useful output/measurement metadata instead of the first serial identifier', () => {
  const serial = cell('a', 'Serial');
  const voltage = cell('a', 'Voltage', { units: 'V' });
  const output = cell('a', 'Output', { type: 'range', readOnly: false });
  expect(getDefaultHistoryCell([serial, voltage, output])).toBe(output);
  expect(getDefaultHistoryCell([serial, voltage])).toBe(voltage);
});

let container;
let root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  language = 'ru';
  fetchMock.mockReset().mockResolvedValue({ ok: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

const render = (props) => act(() => root.render(React.createElement(DeviceHistory, { historyProxy: { id: 'native' }, ...props })));
const linkedControls = () => historyUrl.decode(container.querySelector('a').getAttribute('href').split('/history/')[1]).c;
const select = (value) => act(() => {
  const element = container.querySelector('select');
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
});

test('changing a channel keeps its native history deep link and handles nonnumeric values without drawing a fake chart', () => {
  const output = cell('a', 'Output', { type: 'range', readOnly: false });
  const text = cell('a', 'Версия 1%?#&', { valueType: 'string' });
  render({ deviceId: 'a', cells: [output, text] });
  expect(container.querySelector('[data-cell]').getAttribute('data-cell')).toBe('a/Output');
  expect(container.querySelector('[data-proxy]').getAttribute('data-proxy')).toBe('native');
  select(text.id);
  expect(container.querySelector('[data-cell]')).toBeNull();
  expect(container.textContent).toContain('нечисловые значения');
  expect(linkedControls()).toEqual([{ d: 'a', c: 'Версия 1%?#&' }]);
});

test('changing devices resets channel and chart period instead of carrying another device context', () => {
  const cells = [cell('a', 'First'), cell('a', 'Second'), cell('b', 'Only')];
  render({ deviceId: 'a', cells });
  select('a/Second');
  act(() => container.querySelector('[data-cell]').click());
  expect(container.querySelector('[data-cell]').textContent).toBe('3600');
  render({ deviceId: 'b', cells });
  expect(container.querySelector('[data-cell]').getAttribute('data-cell')).toBe('b/Only');
  expect(container.querySelector('[data-cell]').textContent).toBe('86400');
  expect(linkedControls()).toEqual([{ d: 'b', c: 'Only' }]);
  render({ deviceId: 'a', cells });
  expect(container.querySelector('[data-cell]').getAttribute('data-cell')).toBe('a/First');
});

test('URL selection chooses a local channel, updates the route and rejects foreign or invalid channel ids', () => {
  const cells = [cell('a', 'First'), cell('a', 'Second'), cell('b', 'Foreign')];
  const onChannelChange = jest.fn();
  render({ deviceId: 'a', cells, channelId: 'a/Second', onChannelChange });
  expect(container.querySelector('[data-cell]').getAttribute('data-cell')).toBe('a/Second');
  select('a/First');
  expect(onChannelChange).toHaveBeenCalledWith('a/First');
  for (const channelId of ['b/Foreign', 'missing', undefined]) {
    render({ deviceId: 'a', cells, channelId, onChannelChange });
    expect(container.querySelector('[data-cell]').getAttribute('data-cell')).toBe('a/First');
    expect(linkedControls()).toEqual([{ d: 'a', c: 'First' }]);
  }
});

test('empty device and English copy use native language without exposing controls for another device', () => {
  language = 'en';
  render({ deviceId: 'missing', cells: [cell('other', 'Output')] });
  expect(container.textContent).toContain('no data channels');
  expect(container.querySelector('select')).toBeNull();
  expect(container.querySelector('a')).toBeNull();
  render({ deviceId: 'other', cells: [cell('other', 'Output')] });
  expect(container.querySelector('select').getAttribute('aria-label')).toBe('Device channel for history');
  expect(container.querySelector('[data-locale]').getAttribute('data-locale')).toBe('en-US');
  expect(container.textContent).not.toMatch(/[А-Яа-яЁё]/);
});

test('device history corrects laptop clock from the controller Date header and request midpoint', async () => {
  const controllerDate = Date.parse('Wed, 21 Oct 2026 09:00:00 GMT');
  const laptopStart = controllerDate + 900000;
  const laptopEnd = laptopStart + 200;
  jest.spyOn(Date, 'now').mockReturnValueOnce(laptopStart).mockReturnValue(laptopEnd);
  fetchMock.mockResolvedValue({ ok: true, headers: { get: (name) => name === 'date' ? new Date(controllerDate).toUTCString() : null } });
  await act(async () => render({ deviceId: 'a', cells: [cell('a', 'Output')] }));
  expect(fetchMock).toHaveBeenCalledWith('/device/info', expect.objectContaining({ credentials: 'same-origin', signal: expect.any(AbortSignal) }));
  expect(Number(container.querySelector('[data-clock-offset]').getAttribute('data-clock-offset'))).toBe(controllerDate + 500 - (laptopStart + laptopEnd) / 2);
});
