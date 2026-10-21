import { observer } from "mobx-react-lite";
import { useEffect, useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Confirm } from "@/components/confirm";
import { OptionalParamsSelectDialog } from "@/components/json-schema-editor/optional-params-select-dialog";
import { Loader } from "@/components/loader";
import { DeviceSettingsEditor } from "@/pages/settings/device-manager/components/device-settings-editor";
import { ReadRegistersState } from "@/stores/device-manager";
import { uiStore } from "@/stores/ui";
import type DeviceInstallerStore from "~/react-directives/devices/device-installer-store";
import "./device-settings.css";

export const DeviceSettings = observer(
  ({
    installer,
    deviceId,
  }: {
    installer?: DeviceInstallerStore;
    deviceId: string;
  }) => {
    const { t, i18n } = useTranslation();
    const [dialog, setDialog] = useState<
      "parameters" | "discard" | "read" | null
    >(null);
    const text = (key: string, ru: string, en: string) =>
      t(`devices.installerSettings.${key}`, {
        defaultValue: i18n.language.startsWith("ru") ? ru : en,
      });
    const loaded = installer?.loaded;
    const isEditingDisabled = installer?.isSaving || !uiStore.isConnected;
    // react-select menus are portalled outside the disabled fieldset. React
    // capture events still follow this tree, so freeze those editors as well.
    const preventUnavailableEdit = (event: SyntheticEvent) => {
      if (installer?.isSaving || !uiStore.isConnected) {
        // Let Tab move focus, without allowing react-select to commit an option.
        if (!("key" in event && event.key === "Tab")) event.preventDefault();
        event.stopPropagation();
      }
    };
    useEffect(() => {
      setDialog(null);
      if (loaded) installer?.openDevice(deviceId);
    }, [installer, loaded, deviceId]);

    if (!installer) {
      return (
        <Alert variant="info">
          {text(
            "adminOnly",
            "Настройки устройства доступны администратору.",
            "Device settings are available to administrators.",
          )}
        </Alert>
      );
    }
    if (installer.loading || (!loaded && !installer.error)) {
      return (
        <div className="installerSettings-loading" role="status">
          <Loader />
          {text("loading", "Загрузка конфигурации…", "Loading configuration…")}
        </div>
      );
    }
    const matches = installer.getDeviceMatches(deviceId);
    const match = installer.getDeviceMatch(deviceId);
    if (!match) {
      return (
        <div className="installerSettings">
          {installer.error && <Alert variant="danger">{installer.error}</Alert>}
          {matches.length > 1 ? (
            <Alert variant="warn">
              {text(
                "ambiguous",
                "Один MQTT ID задан нескольким устройствам. Однозначно открыть настройки нельзя:",
                "More than one configured device has this MQTT ID. Settings cannot be selected safely:",
              )}
              <ul>
                {matches.map(({ port, tab }, index) => (
                  <li key={index}>
                    {port.name} · {tab.name}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert variant="info">
              {text(
                "noConfig",
                "У этого MQTT-устройства нет отдельной настройки в wb-mqtt-serial. Его каналы, история и диагностика доступны в соседних вкладках.",
                "This MQTT device has no separate wb-mqtt-serial configuration. Its channels, history and diagnostics are available in the other tabs.",
              )}
            </Alert>
          )}
          {!loaded && (
            <Button
              variant="secondary"
              onClick={() => installer.reload()}
              label={text("retry", "Повторить загрузку", "Retry loading")}
            />
          )}
        </div>
      );
    }
    const tab = match.tab;
    const schema = tab.schemaStore;
    const canReadRegisters =
      match.enabled &&
      !tab.isUnknownType &&
      !tab.withSubdevices &&
      ![ReadRegistersState.Unsupported, ReadRegistersState.Disabled].includes(
        tab.readRegistersState.state,
      );
    return (
      <div
        className="installerSettings"
        onPointerDownCapture={preventUnavailableEdit}
        onClickCapture={preventUnavailableEdit}
        onKeyDownCapture={preventUnavailableEdit}
        onKeyUpCapture={preventUnavailableEdit}
      >
        <div className="installerSettings-context">
          <div>
            <strong>{match.typeName}</strong>
            <span>
              {match.portPath || match.portName} ·{" "}
              {text("address", "Адрес", "Address")} {match.address ?? "—"}
            </span>
          </div>
          <span>
            {text(
              "source",
              "Параметры из конфигурации контроллера",
              "Parameters from the controller configuration",
            )}
          </span>
        </div>
        {installer.error && <Alert variant="danger">{installer.error}</Alert>}
        {installer.saved && !installer.isDirty && (
          <Alert variant="success" role="status">
            {text("saved", "Конфигурация сохранена.", "Configuration saved.")}
          </Alert>
        )}
        {tab.error && <Alert variant="danger">{tab.error}</Alert>}
        {tab.slaveIdIsDuplicate && (
          <Alert variant="danger">
            {t("device-manager.errors.duplicate-slave-id")}
          </Alert>
        )}
        {!!tab.devicesWithTheSameId.length && (
          <Alert variant="danger">
            {t("device-manager.errors.duplicate-mqtt-topic", {
              device: tab.devicesWithTheSameId.join(", "),
              interpolation: { escapeValue: false },
            })}
          </Alert>
        )}
        {tab.readRegistersState.errorMessage && (
          <Alert
            variant={
              tab.readRegistersState.state === ReadRegistersState.Error
                ? "danger"
                : "warn"
            }
          >
            {tab.readRegistersState.errorMessage}
          </Alert>
        )}
        {!match.enabled && (
          <Alert variant="info">
            {text(
              "disabled",
              "Устройство или его порт отключены в конфигурации. Чтение параметров из устройства недоступно.",
              "The device or its port is disabled in the configuration. Reading device parameters is unavailable.",
            )}
          </Alert>
        )}
        <div className="installerSettings-toolbar">
          {schema && (
            <Button
              variant="secondary"
              label={t("device-manager.buttons.parameters")}
              aria-haspopup="dialog"
              disabled={tab.isLoading || installer.isSaving}
              onClick={() => setDialog("parameters")}
            />
          )}
          {canReadRegisters && (
            <Button
              variant="secondary"
              label={text(
                "read",
                "Прочитать параметры из устройства",
                "Read parameters from device",
              )}
              aria-haspopup="dialog"
              disabled={tab.isLoading || tab.isDirty || installer.isSaving}
              onClick={() => setDialog("read")}
            />
          )}
        </div>
        {canReadRegisters && tab.isDirty && (
          <p className="installerSettings-readHint">
            {text(
              "readDirty",
              "Перед чтением параметров сохраните или отмените изменения этого устройства.",
              "Save or discard this device’s changes before reading parameters.",
            )}
          </p>
        )}
        {tab.isLoading ? (
          <div className="installerSettings-loading" role="status">
            <Loader />
            {tab.loadingMessage}
          </div>
        ) : schema && tab.readRegistersState.allowEditSettings ? (
          <fieldset
            className="installerSettings-editor"
            disabled={isEditingDisabled}
            aria-busy={installer.isSaving}
          >
            <DeviceSettingsEditor
              store={schema}
              translator={schema.schemaTranslator}
            />
          </fieldset>
        ) : (
          <>
            <Alert variant="warn">
              {tab.isUnknownType
                ? t("device-manager.errors.unknown-device-type", {
                    type: tab.deviceType,
                  })
                : tab.withSubdevices
                  ? t("device-manager.errors.with-subdevices")
                  : text(
                      "unavailable",
                      "Редактор параметров недоступен для этого шаблона.",
                      "The parameter editor is unavailable for this template.",
                    )}
            </Alert>
            <pre className="installerSettings-json">
              {JSON.stringify(tab.editedData, null, 2)}
            </pre>
          </>
        )}
        <div className="installerSettings-savebar">
          <div>
            <strong>
              {installer.isDirty
                ? text(
                    "unsaved",
                    "Есть несохранённые изменения",
                    "There are unsaved changes",
                  )
                : text("unchanged", "Изменений нет", "No changes")}
            </strong>
            <span>
              {text(
                "saveHint",
                "Сохранение применяет черновик конфигурации wb-mqtt-serial. Изменения в других устройствах также сохранятся.",
                "Save applies the wb-mqtt-serial configuration draft, including changes to other devices.",
              )}
            </span>
            {installer.editor?.tabs.hasInvalidConfig && (
              <span className="installerSettings-invalid" role="status">
                {text(
                  "invalid",
                  "Исправьте ошибки конфигурации перед сохранением.",
                  "Fix configuration errors before saving.",
                )}
              </span>
            )}
          </div>
          <div className="installerSettings-saveActions">
            <Button
              variant="secondary"
              label={text("discard", "Отменить изменения", "Discard changes")}
              disabled={
                !installer.isDirty || installer.isSaving || tab.isLoading
              }
              aria-haspopup="dialog"
              onClick={() => setDialog("discard")}
            />
            <Button
              label={t("device-manager.buttons.save")}
              disabled={!installer.allowSave || tab.isLoading}
              isLoading={installer.isSaving}
              onClick={() => installer.save()}
            />
          </div>
        </div>
        {schema && (
          <OptionalParamsSelectDialog
            isOpened={dialog === "parameters"}
            store={schema.commonParams}
            translator={schema.schemaTranslator}
            onClose={() => setDialog(null)}
          />
        )}
        <Confirm
          isOpened={dialog === "discard"}
          heading={text(
            "discardTitle",
            "Отменить все изменения конфигурации?",
            "Discard all configuration changes?",
          )}
          acceptLabel={text("discard", "Отменить изменения", "Discard changes")}
          closeCallback={() => setDialog(null)}
          confirmCallback={async () => {
            setDialog(null);
            await installer.discardChanges();
          }}
        >
          {text(
            "discardHint",
            "Будет загружена текущая конфигурация контроллера. Несохранённые изменения всех устройств будут потеряны.",
            "The current controller configuration will be loaded. Unsaved changes to every device will be lost.",
          )}
        </Confirm>
        <Confirm
          isOpened={dialog === "read"}
          heading={text(
            "readTitle",
            "Прочитать параметры из устройства?",
            "Read parameters from device?",
          )}
          acceptLabel={text("readAccept", "Прочитать", "Read")}
          closeCallback={() => setDialog(null)}
          confirmCallback={async () => {
            setDialog(null);
            await installer.readRegisters(deviceId);
          }}
        >
          {text(
            "readHint",
            "Чтение обращается к устройству через его порт. Полученные значения появятся в черновике; запись конфигурации выполняется только кнопкой «Сохранить».",
            "Reading accesses the device through its port. Values are loaded into the draft; configuration is written only when you press Save.",
          )}
        </Confirm>
      </div>
    );
  },
);

export default DeviceSettings;
