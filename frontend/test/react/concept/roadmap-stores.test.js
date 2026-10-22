import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { transformSync } from 'esbuild';
import cloneDeep from 'lodash/cloneDeep';
const frontend = path.resolve(__dirname, '../../..');
function load(file, deps = {}, globals = {}) {
  const result = { exports: {} };
  const code = transformSync(fs.readFileSync(path.join(frontend, file), 'utf8'), {
    loader: file.endsWith('.tsx') ? 'tsx' : file.endsWith('.ts') ? 'ts' : 'jsx',
    format: 'cjs',
    target: 'es2022',
    jsx: 'automatic',
  }).code;
  vm.runInNewContext(code, {
    module: result,
    exports: result.exports,
    require: (name) =>
      Object.hasOwn(deps, name)
        ? deps[name]
        : /\.(css|svg)$/.test(name)
          ? () => null
          : require(name),
    URLSearchParams,
    console,
    ...globals,
  });
  return result.exports;
}
const diff = load('src/utils/config-diff.ts');
const ids = load('src/utils/id.ts');
const { default: Draft } = load('src/pages/dashboards/builder/panel-draft-store.ts', {
  '@/common/paths': { uiConfigPath: '/etc/wb-webui.conf' },
  '@/utils/id': ids,
  '@/utils/config-diff': diff,
});
const baseline = () => ({
  dashboards: [
    { id: 'a', name: 'Room A', widgets: ['shared', 'solo'] },
    { id: 'b', name: 'Room B', widgets: ['shared'] },
  ],
  widgets: [
    {
      id: 'shared',
      name: 'Light',
      cells: [{ id: 'dev/Light', name: 'Lamp', extra: { invert: true } }],
      compact: false,
      description: 'Original',
    },
    { id: 'solo', name: 'Climate', cells: [{ id: 'dev/Temperature' }] },
  ],
  defaultDashboardId: 'a',
  description: 'Home',
  isShowWidgetsPage: false,
  custom: { preserve: 'unknown fields' },
});
function fixture() {
  let backend = baseline();
  const proxy = {
    Load: jest.fn(async () => ({ content: cloneDeep(backend) })),
    Save: jest.fn(async ({ content }) => {
      backend = cloneDeep(content);
    }),
  };
  const live = { applyConfig: jest.fn() };
  const draft = new Draft(proxy, live, 'a');
  return {
    draft,
    proxy,
    live,
    changeBackend: () => {
      backend.description = 'Changed elsewhere';
    },
  };
}
test('configuration diff preserves zero, false, null, removals and ordered-array paths', () => {
  const changes = diff.configDiff(
    { zero: 1, flag: true, removed: 'x', array: ['a', 'b'] },
    { zero: 0, flag: false, array: ['b', 'a'], empty: null }
  );
  expect(changes).toEqual(
    expect.arrayContaining([
      { path: '$.zero', before: 1, after: 0 },
      { path: '$.flag', before: true, after: false },
      { path: '$.removed', before: 'x', after: undefined },
      { path: '$.empty', before: undefined, after: null },
      { path: '$.array[0]', before: 'a', after: 'b' },
    ])
  );
});
test('panel load, editing and layout only mutate a draft; discard never writes', async () => {
  const { draft, proxy, live } = fixture();
  await draft.load();
  draft.setName('New');
  draft.moveWidget(1, -1);
  draft.removeWidget('shared');
  expect(draft.panel.widgets).toEqual(['solo']);
  expect(draft.isDirty).toBe(true);
  expect(proxy.Save).not.toHaveBeenCalled();
  expect(live.applyConfig).not.toHaveBeenCalled();
  draft.discard();
  expect(draft.panel.name).toBe('Room A');
  expect(draft.isDirty).toBe(false);
});
test('editing a shared widget defaults to an independent copy on only this panel', async () => {
  const { draft, proxy } = fixture();
  await draft.load();
  const copy = draft.saveWidget({ ...cloneDeep(draft.widget('shared')), name: 'Copy' });
  expect(copy).not.toBe('shared');
  expect(draft.widget('shared').name).toBe('Light');
  expect(draft.config.dashboards[1].widgets).toEqual(['shared']);
  expect(draft.panel.widgets).toContain(copy);
  expect(proxy.Save).not.toHaveBeenCalled();
  expect(draft.widget(copy).cells[0].extra.invert).toBe(true);
});
test('explicit edit-on-all changes the shared definition and keeps both references', async () => {
  const { draft } = fixture();
  await draft.load();
  draft.saveWidget({ ...cloneDeep(draft.widget('shared')), name: 'All' }, 'all');
  expect(draft.widget('shared').name).toBe('All');
  expect(draft.associatedPanels('shared')).toHaveLength(2);
  expect(draft.config.widgets).toHaveLength(2);
});
test('panel save checks the raw baseline, preserves unrelated fields and updates live state only after success', async () => {
  const { draft, proxy, live } = fixture();
  await draft.load();
  draft.setName('Updated');
  expect(await draft.save()).toBe(true);
  expect(proxy.Load).toHaveBeenCalledTimes(2);
  expect(proxy.Save.mock.calls[0][0].content.custom).toEqual({ preserve: 'unknown fields' });
  expect(live.applyConfig).toHaveBeenCalledTimes(1);
  expect(draft.isDirty).toBe(false);
});
test('stale panel config is rejected without writes or optimistic global changes', async () => {
  const { draft, proxy, live, changeBackend } = fixture();
  await draft.load();
  draft.setName('Draft');
  changeBackend();
  expect(await draft.save()).toBe(false);
  expect(draft.error).toBe('STALE_CONFIGURATION');
  expect(draft.isDirty).toBe(true);
  expect(proxy.Save).not.toHaveBeenCalled();
  expect(live.applyConfig).not.toHaveBeenCalled();
});
test('failed panel save retains draft and does not update the live store', async () => {
  const { draft, proxy, live } = fixture();
  await draft.load();
  draft.setName('Draft');
  proxy.Save.mockRejectedValueOnce(new Error('offline'));
  expect(await draft.save()).toBe(false);
  expect(draft.panel.name).toBe('Draft');
  expect(draft.isDirty).toBe(true);
  expect(live.applyConfig).not.toHaveBeenCalled();
});
test('an in-flight panel save freezes model edits so submitted changes cannot be silently lost', async () => {
  const { draft, proxy } = fixture();
  await draft.load();
  draft.setName('Submitted');
  let done, started;
  const ready = new Promise((r) => {
    started = r;
  });
  proxy.Save.mockImplementationOnce(
    () =>
      new Promise((r) => {
        done = r;
        started();
      })
  );
  const save = draft.save();
  await ready;
  draft.setName('Lost');
  draft.removeWidget('shared');
  draft.saveWidget({ ...cloneDeep(draft.widget('shared')), name: 'Lost' }, 'all');
  expect(draft.panel.name).toBe('Submitted');
  expect(draft.panel.widgets).toContain('shared');
  expect(draft.widget('shared').name).toBe('Light');
  done();
  expect(await save).toBe(true);
});
const roles = { User: 'user', Operator: 'operator', Admin: 'admin' };
let role = 'admin';
const rank = { user: 0, operator: 1, admin: 2 };
const auth = { hasRights: (required) => rank[role] >= rank[required] };
const menu = load('src/stores/ui/menu-items.ts', { '@/stores/auth': { UserRole: roles } });
function modeStore(saved) {
  const storage = { getItem: jest.fn(() => saved), setItem: jest.fn() };
  const { default: UiStore } = load(
    'src/stores/ui/ui-store.ts',
    {
      '@/stores/auth': { authStore: auth, UserRole: roles },
      '~/i18n/react/config': { language: 'en' },
      './api': { getMenu: async () => [] },
      './menu-items': menu,
    },
    { localStorage: storage }
  );
  return { store: new UiStore(), storage };
}
test('workspace defaults respect role and switching never elevates a normal user', () => {
  role = 'admin';
  let { store, storage } = modeStore(null);
  expect(store.workspaceMode).toBe('installer');
  store.setWorkspaceMode('home');
  expect(storage.setItem).toHaveBeenCalledWith('wb-ui-workspace', 'home');
  expect(store.workspaceMode).toBe('home');
  role = 'user';
  ({ store, storage } = modeStore('installer'));
  expect(store.workspaceMode).toBe('home');
  store.setWorkspaceMode('installer');
  expect(store.workspaceMode).toBe('home');
  expect(storage.setItem).not.toHaveBeenCalled();
  role = 'admin';
});
test('home navigation offers daily tasks while installer navigation retains native tools', async () => {
  role = 'admin';
  const { store } = modeStore('home');
  await store.buildMenu([], true, new URLSearchParams());
  expect(store.menuItems[0].url).toBe('home');
  expect(store.menuItems.some((item) => item.url === 'devices')).toBe(false);
  expect(
    store.menuItems.find((item) => item.id === 'settings').children.map((item) => item.url)
  ).toEqual(['web-ui']);
  store.setWorkspaceMode('installer');
  await store.buildMenu([], true, new URLSearchParams());
  expect(store.menuItems.some((item) => item.url === 'devices')).toBe(true);
});
test('mode switching only persists after successful guarded navigation', async () => {
  const setWorkspaceMode = jest.fn();
  let props;
  const createRoot = () => ({
    render: (element) => {
      props = element.props;
    },
    unmount: () => {},
  });
  const { default: directive } = load('app/scripts/react-directives/navigation/navigation.jsx', {
    'react-dom/client': { createRoot },
    '@/components/navigation': { Navigation: () => null },
    '~/react-directives/locale': { setReactLocale: () => {} },
    '@/stores/ui': { uiStore: { setWorkspaceMode } },
  });
  const state = {
    go: jest
      .fn()
      .mockRejectedValueOnce(new Error('dirty navigation rejected'))
      .mockResolvedValueOnce({}),
  };
  const element = { 0: {}, on: () => {} };
  directive({ dashboardsStore: {} }, state).link({}, element);
  await expect(props.changeWorkspace('home')).rejects.toThrow('dirty');
  expect(setWorkspaceMode).not.toHaveBeenCalled();
  await props.changeWorkspace('home');
  expect(setWorkspaceMode).toHaveBeenCalledWith('home');
});
const types = load('src/stores/history/types.ts');
const axes = load('src/stores/history/axis.ts', { './types': types });
const traits = load('src/stores/history/chart-traits.ts', { './types': types });
test('comparison gives different units and types independent scales on the same time axis', () => {
  const layout = {};
  const config = [];
  const make = (units, type = types.ChartType.Number) => ({ units, type, channelName: 'Reading' });
  expect(axes.getAxis(make('°C'), layout)).toBe('y');
  expect(axes.getAxis(make('°C'), layout)).toBe('y');
  expect(axes.getAxis(make('V'), layout)).toBe('y2');
  expect(axes.getAxis(make('', types.ChartType.Boolean), layout)).toBe('y3');
  axes.fixBoolAxes(layout, config);
  expect(layout.yaxis.title.text).toBe('°C');
  expect(layout.yaxis2.title.text).toBe('V');
  expect(layout.yaxis.domain[0]).toBeGreaterThan(layout.yaxis2.domain[1]);
  expect(layout.yaxis3.tickvals).toEqual([0, 1]);
});
const { historyCsv } = load('src/stores/history/csv.ts');
test('CSV uses all received rows and typed values, preserves zero and escapes spreadsheet formula strings', () => {
  const csv = historyCsv(
    ['Temperature, °C', '=header'],
    [
      { date: 0, value: [0, '=2+2'] },
      { date: 1000, value: [-4, 'a"b\nc'] },
      { date: 2000, value: [null, false] },
    ]
  );
  expect(csv).toContain('"1970-01-01T00:00:00.000Z","0","\'=2+2"');
  expect(csv).toContain('"-4","a""b\nc"');
  expect(csv).toContain('"Temperature, °C"');
  expect(csv).toContain('"\'=header"');
  expect(csv).toContain('"","false"');
});
const url = load('src/stores/history/history-url.ts');
const { default: History } = load('src/stores/history/history-store.ts', {
  './types': types,
  './axis': axes,
  './chart-traits': traits,
  './history-url': url,
  './chart-colors': load('src/stores/history/chart-colors.ts'),
  './date': load('src/stores/history/date.ts'),
  '~/i18n/react/config': { t: (x) => x },
});
function historyFixture(proxy) {
  const cell = {
    id: 'device/control/with slash',
    deviceId: 'device',
    controlId: 'control/with slash',
    name: 'Control',
    valueType: 'number',
    units: 'V',
  };
  const store = new History({
    historyProxy: proxy,
    $state: { go: jest.fn() },
    dashboardsStore: { widgets: new Map() },
    devicesStore: {
      filteredDevices: new Map([['device', { name: 'Device', cells: new Set([cell.id]) }]]),
      devices: new Map([['device', { name: 'Device', cells: new Set([cell.id]) }]]),
      cells: new Map([[cell.id, cell]]),
    },
  });
  store.buildControls();
  store.selectedStartDate = new Date(0);
  store.selectedEndDate = new Date(10000);
  return { store, cell };
}
test('history retains exact control identity and units, including a control name with slashes', () => {
  const proxy = { get_values: jest.fn(() => new Promise(() => {})) };
  const { store, cell } = historyFixture(proxy);
  store.startLoading([cell.id]);
  expect(proxy.get_values.mock.calls[0][0].channels).toEqual([['device', 'control/with slash']]);
  expect(store.charts[0].units).toBe('V');
  store.stopLoadingData();
});
test('cancelled history failure cannot replace current UI state with a stale error', async () => {
  let reject;
  const { store, cell } = historyFixture({
    get_values: () =>
      new Promise((_r, j) => {
        reject = j;
      }),
  });
  store.startLoading([cell.id]);
  store.stopLoadingData();
  reject(new Error('late failure'));
  await Promise.resolve();
  await Promise.resolve();
  expect(store.errors).toEqual([]);
  expect(store.loadPending).toBe(false);
  expect(store.disableUi).toBe(false);
  expect(store.chartConfig).toEqual([]);
});
const ruleDeps = { '@/utils/id': ids };
const { default: Rules } = load('src/stores/rules/rules-store.ts', ruleDeps);
test('rule errors preserve traceback and unsaved edits while failed saves remain dirty', async () => {
  const proxy = {
    Load: async () => ({
      content: 'line1\nline2',
      enabled: true,
      error: { message: 'failure', traceback: [{ name: 'test.js', line: 2 }] },
    }),
    Save: async () => ({
      path: 'test.js',
      error: 'compile failure',
      traceback: [{ name: 'test.js', line: 1 }],
    }),
  };
  const store = new Rules({}, async () => {}, proxy);
  await store.load('test.js');
  expect(store.rule.error.traceback[0].line).toBe(2);
  expect(store.savedContent).toBe('line1\nline2');
  expect(store.isDirty).toBe(false);
  store.setRule('draft');
  await store.save(store.rule);
  expect(store.isDirty).toBe(true);
  expect(store.rule.error.errorLine).toBe(1);
  expect(store.rule.content).toBe('draft');
});
test('failed rename after saving content still leaves the edited name dirty and retryable', async () => {
  const proxy = {
    Load: async () => ({ content: 'old', enabled: true }),
    Save: async () => ({ path: 'old.js' }),
    Rename: async () => {
      throw new Error('rename failure');
    },
  };
  const store = new Rules({}, async () => {}, proxy);
  await store.load('old.js');
  store.setRuleName('new.js');
  await store.save(store.rule);
  await expect(store.rename('old.js', 'new.js')).rejects.toThrow();
  expect(store.isDirty).toBe(true);
});
test('rule diagnostics keep submitted B through editing C without replacing successful baseline A', async () => {
  const proxy = {
    Load: async () => ({
      content: 'A',
      enabled: true,
      error: { message: 'A error', traceback: [{ name: 'test.js', line: 1 }] },
    }),
    Save: async () => ({
      path: 'test.js',
      error: 'B error',
      traceback: [{ name: 'test.js', line: 1 }],
    }),
  };
  const store = new Rules({}, async () => {}, proxy);
  await store.load('test.js');
  expect(store.errorSource).toEqual({ content: 'A', origin: 'loaded' });
  store.setRule('B');
  await store.save(store.rule);
  expect(store.savedContent).toBe('A');
  expect(store.errorSource).toEqual({ content: 'B', origin: 'submitted' });
  store.setRule('C');
  expect(store.errorSource.content).toBe('B');
  expect(store.isDirty).toBe(true);
});
