import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

// Compile the actual TS/route modules; isolate their browser/service dependencies.
const frontend = path.resolve(__dirname, '../../..');
const roles = { User: 'user', Operator: 'operator', Admin: 'admin' };

test.each(['ru', 'en'])('device search labels resolve in the native %s translation namespace', async (language) => {
  const translations = JSON.parse(fs.readFileSync(path.join(frontend, `app/scripts/i18n/react/locales/${language}/translations.json`), 'utf8'));
  const i18n = require('i18next').createInstance();
  await i18n.init({ lng: language, resources: { [language]: { translations } }, ns: ['translations'], defaultNS: 'translations' });
  expect(i18n.t('devices.labels.search')).not.toBe('devices.labels.search');
  expect(i18n.t('devices.labels.found', { count: 3 })).toContain('3');
});

function loadSource(relativePath, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(frontend, relativePath), 'utf8');
  const code = transformSync(source, { loader: relativePath.endsWith('.tsx') ? 'tsx' : relativePath.endsWith('.ts') ? 'ts' : 'js', format: 'cjs', target: 'es2022', jsx: 'automatic' }).code;
  const result = { exports: {} };
  vm.runInNewContext(code, {
    module: result,
    exports: result.exports,
    require: (name) => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (/\.(svg|css|html)$/.test(name)) return () => null;
      return require(name);
    },
    URLSearchParams,
    console,
    ...globals,
  }, { filename: relativePath });
  return result.exports;
}

test('overview is a native route and all original editor routes remain available', () => {
  const configurations = [];
  const angularModule = { config: (configuration) => { configurations.push(configuration); return angularModule; } };
  loadSource('app/scripts/app.routes.js', { 'angular-ui-router': 'ui.router' }, { angular: { module: () => angularModule } });
  const routes = new Map();
  const stateProvider = { state: (name, configuration) => { routes.set(name, configuration); return stateProvider; } };
  const locationProvider = { html5Mode: jest.fn(), hashPrefix: jest.fn() };
  configurations.find((configuration) => typeof configuration === 'function')(stateProvider, locationProvider, { otherwise: jest.fn() });
  expect(routes.get('home').controller).toBe('HomeCtrl as $ctrl');
  expect(routes.get('home').template).toBeDefined();
  expect(routes.get('home').redirectTo).toBeUndefined();
  expect(routes.get('overview').template).toBe('<overview-page />');
  for (const route of ['serial-config', 'serial-config.properties', 'serial-config.scan', 'network-connections', 'configEdit', 'configs', 'rules-edit', 'rules-new', 'dashboard-svg-edit', 'history', 'system', 'webUI', 'accessLevel', 'logs', 'MQTTChannels', 'mbgate', 'dali', 'integrations-alice']) expect(routes.has(route)).toBe(true);
  expect(routes.get('devices').url).toBe('/devices?search&device&tab&filter&channel');
  expect(routes.get('devices').params.search.dynamic).toBe(true);
});

test.each([false, true])('root still opens the configured default dashboard (SVG: %s)', (isSvg) => {
  const { default: HomeController } = loadSource('app/scripts/controllers/homeController.js', { mobx: { when: jest.fn() } });
  const state = { go: jest.fn() };
  const dashboardsStore = { isLoading: false, defaultDashboardId: 'preferred', dashboards: new Map([['preferred', { isSvg }]]) };
  new HomeController(state, { dashboardsStore }, {});
  expect(state.go).toHaveBeenCalledWith(isSvg ? 'dashboard-svg' : 'dashboard', { id: 'preferred' });
});

test('root still falls back to the native dashboard list when no default is configured', () => {
  const { default: HomeController } = loadSource('app/scripts/controllers/homeController.js', { mobx: { when: jest.fn() } });
  const state = { go: jest.fn() };
  new HomeController(state, { dashboardsStore: { isLoading: false, dashboards: new Map() } }, {});
  expect(state.go).toHaveBeenCalledWith('dashboards');
});

