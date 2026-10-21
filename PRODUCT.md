# Wiren Board UI concept

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Full fork of official homeui v2.208.1-wb100, commit 0546d10e7ade2894baa5a828549900b708ca52a8, matching the installed frontend. Existing AngularJS routing/services, React 18 pages/editors and Webpack build remain. Static production files run through nginx; no Node runtime on WB.

## Users
Primary audience: installers connecting, configuring and diagnosing devices. Secondary audience: installation owners and Wiren Board maintainers evaluating the proposal.

## Product Purpose
A complete alternative to the installed UI, with all configuration and editor capabilities inside the new interface on its own port. The next workflow phase prioritizes installer commissioning and diagnosis. The user's correction explicitly rules out a landing page with links to the standard UI.

## Operating Context
Validated on a WB7 controller in a local network. Source matches installed homeui 2.208.1-wb100 and existing backend. Port 8080; deployment assets live on /mnt/data. Port 80 remains an independent fallback during evaluation.

## Capabilities and Constraints
All native routes and functionality are retained: dashboards and widgets, SVG view/edit/bindings, devices and Modbus ports, configuration schemas, network, rules/editor/console, full history, journals, users/roles, system/firmware/backups/diagnostics, MQTT channels, DALI and installed integrations/custom menu. New live overview, pinning and device/channel search use native stores and transport. All product sections stay in this frontend; no iframe or links to the old frontend for operations.

Read-only browser verification and isolated tests must not actuate hardware, save operating configuration, change network credentials or users, start bus scans, update firmware or reset/reboot. Keep original permissions and backend checks. No controller or account credentials in deliverable files.

## Brand Commitments
Recognizable WB identity: original logo, Roboto, green accents, dark navigation and technical terminology. Unified spacing, hierarchy and controls across native editors. Existing theme variables and development themes are preserved. Independent proposal, not an official WB release.

## Evidence on Hand
Authenticated live controller, exact upstream source tag, retained MQTT values, existing panels/configuration, native HTTP and MQTT-RPC capabilities. No synthetic production telemetry.

## Product Principles
- Preserve full native capability and role enforcement.
- Keep task context inside one interface.
- State, edits, pending operations and errors must be distinguishable.
- Retain low runtime overhead on the controller.
