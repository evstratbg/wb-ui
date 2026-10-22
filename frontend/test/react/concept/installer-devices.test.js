import fs from 'fs';
import path from 'path';
import vm from 'vm';
import cloneDeep from 'lodash/cloneDeep';
import { transformSync } from 'esbuild';

const frontend = path.resolve(__dirname, '../../..');

function loadSource(relativePath, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(frontend, relativePath), 'utf8');
  const code = transformSync(source, {
    loader: relativePath.endsWith('.tsx') ? 'tsx' : relativePath.endsWith('.ts') ? 'ts' : relativePath.endsWith('.jsx') ? 'jsx' : 'js',
    format: 'cjs',
    target: 'es2022',
    jsx: 'automatic',
  }).code;
  const result = { exports: {} };
  vm.runInNewContext(code, {
    module: result,
    exports: result.exports,
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    URLSearchParams,
    console,
    ...globals,
  }, { filename: relativePath });
  return result.exports;
}

const { DeviceTypesStore } = loadSource('src/stores/device-manager/device-types-store.ts', {
  '@/stores/json-schema-editor': { loadJsonSchema: (schema) => schema },
  '~/utils/fwUtils': {},
});
const { deviceHref, getChannelGroup, groupChannels } = loadSource('src/pages/devices/device-model.ts');

