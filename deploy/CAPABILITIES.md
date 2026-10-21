# Native capability and verification checklist

Scope: installed Wiren Board frontend `2.208.1-wb100`, exact source commit `0546d10e7ade2894baa5a828549900b708ca52a8`. All paths below are hash routes on the replacement's own port 8080, prefixed by `/#!/`. They must remain in the new frontend rather than navigating to port 80 or embedding it.

The installer workspace was built and installed on WB7, port 8080, release `20261021T084124Z`. Local checks pass: 114/114 tests in 9 suites and production build with two baseline bundle-size warnings and no CSS-order warning. `tsc --noEmit` reports exactly the same 31 upstream errors as the baseline. Remote results are available per revision in [GitHub Actions](https://github.com/evstratbg/wb-ui/actions/workflows/ci.yml). The table remains a verification checklist, not a claim that every hardware operation has been tested.

After deployment nginx is active, both ports 80 and 8080 return HTTP 200, and the active index checksum matches the local build. Serial and Web UI configuration checksums are identical before and after verification.

Live browser checks covered all four device tabs at widths 1440, 544 and 390 px without horizontal overflow: correct serial settings/port/address, controls before technical channels (collapsed), real points for a selected channel, firmware/bootloader versions, an honest empty filtered journal and 20 real unfiltered entries. Search URL and Back retained context. A local address draft survived device/tab changes; cancelling navigation retained it, and explicit discard reloaded the controller configuration. No configuration Save, actuation, discovery scan, firmware, network or user changes were performed. Automated tests cover Save failures/stale checks, duplicate/custom MQTT IDs, roles, portalled-dropdown edit locks and a 15-minute browser/controller clock difference.

| Capability | Native route | Read-only verification |
| --- | --- | --- |
| Home/default panel | `/` | Honors configured default text/SVG dashboard; links keep port 8080. New live overview is `/overview`. |
| Login/logout | `/login` | Native login form and same-host session reuse; verify a session in a separate browser context. |
| Device catalog/workspace | `/devices?search=&device=&tab=&filter=&channel=` | Search, filters, exact MQTT ID, port/address for admin, configured devices without runtime channels, and duplicate/unmatched IDs render honestly. Search, device, tab, filter and history channel survive direct links, reload and Back. Leave switches, ranges and buttons unchanged. |
| Grouped device channels | `/devices?device=<mqtt-id>` | Writable controls appear first, then inputs/measurements; technical channels start collapsed. In-device search and channel history links work. Grouping uses channel types, write access and names; no native group metadata exists. |
| Device settings | `/devices?device=<mqtt-id>&tab=settings` | Admin gets the uniquely matched serial schema, port/address, validation and draft state. Operator must not load port configuration or receive settings/firmware details. Open/read-only inspection must not read physical registers, save, discard a working draft or start a firmware update. |
| Device history | `/devices?device=<mqtt-id>&tab=history&channel=<cell-id>` | Only the chosen device's channels appear; numeric/boolean history loads through native HistoryProxy. Channel links preserve context; full native history remains available for comparison/export. |
| Device diagnostics | `/devices?device=<mqtt-id>&tab=diagnostics` | Device-level and channel errors render. Port/address and already received firmware/bootloader versions are admin-only. Journal loads on explicit request: up to 20 literal MQTT ID matches or unfiltered driver entries, clearly labelled. No physical last-response time is claimed. |
| Text dashboard list/editor | `/dashboards` | Existing panels, add/edit dialog, default/ordering controls render. Cancel without saving. |
| Text dashboard | `/dashboards/dashboard1` | Original widgets, channel labels, readonly/inversion settings, live readings and edit dialog render. Cancel edits. |
| Widgets editor | `/dashboards/widgets` | Existing widgets and cell selection/edit dialogs render. Cancel add/edit/delete. |
| SVG dashboard | `/dashboards/svg/view/dashboard2` | Existing SVG renders inside the page, read/style/visibility bindings update; do not click actuator-bound SVG objects. |
| SVG create | `/dashboards/svg/add` | Native upload/create dialog and editor are available; leave without saving. |
| SVG edit | `/dashboards/svg/edit/dashboard2` | Existing SVG, visual bindings editor, code editor, element selection and preview render. Cancel without saving. |
| History | `/history` and `/history/<sample>` | Existing channels, dates, multiple series, zoom/range and real historical data load. |
| Configuration list | `/configs` | Native configuration schema list loads from confed. |
| Configuration editor | `/configs/edit/<encoded-schema-path>` | Existing schema values, groups, conditional parameters and validation render; do not save. |
| Serial/Modbus devices | `/serial-config` | Ports and existing modules, device/channel configuration, firmware information and editor tabs load. |
| Serial properties | `/serial-config/properties` | Existing properties tab and parameters render; do not apply port/address settings. |
| Serial discovery | `/serial-config/scan` | Capability exists in the router and native scan components. Do not trigger discovery during read-only smoke. |
| Network connections | `/network-connections` | Existing interface status and native edit dialog load; do not toggle, activate, save or delete connections. |
| Rules list | `/rules` | Native list, status and console controls render; do not enable/disable rules. |
| Rule editor | `/rules/edit/<rule-path>` | Open an existing rule and inspect source/console inside the replacement; leave without saving. |
| New rule | `/rules/new` | Native code editor and fields render; cancel without creating. |
| Logs | `/logs` | Service list, existing journal entries, date/severity/search filters load. |
| System/maintenance | `/system` | Cloud status, installed firmware information, native upload/update/reset and backup/diagnostic controls render. Do not upload firmware, reset, generate backup/diagnostics or reboot. |
| Web UI settings | `/web-ui` | Language/theme/system-device visibility, MQTT settings and common dashboard settings are present; inspect without saving. |
| MQTT channels | `/MQTTChannels` | Topic/channel metadata, values and filter tools load; do not publish or delete retained values. |
| Users/access | `/access-level` | Existing user list, roles, password/user dialogs and HTTPS settings render; cancel all changes. |
| Modbus gateway | `/mbgate` | Existing gateway configuration and mapping editor render; do not save. |
| DALI | `/dali` | Native gateway/bus/device tree loads or reports the existing unavailable/no-gateway state; do not scan, identify, reset or change light values. |
| Yandex Alice | `/integrations/alice` | Current integration/link state and existing devices/rooms load; do not link/unlink, enable/disable client or save mappings. |
| KNX | `/configs`, `/devices` | Installed version has no separate `/knx` route. KNX schema/settings are in the config editor; KNX runtime channels appear in devices. |
| Scenarios/custom menu | Dynamic `/ui/menu` entries | Runtime custom menu is merged; this installation supplies the scenarios schema route and Alice. Open schema without saving. |
| Help | `/help` | Native help page and external documentation links render. |
| HMI/fullscreen | Existing dashboard routes with `hmi`, `hmicolor`, `fullscreen` parameters | Native layout modes render on the same port without losing dashboard parameters. |
| Shared assets | `/uploads/`, `/diag/`, `/images/` | Existing server assets resolve through the proxy; do not generate diagnostic archives solely to test delivery. |

Router aliases `/scan` and `/widgets` redirect to the native serial configuration and widget routes. The exact installed bundle exposes 31 ui-router states, including aliases, nested properties/scan states and history samples.

Device routes use dynamic query parameters and retain one serial-configuration draft across device/tab changes. No autosave occurs; reload does not restore the draft. Save uses the native schema/validation and writes the entire `wb-mqtt-serial` configuration, including other devices' edits. Discard reloads and drops the complete draft. A pre-save reload rejects changes made since the baseline, but the backend has no atomic compare-and-swap and a check/write race remains. Register reads require a separate confirmed action; the full native port editor remains at `/serial-config`.

Exact MQTT ID matching does not infer identity from display names or Modbus addresses. Duplicate IDs block unique settings selection. Unmatched MQTT devices may be system/virtual devices or belong to another driver; system visibility still follows native Web UI settings. MQTT connectivity describes the UI-to-controller connection, and retained values or absence of errors do not prove the physical device is online. Journal filtering is a literal substring match, and driver messages may omit the ID.

The upstream startup code sends `wb-device-manager/bus-scan/Stop` when an admin first connects. That stops an active discovery scan and is existing native behavior. Clicking Add Wiren Board Device or Search Disconnected starts discovery automatically; those actions are outside a read-only smoke. No physical actuation, firmware/network changes, or configuration saves are needed to verify rendering and data integration.

Native transport coverage:

| Transport | Existing endpoints or RPC services |
| --- | --- |
| Session/auth | HTTP `/auth/who_am_i`, `/auth/login`, `/auth/logout`, `/auth/users` and user-id suffixes. |
| Controller/HTTPS | HTTP `/device/info`, `/api/check`, `/api/https`, `/api/https/request_cert`, `/ui/menu`. |
| Integration | HTTP `/api/integrations/alice` with availability/link-status/link/room/device/client/unlink endpoints. |
| Maintenance | HTTP `/fwupdate/download/{rootfs,configs,everything}`, `/fwupdate/upload`, `/fwupdate/factoryreset`, `/fwupdate/progress`; `/diag/<archive>`. |
| MQTT | WebSocket `/mqtt`, retaining stock role-aware backend routing; live controls and service metadata remain native. |
| Dashboards/configs | MQTT `confed/Editor` List/Load/Save. Runtime configuration stays `/etc/wb-webui.conf`. |
| Rules | MQTT `wbrules/Editor` List/Load/Save/Remove/Rename/ChangeState. |
| History/logs | MQTT `db_logger/history` get_values; `wb_logs/logs` List/Load/CancelLoad. |
| Serial devices | MQTT `wb-mqtt-serial/config` Load/GetSchema; complete serial configuration saved by `confed/Editor` Save; `wb-mqtt-serial/device` LoadConfig; `wb-mqtt-serial/port` Setup; `wb-device-manager/bus-scan` Start/Stop. |
| Peripheral firmware | MQTT `wb-mqtt-serial/fw-update` GetFirmwareInfo/Update/ClearError/Restore. |
| DALI | MQTT `wb-mqtt-dali/Editor` Get/Set gateway, bus, device and group; scan/identify/reset methods. |
| Diagnostics | MQTT `diag/main` status/diag, artifact notifications under `/wb-diag-collect/artifact`. |

This fork retains the installed APIs rather than using newer upstream backend additions. Current master `2.269.0` has a different router and `/api/dashboards`, `/api/fonts`, `/api/terminal` APIs that are absent from this installed backend.
