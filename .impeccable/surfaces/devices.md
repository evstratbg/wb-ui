# Devices: installer workspace

Mode: Operate. Target: `frontend/src/pages/devices/devices.tsx`.

The primary user is an installer connecting, configuring and diagnosing devices. Keep the established WB identity and semantic theme tokens. This is a workflow extension, not a new visual identity.

Search a device once, open it, then switch between Channels, Settings, History and Diagnostics in one context. Match configured modules by their authoritative MQTT ID; never guess from a name or Modbus address. Configured modules without runtime channels remain discoverable. Ambiguous IDs show a conflict, and non-serial MQTT devices retain their available data without invented hardware settings.

Desktop: compact catalog beside a device workspace. Mobile and narrow panels: the device fills the width; Back returns to the same search and filter. Query parameters preserve device, tab, search, filter and history channel. Internal navigation retains one serial configuration draft. External navigation and page refresh retain the existing dirty-state guard.

Implemented layout: a 240px catalog and flexible detail column with a 22px gap; at 1200px the catalog reduces to 205px with a 16px gap. At 1000px and below the selected card occupies the full width and hides the catalog/search toolbar. At 640px catalog rows stack, identifiers wrap, identity facts use two columns and diagnostic facts use one column. Settings context and save actions stack at 767px. These surface-specific breakpoints coexist with the unchanged WB shell.

Channels put writable controls first, then inputs and measurements, with technical counters below a disclosure. Actions label direct writes. History and diagnostics read real services; diagnostic journal loading is explicit and bounded. Settings reuse native templates, conditions and validation, with explicit save/discard and whole-file scope. Opening a card must never scan, configure a port, update firmware, publish a control value or save configuration.

State language is evidence-bound: “No errors reported”, “No channels received” and “MQTT ID conflict” describe different conditions. Interface MQTT connection is separate from physical device health. Previously received values remain identified during disconnection and writes are disabled. The journal loads up to 20 entries on request, labels filtered versus general scope and does not treat an empty response as proof of health. Version fields show only received information. Native semantic theme variables, fonts, field states and editors remain authoritative; no additional palette or typography system is introduced.

Acceptance: correct settings in one action after opening a device; direct-link reload and browser Back; custom/duplicate IDs; runtime-only and configured-only devices; roles; all four tabs at 1440, 544 and 390 px. Validate write behavior on fixtures. Do not actuate physical outputs or save operational configuration during browser checks.