test('device URLs retain catalog context and encode device and channel identities for refresh and sharing', () => {
  const route = {
    search: 'Свет & WB', filter: 'errors', device: 'lighting-east & kitchen', tab: 'history', channel: 'lighting-east & kitchen/Output 1',
  };
  const href = deviceHref(route);
  expect(href).toMatch(/^#!\/devices\?/);
  expect(href).not.toContain('serial-config');
  const params = new URLSearchParams(href.split('?')[1]);
  for (const [key, value] of Object.entries(route)) expect(params.get(key)).toBe(value);
  expect(deviceHref({ ...route, tab: 'settings' })).toContain('tab=settings');
  expect(deviceHref()).toBe('#!/devices');
  expect(deviceHref({ filter: 'all', tab: 'channels', device: '0' })).toBe('#!/devices?device=0');
});

test('channel grouping follows write access and runtime types without assuming a particular hardware template', () => {
  const cell = (properties) => ({ id: 'custom/channel', controlId: 'Channel', name: 'Channel', hidden: false, isComplete: true, readOnly: true, units: '', valueType: 'number', displayType: 'value', ...properties });
  const writableText = cell({ readOnly: false, valueType: 'string', displayType: 'text', name: 'Firmware mode' });
  const writableNumber = cell({ readOnly: false, valueType: 'number', displayType: 'value' });
  const readOnlySwitch = cell({ valueType: 'boolean', displayType: 'switch' });
  const measuredCounter = cell({ name: 'Energy counter', units: 'kWh' });
  const technicalCounter = cell({ name: 'Input counter' });
  const alarm = cell({ displayType: 'alarm', valueType: 'boolean' });
  const identity = cell({ name: 'Serial number', valueType: 'string', displayType: 'text' });
  expect(getChannelGroup(writableText)).toBe('control');
  expect(getChannelGroup(writableNumber)).toBe('control');
  expect(getChannelGroup(readOnlySwitch)).toBe('input');
  expect(getChannelGroup(measuredCounter)).toBe('value');
  for (const channel of [technicalCounter, alarm, identity]) expect(getChannelGroup(channel)).toBe('detail');
  const channels = [writableText, readOnlySwitch, measuredCounter, technicalCounter, cell({ hidden: true }), cell({ isComplete: false })];
  const groups = groupChannels(channels);
  expect(groups).toEqual({ control: [writableText], input: [readOnlySwitch], value: [measuredCounter], detail: [technicalCounter] });
  expect(channels).toHaveLength(6);
  expect(groups.control[0]).toBe(writableText);
});

test('native dirty guard retains the workspace draft on tab/device navigation and still protects external navigation and refresh', async () => {
  const window = { addEventListener: jest.fn() };
  const { default: createPageState } = loadSource('app/scripts/services/pagestate.js', {}, { window });
  const confirm = jest.fn(() => false);
  const transitions = { onBefore: jest.fn() };
  const pageState = createPageState({ $on: jest.fn() }, { confirm }, true, async () => 'Unsaved draft', transitions);
  await Promise.resolve();
  const transition = (from, to) => ({ from: () => ({ name: from }), to: () => ({ name: to }) });
  const before = transitions.onBefore.mock.calls[0][1];
  const beforeUnload = window.addEventListener.mock.calls.find(([name]) => name === 'beforeunload')[1];
  pageState.setDirty(true);
  expect(before(transition('devices', 'devices'))).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  expect(pageState.isDirty()).toBe(true);
  const event = {};
  expect(beforeUnload(event)).toBe('Unsaved draft');
  expect(event.returnValue).toBe('Unsaved draft');
  expect(before(transition('devices', 'overview'))).toBe(false);
  expect(pageState.isDirty()).toBe(true);
  confirm.mockReturnValue(true);
  expect(before(transition('devices', 'serial-config'))).toBe(true);
  expect(pageState.isDirty()).toBe(false);
});

test('device-level MQTT errors keep an otherwise empty device visible and clear without publishing control values', () => {
  const localStorage = { getItem: () => null };
  const { default: Device } = loadSource('src/stores/devices/device.ts', { '~/i18n/react/config': { language: 'en' } }, { localStorage });
  const helpers = loadSource('src/stores/devices/helpers.ts');
  const { default: DevicesStore } = loadSource('src/stores/devices/devices-store.ts', {
    './device': Device, './cell': class {}, './helpers': helpers,
  }, { localStorage });
  let receive;
  const mqtt = { addStickySubscription: jest.fn((_topic, handler) => { receive = handler; }), send: jest.fn() };
  const store = new DevicesStore(mqtt);
  receive({ topic: '/devices/lost-module/meta/error', payload: 'r' });
  expect(store.devices.get('lost-module').error).toBe('r');
  expect(store.filteredDevices.has('lost-module')).toBe(true);
  expect(store.getDeviceCells('lost-module')).toEqual([]);
  receive({ topic: '/devices/lost-module/meta/error', payload: '' });
  expect(store.devices.has('lost-module')).toBe(false);
  receive({ topic: '/devices/named-module/meta/name', payload: 'Named module' });
  receive({ topic: '/devices/named-module/meta/error', payload: 'r' });
  receive({ topic: '/devices/named-module/meta/error', payload: '' });
  expect(store.devices.get('named-module').error).toBe('');
  expect(store.devices.get('named-module').name).toBe('Named module');
  expect(mqtt.send).not.toHaveBeenCalled();
});

const deviceTypes = [{ name: 'Modules', types: [
  { type: 'WB-MDM3-v2', name: 'WB-MDM3', 'mqtt-id': 'wb-mdm3', protocol: 'modbus' },
  { type: 'WB-MRM2', name: 'WB-MRM2', 'mqtt-id': 'wb-mrm2', protocol: 'modbus' },
] }];

function createInstaller(ports = [{
  path: '/dev/ttyRS485-1',
  enabled: true,
  devices: [{ device_type: 'WB-MDM3-v2', slave_id: '30', id: 'lighting-east' }],
}]) {
  let backendConfig = { debug: false, ports: cloneDeep(ports) };
  let failSave = false;
  let dirty = false;
  const disposers = [];
  const proxies = {
    serialProxy: {
      Load: jest.fn(async () => ({ config: cloneDeep(backendConfig), schema: { definitions: {} }, types: deviceTypes })),
      GetSchema: jest.fn(async () => ({ type: 'object', properties: {} })),
    },
    configEditorProxy: { Save: jest.fn(async ({ content }) => {
      if (failSave) throw new Error('Cannot write serial config');
      backendConfig = cloneDeep(content);
    }) },
    fwUpdateProxy: { Update: jest.fn(), Restore: jest.fn() },
    serialDeviceProxy: { LoadConfig: jest.fn(async () => ({})) },
    serialPortProxy: { Setup: jest.fn() },
  };
  let editor;
  // Isolate native editor rendering while exercising the actual adapter's RPC
  // callbacks, identity matching, selection, conflict detection and lifecycle.
  class Editor {
    constructor(load, save, _toContent, _toTabs, types) {
      editor = this;
      this.loadConfig = load;
      this.saveConfig = save;
      this.types = types;
      this.pageWrapperStore = { error: '' };
      this.tabs = { portTabs: [], items: [], selectedTabIndex: 0, uniqueMqttIdChecker: { removeTab: jest.fn() } };
      this.loaded = false;
      this.config = null;
      this.commit = jest.fn(() => { dirty = false; });
    }
    get isDirty() { return dirty; }
    get allowSave() { return dirty; }
    async load() {
      const data = await this.loadConfig();
      this.config = cloneDeep(data.config);
      this.types.setDeviceTypeGroups(data.deviceTypeGroups);
      this.tabs.portTabs = (data.config.ports || []).map((config) => {
        const dispose = jest.fn();
        disposers.push(dispose);
        const port = { name: config.path, path: config.path, isEnabled: config.enabled !== false, baseConfig: config, reactionDisposers: [dispose] };
        port.children = (config.devices || []).map((device) => {
          const tab = {
          deviceType: device.device_type,
          deviceTypesStore: this.types,
          editedData: device,
          slaveId: device.slave_id,
          get mqttId() { return this.editedData.id || this.deviceTypesStore.getDefaultId(this.deviceType, this.slaveId); },
          loadContent: jest.fn(async (portConfig) => {
            await this.types.getSchema(device.device_type);
            tab.schemaStore = {};
            if (portConfig) await proxies.serialDeviceProxy.LoadConfig({ port: portConfig.path, slave_id: device.slave_id });
          }),
          };
          return tab;
        });
        return port;
      });
      this.tabs.items = this.tabs.portTabs.flatMap((port) => [port, ...port.children]);
      // Native ConfigEditorPageStore consumes the loaded object's ports. This
      // must not corrupt the adapter's baseline used to detect stale saves.
      delete data.config.ports;
      this.loaded = true;
    }
    makeConfigJson() { return this.config; }
    async save() {
      this.pageWrapperStore.error = '';
      try {
        await this.saveConfig(this.config);
        this.commit();
      } catch (error) {
        this.pageWrapperStore.error = error.message;
      }
    }
  }
  const { default: DeviceInstallerStore } = loadSource('app/scripts/react-directives/devices/device-installer-store.js', {
    '~/i18n/react/config': { language: 'en', t: (_key, options) => options.defaultValue },
    '@/stores/device-manager': { DeviceTypesStore },
    '@/utils/formatError': { formatError: String },
    '@/utils/config-diff': loadSource('src/utils/config-diff.ts'),
    '../device-manager/config-editor/configEditorPageStore': Editor,
  });
  const installer = new DeviceInstallerStore(proxies);
  return {
    installer,
    proxies,
    disposers,
    get editor() { return editor; },
    setDirty(value = true) { dirty = value; },
    failSave() { failSave = true; },
    changeBackend() { backendConfig.debug = true; },
  };
}

test('installer matches custom MQTT ids exactly, independent of device name and Modbus address', async () => {
  const { installer } = createInstaller();
  await installer.reload();
  expect(installer.loaded).toBe(true);
  expect(installer.getDeviceMatch('lighting-east')).toMatchObject({
    id: 'lighting-east', address: '30', deviceType: 'WB-MDM3-v2', typeName: 'WB-MDM3', portPath: '/dev/ttyRS485-1', enabled: true,
  });
  for (const wrongId of ['WB-MDM3 30', 'wb-mdm3_30', '30', 'lighting-east-extra']) {
    expect(installer.getDeviceMatch(wrongId)).toBeNull();
  }
});

test('installer resolves default MQTT ids through the native type prefix rather than the template name', async () => {
  const { installer } = createInstaller([{ path: '/dev/ttyRS485-2', devices: [{ device_type: 'WB-MDM3-v2', slave_id: '30' }] }]);
  await installer.reload();
  expect(installer.getDeviceMatch('wb-mdm3_30').address).toBe('30');
  expect(installer.getDeviceMatch('WB-MDM3-v2_30')).toBeNull();
});

test('duplicate MQTT ids across ports are ambiguous and never select or read the first physical device', async () => {
  const { installer, proxies } = createInstaller([
    { path: '/dev/ttyRS485-1', devices: [{ device_type: 'WB-MDM3-v2', slave_id: '30', id: 'duplicate' }] },
    { path: '/dev/ttyRS485-2', devices: [{ device_type: 'WB-MRM2', slave_id: '55', id: 'duplicate' }] },
  ]);
  await installer.reload();
  expect(installer.getDeviceMatches('duplicate')).toHaveLength(2);
  expect(installer.getDeviceMatch('duplicate')).toBeNull();
  await installer.openDevice('duplicate');
  await installer.readRegisters('duplicate');
  expect(proxies.serialProxy.GetSchema).not.toHaveBeenCalled();
  expect(proxies.serialDeviceProxy.LoadConfig).not.toHaveBeenCalled();
});

test('virtual and absent MQTT devices have no fabricated serial configuration', async () => {
  const { installer, proxies } = createInstaller();
  await installer.reload();
  for (const id of ['hwmon', 'rules_virtual-lighting', 'not-yet-received']) {
    expect(installer.getDeviceMatches(id)).toHaveLength(0);
    expect(installer.getDeviceMatch(id)).toBeNull();
    await installer.openDevice(id);
  }
  expect(proxies.serialProxy.GetSchema).not.toHaveBeenCalled();
  expect(proxies.serialDeviceProxy.LoadConfig).not.toHaveBeenCalled();
});

test('opening settings loads only the schema and never writes values, saves, changes bus settings or updates firmware', async () => {
  const context = createInstaller();
  const { installer, proxies } = context;
  await installer.reload();
  await installer.openDevice('lighting-east');
  await installer.openDevice('lighting-east');
  const tab = installer.getDeviceMatch('lighting-east').tab;
  expect(tab.loadContent).toHaveBeenCalledTimes(1);
  expect(tab.loadContent).toHaveBeenCalledWith();
  expect(context.editor.tabs.items[context.editor.tabs.selectedTabIndex]).toBe(tab);
  expect(proxies.serialProxy.GetSchema).toHaveBeenCalledWith({ type: 'WB-MDM3-v2' });
  expect(proxies.serialDeviceProxy.LoadConfig).not.toHaveBeenCalled();
  expect(proxies.configEditorProxy.Save).not.toHaveBeenCalled();
  expect(proxies.serialPortProxy.Setup).not.toHaveBeenCalled();
  expect(proxies.fwUpdateProxy.Update).not.toHaveBeenCalled();
  expect(proxies.fwUpdateProxy.Restore).not.toHaveBeenCalled();
  expect(installer.isDirty).toBe(false);
});

test('register reads are explicit and disabled ports cannot be read', async () => {
  const context = createInstaller();
  await context.installer.reload();
  await context.installer.readRegisters('lighting-east');
  expect(context.proxies.serialDeviceProxy.LoadConfig).toHaveBeenCalledWith({ port: '/dev/ttyRS485-1', slave_id: '30' });
  const disabled = createInstaller([{ path: '/dev/ttyRS485-1', enabled: false, devices: [{ device_type: 'WB-MDM3-v2', slave_id: '30', id: 'disabled' }] }]);
  await disabled.installer.reload();
  expect(disabled.installer.getDeviceMatch('disabled').enabled).toBe(false);
  await disabled.installer.readRegisters('disabled');
  expect(disabled.proxies.serialDeviceProxy.LoadConfig).not.toHaveBeenCalled();
});

test('register reads cannot replace a dirty native settings draft', async () => {
  const { installer, proxies } = createInstaller();
  await installer.reload();
  await installer.openDevice('lighting-east');
  const tab = installer.getDeviceMatch('lighting-east').tab;
  const draft = tab.schemaStore;
  tab.isDirty = true;
  tab.loadContent.mockClear();
  await installer.readRegisters('lighting-east');
  expect(tab.loadContent).not.toHaveBeenCalled();
  expect(proxies.serialDeviceProxy.LoadConfig).not.toHaveBeenCalled();
  expect(tab.schemaStore).toBe(draft);
});

test('save waits until a device schema or register read has completed', async () => {
  const context = createInstaller();
  await context.installer.reload();
  context.setDirty();
  const tab = context.installer.getDeviceMatch('lighting-east').tab;
  tab.isLoading = true;
  expect(context.installer.allowSave).toBe(false);
  await context.installer.save();
  expect(context.proxies.configEditorProxy.Save).not.toHaveBeenCalled();
  tab.isLoading = false;
  expect(context.installer.allowSave).toBe(true);
});

test('a stale whole-file configuration is refused before Save and the installer draft stays dirty', async () => {
  const context = createInstaller();
  await context.installer.reload();
  context.setDirty();
  context.changeBackend();
  await context.installer.save();
  expect(context.proxies.configEditorProxy.Save).not.toHaveBeenCalled();
  expect(context.installer.error).toContain('another window');
  expect(context.installer.isDirty).toBe(true);
  expect(context.installer.saved).toBe(false);
  expect(context.editor.commit).not.toHaveBeenCalled();
});

test('a failed backend write retains the native draft and exposes the failure', async () => {
  const context = createInstaller();
  await context.installer.reload();
  context.setDirty();
  context.failSave();
  await context.installer.save();
  expect(context.proxies.configEditorProxy.Save).toHaveBeenCalledTimes(1);
  expect(context.installer.error).toContain('Cannot write serial config');
  expect(context.installer.isDirty).toBe(true);
  expect(context.installer.saved).toBe(false);
  expect(context.installer.isSaving).toBe(false);
  expect(context.editor.commit).not.toHaveBeenCalled();
});

test('successful save uses the native full-config endpoint and refreshes the stale-write baseline', async () => {
  const context = createInstaller();
  await context.installer.reload();
  context.setDirty();
  context.editor.config.ports[0].devices[0].name = 'East lighting';
  await context.installer.save();
  expect(context.proxies.configEditorProxy.Save).toHaveBeenCalledWith({
    path: '/usr/share/wb-mqtt-confed/schemas/wb-mqtt-serial-dummy.schema.json',
    content: context.editor.config,
  });
  expect(context.installer.saved).toBe(true);
  expect(context.installer.isDirty).toBe(false);
  context.setDirty();
  context.editor.config.ports[0].devices[0].name = 'East lighting renamed';
  await context.installer.save();
  expect(context.proxies.configEditorProxy.Save).toHaveBeenCalledTimes(2);
  expect(context.installer.error).toBe('');
});

test('an edited MQTT id retains the original card binding until the configuration is reloaded', async () => {
  const { installer } = createInstaller();
  await installer.reload();
  const match = installer.getDeviceMatch('lighting-east');
  match.tab.editedData.id = 'lighting-new';
  expect(installer.getDeviceMatch('lighting-east').tab).toBe(match.tab);
  expect(installer.getDeviceMatch('lighting-new').tab).toBe(match.tab);
});

test('dispose releases native tab reactions and prevents subsequent device work', async () => {
  const context = createInstaller();
  await context.installer.reload();
  const editor = context.editor;
  const tab = context.installer.getDeviceMatch('lighting-east').tab;
  context.installer.dispose();
  expect(context.disposers[0]).toHaveBeenCalledTimes(1);
  expect(editor.tabs.uniqueMqttIdChecker.removeTab).toHaveBeenCalledWith(tab);
  const loads = context.proxies.serialProxy.Load.mock.calls.length;
  await context.installer.reload();
  await context.installer.openDevice('lighting-east');
  await context.installer.readRegisters('lighting-east');
  context.setDirty();
  await context.installer.save();
  expect(context.proxies.serialProxy.Load).toHaveBeenCalledTimes(loads);
  expect(tab.loadContent).not.toHaveBeenCalled();
  expect(context.proxies.configEditorProxy.Save).not.toHaveBeenCalled();
});

test.each(['user', 'operator', 'admin'])('the devices bridge creates configuration access only for the admin role (%s)', async (role) => {
  const instances = [];
  class Installer {
    constructor() {
      this.isDirty = false;
      this.reload = jest.fn(async () => {});
      this.dispose = jest.fn();
      instances.push(this);
    }
  }
  const root = { render: jest.fn(), unmount: jest.fn() };
  const { default: directive } = loadSource('app/scripts/react-directives/devices/devicesDirective.jsx', {
    'react-dom/client': { createRoot: () => root },
    '@/pages/devices': { __esModule: true, default: () => null },
    '@/stores/auth': { UserRole: { Admin: 'admin' }, authStore: { hasRights: () => role === 'admin' } },
    '@/utils/formatError': { formatError: String },
    '@/utils/config-diff': loadSource('src/utils/config-diff.ts'),
    '~/react-directives/locale': { setReactLocale: jest.fn() },
    './device-installer-store': Installer,
  });
  const state = { params: { device: 'lighting-east', tab: 'history', search: 'MDM', filter: 'all' }, go: jest.fn() };
  const transitionDispose = jest.fn();
  const transitions = { onSuccess: jest.fn(() => transitionDispose) };
  const ready = jest.fn(async () => {});
  const pageState = { setDirty: jest.fn() };
  const historyProxy = { get_values: jest.fn() };
  const logsProxy = { Load: jest.fn() };
  let destroy;
  const element = { 0: {}, on: (_event, handler) => { destroy = handler; } };
  directive({ devicesStore: {} }, ready, {}, {}, {}, {}, {}, historyProxy, logsProxy, pageState, state, transitions).link({}, element);
  await Promise.resolve();
  await Promise.resolve();
  expect(instances).toHaveLength(role === 'admin' ? 1 : 0);
  expect(ready).toHaveBeenCalledTimes(role === 'admin' ? 1 : 0);
  const props = root.render.mock.calls[0][0].props;
  expect(props.route).toEqual(state.params);
  expect(props.historyProxy).toBe(historyProxy);
  expect(props.logsProxy).toBe(logsProxy);
  expect(props.installer).toBe(role === 'admin' ? instances[0] : null);
  props.onNavigate({ device: 'wb-mrm2_55', tab: 'settings' });
  expect(state.go).toHaveBeenCalledWith('devices', { device: 'wb-mrm2_55', tab: 'settings' }, { inherit: true, location: true });
  transitions.onSuccess.mock.calls[0][1]();
  expect(root.render.mock.calls[1][0].props.installer).toBe(props.installer);
  if (role === 'admin') expect(instances[0].reload).toHaveBeenCalledTimes(1);
  destroy();
  expect(transitionDispose).toHaveBeenCalledTimes(1);
  expect(root.unmount).toHaveBeenCalledTimes(1);
  if (role === 'admin') expect(instances[0].dispose).toHaveBeenCalledTimes(1);
});