test.each(['user', 'operator', 'admin'])('overview menu is available to %s while native settings retain their role boundaries', (role) => {
  const rank = { user: 0, operator: 1, admin: 2 };
  const { getMenuItems } = loadSource('src/stores/ui/menu-items.ts', { '@/stores/auth': { UserRole: roles } });
  const items = getMenuItems([], true, new URLSearchParams(), (required) => rank[role] >= rank[required]);
  expect(items.find((item) => item.url === 'overview').isShow).toBe(true);
  const settings = items.find((item) => item.id === 'settings');
  expect(settings.children.find((item) => item.url === 'serial-config').isShow).toBe(role === 'admin');
  expect(settings.children.find((item) => item.url === 'network-connections').isShow).toBe(role === 'admin');
  expect(settings.children.find((item) => item.url === 'logs').isShow).toBe(role !== 'user');
  expect(items.find((item) => item.url === 'devices').isShow).toBe(role !== 'user');
  expect(items.every((item) => !item.url || !/^https?:/.test(item.url))).toBe(true);
});

test('native dashboard navigation preserves text/SVG destinations and HMI fullscreen behavior', () => {
  const { getMenuItems } = loadSource('src/stores/ui/menu-items.ts', { '@/stores/auth': { UserRole: roles } });
  const items = getMenuItems([{ id: 'text', name: 'Main', isSvg: false }, { id: 'svg', name: 'Plan', isSvg: true }, { id: 'hidden', name: 'Hidden', options: { isHidden: true } }], true, new URLSearchParams('fullscreen'), () => true);
  expect(items.find((item) => item.url === 'overview').isShow).toBe(false);
  const dashboards = items.find((item) => item.id === 'dashboards-all').children;
  expect(dashboards.find((item) => item.label === 'Main').url).toBe('dashboards/text?fullscreen');
  expect(dashboards.find((item) => item.label === 'Plan').url).toBe('dashboards/svg/view/svg?fullscreen');
  expect(dashboards.some((item) => item.label === 'Hidden')).toBe(false);
});

test('separate-port build disables stock HTTPS redirect without performing backend requests', async () => {
  const request = { get: jest.fn(), post: jest.fn() };
  const window = { location: { hostname: 'wirenboard-test.local', protocol: 'http:', port: '8080', pathname: '/', hash: '#!/overview', href: 'http://wirenboard-test.local:8080/#!/overview' } };
  const { switchToHttps } = loadSource('src/utils/httpsUtils.ts', { '@/utils/request': { request } }, { __DISABLE_HTTPS_CHECK__: true, window });
  expect(await switchToHttps()).toBe(false);
  expect(request.get).not.toHaveBeenCalled();
  expect(request.post).not.toHaveBeenCalled();
  expect(window.location.href).toContain(':8080/#!/overview');
});

function renderOverview({ battery = '0', error = [], role = 'admin', language = 'ru' } = {}) {
  const cells = new Map();
  const add = (deviceId, controlId, value, extra = {}) => {
    const cell = { id: `${deviceId}/${controlId}`, deviceId, controlId, name: controlId, value, type: 'value', units: '', isComplete: true, hidden: false, readOnly: true, error: [], ...extra };
    cells.set(cell.id, cell);
    return cell;
  };
  add('hwmon', 'CPU Temperature', 59.3, { type: 'temperature', units: 'deg C', error });
  add('hwmon', 'Board Temperature', 34.7, { type: 'temperature', units: 'deg C' });
  add('power_status', 'Vin', 12.1, { type: 'voltage', units: 'V' });
  add('power_status', 'working on battery', battery, { type: 'switch' });
  add('system', 'HW Revision', '7.3.3', { type: 'text' });
  add('system', 'Short SN', 'TEST123', { type: 'text' });
  add('system', 'Current uptime', '2d 4h 5m', { type: 'text' });
  add('hidden', 'secret channel', 5, { hidden: true });
  const devices = new Map([...new Set([...cells.values()].map((cell) => cell.deviceId))].map((id) => [id, { id, name: id, isSystemDevice: false, isVisible: true }]));
  const devicesStore = { cells, devices, getDeviceCells: (id) => [...cells.values()].filter((cell) => cell.deviceId === id && !cell.hidden), topics: [] };
  const roleRank = { user: 0, operator: 1, admin: 2 };
  const { default: Overview } = loadSource('src/pages/overview/overview.tsx', {
    'mobx-react-lite': { observer: (component) => component },
    'react-i18next': { useTranslation: () => ({ i18n: { language } }) },
    '@/stores/auth': { UserRole: roles, authStore: { hasRights: (required) => roleRank[role] >= roleRank[required] } },
    '@/stores/ui': { uiStore: { isConnected: true } },
    '@/components/cell': { Cell: ({ cell }) => React.createElement('span', { 'data-cell': cell.id }, String(cell.value)) },
    '@/components/dropdown': { Dropdown: () => null },
    '@/layouts/page': { PageLayout: ({ children, actions, title }) => React.createElement('main', null, title, actions, children) },
    './overview-history': { __esModule: true, default: () => null },
    '@/pages/devices/device-model': loadSource('src/pages/devices/device-model.ts'),
  }, { localStorage: { getItem: () => null }, setTimeout, clearTimeout, AbortController });
  return renderToStaticMarkup(React.createElement(Overview, { devicesStore, historyProxy: {} }));
}

