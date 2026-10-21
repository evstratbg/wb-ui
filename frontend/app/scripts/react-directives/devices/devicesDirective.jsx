import { autorun, runInAction } from "mobx";
import ReactDOM from "react-dom/client";
import DevicesPage from "@/pages/devices";
import { authStore, UserRole } from "@/stores/auth";
import { formatError } from "@/utils/formatError";
import { setReactLocale } from "~/react-directives/locale";
import DeviceInstallerStore from "./device-installer-store";

export default function devicesDirective(
  $rootScope,
  whenMqttReady,
  SerialProxy,
  ConfigEditorProxy,
  FwUpdateProxy,
  SerialDeviceProxy,
  SerialPortProxy,
  HistoryProxy,
  LogsProxy,
  PageState,
  $state,
  $transitions,
) {
  "ngInject";

  setReactLocale();

  return {
    restrict: "E",
    scope: {},
    link(scope, element) {
      if (scope.root) {
        scope.root.unmount();
      }

      const installer = authStore.hasRights(UserRole.Admin)
        ? new DeviceInstallerStore({
            serialProxy: SerialProxy,
            configEditorProxy: ConfigEditorProxy,
            fwUpdateProxy: FwUpdateProxy,
            serialDeviceProxy: SerialDeviceProxy,
            serialPortProxy: SerialPortProxy,
          })
        : null;
      scope.root = ReactDOM.createRoot(element[0]);
      const render = () =>
        scope.root.render(
          <DevicesPage
            store={$rootScope.devicesStore}
            installer={installer}
            historyProxy={HistoryProxy}
            logsProxy={LogsProxy}
            route={{ ...$state.params }}
            onNavigate={(patch, { replace = false } = {}) =>
              $state.go("devices", patch, {
                inherit: true,
                location: replace ? "replace" : true,
              })
            }
          />,
        );
      render();
      const disposeTransition = $transitions.onSuccess(
        { to: "devices" },
        render,
      );
      const disposeDirty = autorun(() =>
        PageState.setDirty(installer?.isDirty || false),
      );
      if (installer) {
        whenMqttReady()
          .then(() => installer.reload())
          .catch((error) => {
            if (!installer.disposed)
              runInAction(() => {
                installer.loadError = formatError(error);
              });
          });
      }

      element.on("$destroy", () => {
        disposeTransition();
        disposeDirty();
        scope.root.unmount();
        installer?.dispose();
        PageState.setDirty(false);
      });
    },
  };
}
