import { configDiff } from '@/utils/config-diff';
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import {
  makeObservable,
  observable,
  computed,
  action,
  runInAction,
} from "mobx";
import i18n from "~/i18n/react/config";
import { DeviceTypesStore } from "@/stores/device-manager";
import { formatError } from "@/utils/formatError";
import ConfigEditorPageStore from "../device-manager/config-editor/configEditorPageStore";

// Reuse the serial editor's schema, validation and complete-config serialization.
// The live MQTT id is matched exactly; names and Modbus addresses are not unique.
export default class DeviceInstallerStore {
  constructor({
    serialProxy,
    configEditorProxy,
    fwUpdateProxy,
    serialDeviceProxy,
    serialPortProxy,
  }) {
    this.proxies = {
      serialProxy,
      configEditorProxy,
      fwUpdateProxy,
      serialDeviceProxy,
      serialPortProxy,
    };
    this.editor = null;
    this.baselineSnapshot = null;
    this.loading = false;
    this.loaded = false;
    this.isSaving = false;
    this.loadError = "";
    this.saved = false;
    this.disposed = false;
    this.matches = [];
    this.contentLoads = new WeakMap();
    makeObservable(this, {
      editor: observable.ref,
      baselineSnapshot: observable.ref,
      pendingChanges: computed,
      loading: observable,
      loaded: observable,
      isSaving: observable,
      loadError: observable,
      saved: observable,
      matches: observable.shallow,
      isDirty: computed,
      allowSave: computed,
      error: computed,
      openDevice: action,
      readRegisters: action,
      save: action,
    });
  }

  get isDirty() {
    return !!this.editor?.isDirty;
  }

  get pendingChanges() {
    return this.isDirty ? configDiff(this.baselineSnapshot, this.editor.makeConfigJson()) : [];
  }

  getPollingChannel(deviceId, controlId) {
    const schema = this.getDeviceMatch(deviceId)?.tab.schemaStore;
    if (!schema) return null;
    const matches = [];
    const visit = (group) => {
      group.channels.forEach((channel) => {
        if ((channel.channel.mqtt_id || channel.channel.name) === controlId) matches.push(channel);
      });
      group.subgroups.forEach(visit);
    };
    visit(schema.topLevelGroup);
    return matches.length === 1 ? matches[0] : null;
  }

  get allowSave() {
    return (
      !this.loading &&
      !this.isSaving &&
      !!this.editor?.allowSave &&
      !this.matches.some(({ tab }) => tab.isLoading)
    );
  }

  get error() {
    return this.loadError || this.editor?.pageWrapperStore.error || "";
  }

  getDeviceMatches(deviceId) {
    return this.matches.filter(
      (match) => match.id === deviceId || match.tab.mqttId === deviceId,
    );
  }

  getDeviceMatch(deviceId) {
    const matches = this.getDeviceMatches(deviceId);
    if (matches.length !== 1) return null;
    const match = matches[0];
    return {
      ...match,
      portName: match.port.name,
      portPath: match.port.path,
      address: match.tab.slaveId,
      deviceType: match.tab.deviceType,
      typeName:
        match.tab.deviceTypesStore.getName(match.tab.deviceType) ||
        match.tab.deviceType,
      enabled: match.port.isEnabled && match.tab.editedData.enabled !== false,
    };
  }

  _disposeEditor() {
    this.editor?.tabs.portTabs.forEach((port) => {
      port.reactionDisposers.forEach((dispose) => dispose());
      port.children.forEach((tab) =>
        this.editor.tabs.uniqueMqttIdChecker.removeTab(tab),
      );
    });
  }

  async reload() {
    if (this.loading || this.isSaving || this.disposed) return;
    runInAction(() => {
      this.loading = true;
      this.loaded = false;
      this.loadError = "";
      this.saved = false;
      this._disposeEditor();
      this.matches = [];
      this.editor = null;
      this.contentLoads = new WeakMap();
    });
    const {
      serialProxy,
      configEditorProxy,
      fwUpdateProxy,
      serialDeviceProxy,
      serialPortProxy,
    } = this.proxies;
    let baseline;
    const loadConfig = async () => {
      const response = await serialProxy.Load({ lang: i18n.language });
      baseline = cloneDeep(response.config);
      return {
        config: response.config,
        schema: response.schema,
        deviceTypeGroups: response.types,
      };
    };
    const saveConfig = async (config) => {
      // The backend has no compare-and-swap API. Refuse a stale whole-file write.
      const current = await serialProxy.Load({ lang: i18n.language });
      if (!isEqual(current.config, baseline)) {
        throw new Error(
          i18n.t("devices.installerSettings.conflict", {
            defaultValue: i18n.language.startsWith("ru")
              ? "Конфигурация изменена в другом окне. Сохранение отменено. Скопируйте свои изменения, затем загрузите конфигурацию заново."
              : "Configuration changed in another window. Save was cancelled. Copy your changes, then reload the configuration.",
          }),
        );
      }
      await configEditorProxy.Save({
        path: "/usr/share/wb-mqtt-confed/schemas/wb-mqtt-serial-dummy.schema.json",
        content: config,
      });
      baseline = cloneDeep(config);
      runInAction(() => { this.baselineSnapshot = cloneDeep(config); });
    };
    const editor = new ConfigEditorPageStore(
      loadConfig,
      saveConfig,
      () => {},
      () => {},
      new DeviceTypesStore(async (type) => {
        try {
          return await serialProxy.GetSchema({ type });
        } catch (error) {
          throw new Error(
            error.message + (error.data ? ": " + error.data : ""),
          );
        }
      }),
      fwUpdateProxy,
      serialDeviceProxy,
      serialPortProxy,
    );
    await editor.load();
    runInAction(() => {
      this.editor = editor;
      if (this.disposed) {
        this._disposeEditor();
        return;
      }
      this.loaded = editor.loaded;
      this.baselineSnapshot = cloneDeep(baseline);
      this.matches = editor.tabs.portTabs.flatMap((port) =>
        port.children.map((tab) => ({ id: tab.mqttId, tab, port })),
      );
      this.loading = false;
    });
  }

  async openDevice(deviceId) {
    this.saved = false;
    const match = this.getDeviceMatch(deviceId);
    if (!match || this.disposed) return;
    // Selecting a native port-tree tab also reads physical registers. Load just
    // the template here; register reads remain an explicit installer action.
    this.editor.tabs.selectedTabIndex = this.editor.tabs.items.indexOf(
      match.tab,
    );
    if (!this.contentLoads.has(match.tab)) {
      this.contentLoads.set(match.tab, match.tab.loadContent());
    }
    await this.contentLoads.get(match.tab);
    if (!match.tab.schemaStore) this.contentLoads.delete(match.tab);
  }

  async readRegisters(deviceId) {
    const match = this.getDeviceMatch(deviceId);
    if (
      !match ||
      !match.enabled ||
      match.tab.isDirty ||
      this.isSaving ||
      this.disposed
    )
      return;
    this.saved = false;
    await match.tab.loadContent(match.port.baseConfig, true);
  }

  async save() {
    if (!this.allowSave || this.disposed) return;
    this.saved = false;
    this.isSaving = true;
    try {
      await this.editor.save();
      runInAction(() => {
        this.saved = !this.editor.pageWrapperStore.error;
      });
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }

  async discardChanges() {
    await this.reload();
  }

  dispose() {
    this.disposed = true;
    this._disposeEditor();
  }
}
