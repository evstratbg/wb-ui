/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React, { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
const uint8 = global.Uint8Array;
global.Uint8Array = Object.getPrototypeOf(Buffer.from('')).constructor;
const { transformSync } = require('esbuild');
global.Uint8Array = uint8;
const frontend = path.resolve(__dirname, '../../..');
const ui = { isConnected: true, workspaceMode: 'home' };
const writes = jest.fn();
const Button = ({ label, onClick, disabled, 'aria-pressed': pressed }) => (
  <button disabled={disabled} aria-pressed={pressed} onClick={onClick}>
    {label}
  </button>
);
const Input = ({ value, onChange, ariaLabel, isDisabled }) => (
  <input
    aria-label={ariaLabel}
    value={value}
    disabled={isDisabled}
    onChange={(event) => onChange(event.target.value)}
  />
);
const deps = {
  'mobx-react-lite': { observer: (component) => component },
  'react-i18next': { useTranslation: () => ({ i18n: { language: 'en' }, t: (key) => key }) },
  '@/stores/auth': {
    authStore: { hasRights: () => true },
    UserRole: { User: 'user', Operator: 'operator' },
  },
  '@/stores/ui': { uiStore: ui },
  '@/components/button': { Button },
  '@/components/input': { Input },
  '@/components/alert': { Alert: ({ children }) => <div role="alert">{children}</div> },
  '@/components/dialog': { Dialog: ({ children }) => <div role="dialog">{children}</div> },
  '@/layouts/page': { PageLayout: ({ children }) => <main>{children}</main> },
  '@/components/cell': {
    Cell: ({ name }) => (
      <div>
        {name}
        {createPortal(
          <button data-command onClick={writes}>
            Command
          </button>,
          document.body
        )}
      </div>
    ),
  },
};
function load(file, extra = {}) {
  const result = { exports: {} };
  vm.runInNewContext(
    transformSync(fs.readFileSync(path.join(frontend, file), 'utf8'), {
      loader: file.endsWith('tsx') ? 'tsx' : 'ts',
      format: 'cjs',
      jsx: 'automatic',
      target: 'es2022',
    }).code,
    {
      module: result,
      exports: result.exports,
      require: (name) =>
        Object.hasOwn(extra, name)
          ? extra[name]
          : Object.hasOwn(deps, name)
            ? deps[name]
            : /\.(css|svg)$/.test(name)
              ? () => null
              : require(name),
      localStorage,
      console,
      setTimeout,
      clearTimeout,
      AbortController,
      Intl,
      fetch: async () => ({ ok: true, headers: { get: () => new Date().toUTCString() } }),
    }
  );
  return result.exports;
}
let container, root;
const render = (element) => act(() => root.render(element));
const click = (label) => {
  const target = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === label
  );
  expect(target).toBeTruthy();
  act(() => target.click());
};
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  ui.isConnected = true;
  writes.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const homeFixture = () => {
  const cell = { id: 'lamp/On', name: 'On', isComplete: true, readOnly: false, hidden: false };
  const devicesStore = { cells: new Map([[cell.id, cell]]) };
  const dashboardsStore = {
    isLoading: false,
    dashboardsList: [
      { id: 'living', name: 'Living room', widgets: ['lights'] },
      { id: 'hidden', name: 'Hidden', options: { isHidden: true }, widgets: ['secret'] },
    ],
    widgets: new Map([
      ['lights', { cells: [{ id: cell.id, name: 'Reading lamp', extra: { invert: true } }] }],
      ['secret', { cells: [{ id: 'private/secret' }] }],
    ]),
  };
  const { default: Home, homeControls } = load('src/pages/home/home.tsx');
  return { Home, homeControls, devicesStore, dashboardsStore };
};
test('home uses configured panel labels and hides hidden panel channels', () => {
  const { homeControls, devicesStore, dashboardsStore } = homeFixture();
  const controls = homeControls(dashboardsStore, devicesStore);
  expect(controls).toHaveLength(1);
  expect(controls[0].label).toBe('Reading lamp');
  expect(controls[0].extra.invert).toBe(true);
});
test('home offline guard blocks commands through portals and recovers after reconnect', () => {
  const { Home, devicesStore, dashboardsStore } = homeFixture();
  ui.isConnected = false;
  render(<Home devicesStore={devicesStore} dashboardsStore={dashboardsStore} />);
  act(() => document.querySelector('[data-command]').click());
  expect(writes).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Readings may be stale');
  ui.isConnected = true;
  render(<Home devicesStore={devicesStore} dashboardsStore={dashboardsStore} />);
  act(() => document.querySelector('[data-command]').click());
  expect(writes).toHaveBeenCalledTimes(1);
});
test('personalizing and cancelling favorites writes no command or server configuration', () => {
  const { Home, devicesStore, dashboardsStore } = homeFixture();
  render(<Home devicesStore={devicesStore} dashboardsStore={dashboardsStore} />);
  click('Customize favorites');
  click('Remove');
  click('Cancel');
  expect(localStorage.getItem('wb-ui-home-favorites')).toBeNull();
  expect(container.textContent).toContain('Reading lamp');
  click('Customize favorites');
  click('Remove');
  click('Save favorites');
  expect(JSON.parse(localStorage.getItem('wb-ui-home-favorites'))).toEqual([]);
  expect(writes).not.toHaveBeenCalled();
});
test('home language apply only changes browser language without invoking panel configuration setters', () => {
  const setters = {
    setDescription: jest.fn(),
    setDefaultDashboardId: jest.fn(),
    setIsShowWidgetsPage: jest.fn(),
    dashboardsList: [],
  };
  const onChangeLanguage = jest.fn();
  const { default: Settings } = load('src/pages/settings/web-ui/components/common-settings.tsx', {
    '@/components/form': {
      FormFieldGroup: ({ children }) => <div>{children}</div>,
      FormButtonGroup: ({ children }) => <div>{children}</div>,
      OptionsField: ({ options, value, onChange }) => (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ),
    },
  });
  render(<Settings onChangeLanguage={onChangeLanguage} dashboardsStore={setters} />);
  act(() => {
    const select = container.querySelector('select');
    select.value = 'ru';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  click('common.buttons.apply');
  expect(onChangeLanguage).toHaveBeenCalledWith('ru');
  expect(localStorage.getItem('language')).toBe('ru');
  for (const key of ['setDescription', 'setDefaultDashboardId', 'setIsShowWidgetsPage'])
    expect(setters[key]).not.toHaveBeenCalled();
});
test('channel polling requires review before saving and locks offline edits', async () => {
  const channel = {
    mode: {
      value: 'in queue order',
      enumOptions: [{ value: 'in queue order' }],
      setValue: jest.fn(),
    },
    isEnabledByCondition: true,
    isSupportedByFirmware: true,
  };
  const installer = {
    openDevice: jest.fn(async () => {}),
    getPollingChannel: () => channel,
    getDeviceMatch: () => ({ enabled: true }),
    allowSave: true,
    pendingChanges: [{ path: '$.devices[0].channels[0]' }],
    save: jest.fn(),
  };
  const { ChannelPolling } = load('src/pages/devices/channel-polling.tsx', {
    '@/components/configuration-changes/configuration-changes': {
      ConfigurationChanges: ({ changes }) => <div>{changes.map((item) => item.path).join()}</div>,
    },
  });
  await act(async () =>
    root.render(<ChannelPolling installer={installer} deviceId="lamp" controlId="On" />)
  );
  expect(installer.save).not.toHaveBeenCalled();
  click('Review changes');
  expect(container.textContent).toContain('$.devices[0].channels[0]');
  click('Save entire configuration');
  expect(installer.save).toHaveBeenCalledTimes(1);
  ui.isConnected = false;
  render(<ChannelPolling installer={installer} deviceId="lamp" controlId="On" />);
  expect(container.querySelector('fieldset').disabled).toBe(true);
});
test('panel preview shows live values with no command elements or implicit saves', async () => {
  const panel = { id: 'a', name: 'Room', widgets: ['w'] };
  const draft = {
    panel,
    loading: false,
    config: { widgets: [{ id: 'w', name: 'Light', cells: [{ id: 'lamp/On' }] }] },
    widget: () => ({ name: 'Light', cells: [{ id: 'lamp/On' }] }),
    load: jest.fn(async () => {}),
    isDirty: false,
    associatedPanels: () => [],
    save: jest.fn(),
  };
  const { PanelBuilder } = load('src/pages/dashboards/builder/panel-builder.tsx', {
    './panel-draft-store': {
      __esModule: true,
      default: class {
        constructor() {
          return draft;
        }
      },
    },
    '@/components/confirm': { Confirm: () => null },
    '@/components/dropdown': { Dropdown: () => null },
    '@/components/tabs': {
      Tabs: ({ items, onTabChange }) => (
        <div>
          {items.map((item) => (
            <button key={item.id} onClick={() => onTabChange(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      ),
    },
    '../[slug]/components/widget-edit': { WidgetEdit: () => null },
    '@/components/configuration-changes/configuration-changes': {
      ConfigurationChanges: () => null,
    },
  });
  await act(async () =>
    root.render(
      <PanelBuilder
        devicesStore={{ cells: new Map([['lamp/On', { isComplete: true, value: 0 }]]) }}
      />
    )
  );
  click('Preview');
  expect(container.textContent).toContain('Read-only preview');
  expect(container.textContent).toContain('0');
  expect(document.querySelector('[data-command]')).toBeNull();
  expect(draft.save).not.toHaveBeenCalled();
});
test('rule journal is explicit, file matches are bounded, and late results from the previous file are ignored', async () => {
  const { RuleDiagnostics, ruleLogMatches } = load('src/pages/rules/[rule]/rule-diagnostics.tsx');
  expect(ruleLogMatches('[main.js:2] message', 'main.js')).toBe(true);
  expect(ruleLogMatches('othermain.js:2 message', 'main.js')).toBe(false);
  expect(ruleLogMatches('mainXjs:2 message', 'main.js')).toBe(false);
  let resolve;
  const logsProxy = {
    Load: jest.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    ),
  };
  const rulesStore = { rule: { initName: 'main.js' }, savedContent: '', logs: [], isDirty: false };
  render(<RuleDiagnostics rulesStore={rulesStore} logsProxy={logsProxy} />);
  expect(logsProxy.Load).not.toHaveBeenCalled();
  click('Load latest 20 entries');
  expect(logsProxy.Load).toHaveBeenCalledWith({
    service: 'wb-rules.service',
    limit: 20,
    pattern: 'main.js',
    regex: false,
    'case-sensitive': true,
  });
  rulesStore.rule = { initName: 'next.js' };
  render(<RuleDiagnostics rulesStore={rulesStore} logsProxy={logsProxy} />);
  await act(async () => resolve([{ msg: 'Old sensitive entry' }]));
  expect(container.textContent).not.toContain('Old sensitive entry');
  expect(container.textContent).not.toContain('Entries received');
});
test('diagnostic excerpt remains submitted B and line navigation requires the same editor text', () => {
  const { RuleDiagnostics } = load('src/pages/rules/[rule]/rule-diagnostics.tsx');
  const onLine = jest.fn();
  const rulesStore = {
    rule: {
      initName: 'main.js',
      content: 'B submitted source',
      error: { message: 'B error', traceback: [{ line: 1 }] },
    },
    errorSource: { content: 'B submitted source', origin: 'submitted' },
    savedContent: 'A baseline',
    logs: [],
    isDirty: true,
  };
  render(<RuleDiagnostics rulesStore={rulesStore} onLine={onLine} />);
  expect(container.textContent).toContain('Successful persistence is not confirmed');
  expect(container.textContent).toContain('B submitted source');
  expect(container.textContent).not.toContain('A baseline');
  click('Go to line 1');
  expect(onLine).toHaveBeenCalledWith(1);
  rulesStore.rule.content = 'C draft';
  render(<RuleDiagnostics rulesStore={rulesStore} onLine={onLine} />);
  expect(
    [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Go to line 1'
    ).disabled
  ).toBe(true);
  expect(container.textContent).toContain('B submitted source');
  expect(container.textContent).not.toContain('C draft');
});
test('history exposes URL interval and derives presets from dates, clearing it for custom and historical ranges', async () => {
  const end = new Date();
  let range = { s: new Date(end.getTime() - 3600000), e: end };
  let id = 'quick';
  const store = {
    selectedControls: [],
    selectedStartDate: range.s,
    selectedEndDate: range.e,
    controls: [],
    dataPointsMultiple: [],
    charts: [],
    chartConfig: [],
    errors: [],
    readDatesFromUrl: () => {},
    buildControls: () => {},
    stopLoadingData: () => {},
    setChartContainerRef: () => {},
  };
  const { default: HistoryPage } = load('src/pages/history/history.tsx', {
    '@/components/chart': { Chart: () => null },
    '@/components/datetime-picker': { DateTimePicker: () => null },
    '@/components/dropdown': { Dropdown: () => null },
    '@/components/table': { Table: () => null, TableCell: () => null, TableRow: () => null },
    '@/stores/history': {
      HistoryStore: class {
        constructor() {
          return store;
        }
      },
    },
    '@/stores/history/history-url': { decode: () => range },
    '@/stores/history/csv': { historyCsv: () => '' },
    '@/utils/donwload-file': { downloadFile: () => {} },
    '@/utils/url': { useParseHash: () => ({ id, params: new URLSearchParams() }) },
    '@/utils/use-store': { useStore: () => store },
  });
  const view = <HistoryPage dashboardsStore={{ isLoading: false }} />;
  await act(async () => root.render(view));
  expect(container.textContent).toContain('Range:');
  expect(container.querySelector('[aria-pressed="true"]').textContent).toBe('1h');
  range = { s: new Date(end.getTime() - 1200000), e: end };
  id = 'zoom';
  render(<HistoryPage dashboardsStore={{ isLoading: false }} />);
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
  range = { s: new Date(end.getTime() - 7200000), e: new Date(end.getTime() - 3600000) };
  id = 'old';
  render(<HistoryPage dashboardsStore={{ isLoading: false }} />);
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
});