test('overview treats string zero as mains power and empty error arrays as healthy', () => {
  const html = renderOverview();
  expect(html).toContain('Входное напряжение');
  expect(html).not.toContain('Работа от батареи');
  expect(html).not.toContain('Ошибка канала: показано последнее полученное значение');
  expect(html).toContain('59,3');
  expect(html).not.toContain('secret channel');
});

test.each([true, 1, '1'])('overview recognizes battery state %s and displays received errors', (battery) => {
  const html = renderOverview({ battery, error: ['r'] });
  expect(html).toContain('Работа от батареи');
  expect(html).toContain('Ошибка канала: показано последнее полученное значение');
});

test('ordinary user overview does not offer administrator device configuration', () => {
  const user = renderOverview({ role: 'user', error: ['r'] });
  const operator = renderOverview({ role: 'operator' });
  const admin = renderOverview({ role: 'admin' });
  for (const href of ['serial-config', 'system', 'network-connections', 'devices']) expect(user).not.toContain(`href="#!/${href}"`);
  for (const href of ['serial-config', 'system', 'network-connections']) expect(operator).not.toContain(`href="#!/${href}"`);
  expect(operator).toContain('href="#!/devices"');
  for (const href of ['serial-config', 'system', 'network-connections', 'devices']) expect(admin).toContain(`href="#!/${href}"`);
});

test('overview follows the native English locale for all own copy and numeric formatting', () => {
  const html = renderOverview({ language: 'en' });
  expect(html).toContain('Controller overview');
  expect(html).toContain('Favorite channels');
  expect(html).toContain('Configure network');
  expect(html).toContain('CPU temperature');
  expect(html).toContain('59.3');
  expect(html).not.toMatch(/[А-Яа-яЁё]/);
});

test.each(['ru-RU', 'en-US'])('chart own copy, errors and numbers follow %s', (locale) => {
  const { default: History } = loadSource('src/pages/overview/overview-history.tsx', {
    'mobx-react-lite': { observer: (component) => component },
    '@/stores/ui': { uiStore: { isConnected: false } },
  });
  const html = renderToStaticMarkup(React.createElement(History, { cell: { id: 'test/temp', name: 'Temperature', value: 59.3, units: 'deg C', error: ['r'] }, historyProxy: {}, locale }));
  if (locale.startsWith('en')) {
    expect(html).toContain('Current value');
    expect(html).toContain('Channel error');
    expect(html).toContain('Disconnected. The chart shows previously loaded data.');
    expect(html).toContain('Refresh history');
    expect(html).toContain('59.3');
    expect(html).not.toMatch(/[А-Яа-яЁё]/);
  } else {
    expect(html).toContain('Текущее значение');
    expect(html).toContain('Ошибка канала');
    expect(html).toContain('59,3');
  }
});
