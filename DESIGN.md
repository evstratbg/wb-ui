---
name: "Wiren Board UI concept"
description: "Operate mode: the complete controller interface in the established WB identity."
colors:
  primary: "#568d2d"
  primary-hover: "#477825"
  link: "#4d8427"
  brand: "#5cb300"
  canvas: "#f4f6f3"
  surface: "#fff"
  surface-tinted: "#eef2eb"
  surface-hover: "#f8faf6"
  row-hover: "#f6f9f2"
  ink: "#243029"
  muted: "#67736b"
  border: "#e0e6df"
  input-border: "#d8e2d2"
  navigation: "#202722"
  navigation-active: "#384c2e"
  navigation-hover: "#303c2d"
  navigation-text: "#c7d0c8"
  danger: "#dc3545"
  warning: "#eebc40"
  chart-line: "#78a84e"
  dark-canvas: "#171d19"
  dark-surface: "#222b23"
  dark-ink: "#e0e9dd"
  dark-muted: "#a2b09d"
  dark-border: "#3b4938"
  dark-primary: "#78ad49"
typography:
  display:
    fontFamily: "Roboto, sans-serif"
    fontSize: "29px"
    fontWeight: 500
    lineHeight: 1.2
  headline:
    fontFamily: "Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-.65px"
  title:
    fontFamily: "Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  body:
    fontFamily: "Roboto, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  label:
    fontFamily: "Roboto, sans-serif"
    fontSize: "12px"
  field-label:
    fontFamily: "Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
  mono:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "11px"
rounded:
  small: "4px"
  control: "7px"
  menu: "8px"
  panel: "10px"
  card: "12px"
  dialog: "14px"
spacing:
  tight: "4px"
  compact: "8px"
  field: "16px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "38px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "38px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
    height: "38px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 18px 16px"
  navigation-item-active:
    backgroundColor: "{colors.navigation-active}"
    rounded: "{rounded.control}"
    padding: "12px"
  model-tag:
    textColor: "{colors.muted}"
    rounded: "{rounded.small}"
    padding: "4px 6px"
---

# Design System: Wiren Board UI concept

## Overview

**Creative North Star: "Operate mode"**

A restrained technical workspace for operating a controller. The original WB logo, Roboto, green actions and dark navigation carry the identity; pale green neutrals and white work surfaces organize dense information. Typography, borders and spacing establish hierarchy across the overview and native editors.

This records the implemented fork of homeui v2.208.1-wb100. It is an independent UI proposal. Its visual authority is the built application, including retained native widgets and editors, rather than a new decorative style for their contents.

**Key Characteristics:**

- Recognizable WB identity and technical terminology.
- Persistent dark navigation beside a light workspace.
- Quiet bordered surfaces, compact controls and readable telemetry.
- Shared treatment across AngularJS and React screens.

Source: `frontend/src/components/navigation/concept-shell.css`, `frontend/app/styles/concept.css`, `frontend/src/pages/overview/styles.css`, and native component styles. Supplied desktop, mobile, device manager, SVG editor and chart screenshots confirm these patterns. Frontmatter records extracted values; source CSS custom properties remain the runtime authority.

The installer Devices workspace extends this same system. Its catalog, device header, channel disclosures, settings, history and diagnostics are evidenced by `frontend/src/pages/devices/` and reuse native controls and editors.

## Colors

Muted greens provide the action accent; green-tinted neutrals support longer technical tasks.

### Primary

- **Controller Green** (`primary`): filled actions, checked controls and active field borders; `primary-hover` deepens the same role.
- **Link Green** (`link`): text navigation and quiet actions.
- **WB Brand Green** (`brand`): retained identity assets; preserve the original logo artwork.
- **History Green** (`chart-line`): thin, continuous telemetry traces.

### Neutral

- **Pale Workspace** (`canvas`), **White Surface** (`surface`) and **Tinted Surface** (`surface-tinted`): page, card and inset layers.
- **Hover Wash** (`surface-hover`, `row-hover`): secondary controls, table rows and subtle form grouping.
- **Controller Ink** (`ink`) and **Muted Ink** (`muted`): primary text versus supporting text, units and chart axes.
- **Soft Divider** (`border`) and **Field Border** (`input-border`): structure and editable boundaries.
- **Dark Navigation** (`navigation`), **Selected Navigation** (`navigation-active`), **Navigation Hover** (`navigation-hover`) and **Navigation Text** (`navigation-text`): shell hierarchy.

### Semantic states and themes

Retain native danger and warning colors, notices and validation markers. Danger remains red for destructive actions; success and connection states use the green vocabulary with a text label or existing icon. Do not derive status solely from the page accent.

The `dark-*` tokens capture the implemented dark workspace. Use existing variables such as `--content-background`, `--text-color`, `--primary-color`, `--danger-color` and their native theme overrides in components. Preserve the original theme mechanism and its variables; do not hardcode the light palette into native forms or editors. Navigation remains dark in the implemented shell.

**The Theme Continuity Rule.** New controls inherit the established semantic CSS variables and native state meanings.

**The Evidence in State Rule.** Distinguish interface connection, received channel errors, missing data and configuration conflicts in text. Missing channels, an empty journal or the absence of reported errors does not establish physical device health. Preserve these distinctions in labels and empty states.

## Typography

**Display and body font:** locally bundled Roboto, with sans-serif fallback. **Technical font:** the existing monospace stack for identifiers, logs and code.

- **Display:** large tabular telemetry, with smaller units on the baseline. Mobile readings reduce to (25px); uptime uses a smaller separate size.
- **Headline:** desktop page titles; steps down to (23px) at the native (900px) breakpoint and (22px) at (640px).
- **Title:** compact section and panel headings. Native card titles use (14px); dialog titles use (18px).
- **Body and field labels:** dense operational text and form controls; supporting form descriptions use (12px) with (1.6) line height.
- **Label:** supporting metadata and chart labels. Navigation uses (13px); small subnavigation and table headings use (11px). Compact identity tags use (10px).

**The Readable History Rule.** Preserve chart axes and summary text at (12px) at narrow widths. Reduce tick count when space is limited; do not shrink the labels with the plot. Use tabular numerals for readings and summaries.

## Layout

Desktop uses a full-height sidebar (232px), an optional compact sidebar (72px), and a fixed context bar with a minimum height of (76px). The main workspace normally has padding (100px 34px 24px); horizontal padding reduces to (24px) at (1200px) and expands to (46px) at (1550px).

At (768px) and below, navigation becomes a (64px) dark header with the original logo, menu button and connection state. Its dismissible drawer is (264px) wide. The context bar is hidden; content padding becomes (22px 19px 24px), then (20px 15px) below (420px).

The overview places a flexible main column beside a (300px) supporting column with a (24px) gap. It becomes one column at (980px); supporting cards briefly form two columns, then stack at (640px). Four telemetry cells become a two-by-two grid. Toolbars wrap, native form columns stack and editor panes retain their working space. Tables keep horizontal scrolling when their contents require it.

Use the observed compact spacing rhythm for controls and the larger field/panel spacing for grouping. Preserve native widget sizing and editor-specific layouts rather than forcing every route into the overview grid.

The Devices workspace uses a catalog beside the selected device: a (240px) catalog and flexible detail column with a (22px) gap. At (1200px) the catalog reduces to (205px) and the gap to (16px). At (1000px) and below, the selected device fills the width and the catalog/search toolbar is hidden until Back returns to the list. At (640px), catalog rows become compact stacked summaries, tabs remain horizontal, identity facts wrap and diagnostics facts become one column. Settings context and save actions stack at (767px). These are Devices-specific adaptations, not replacements for the shell or overview breakpoints.

## Elevation & Depth

Borders and tonal layers do most of the structural work. Native cards have an almost imperceptible resting shadow (`0 2px 3px #24302903`); overview panels are flat. Selected segments use a small lift (`0 1px 3px #24311a15`). Menus use `0 8px 28px #24302914`; schema popovers use `0 10px 32px #2430291a`; dialogs use `0 18px 70px #15210c33` above a dark translucent overlay.

Focus is functional depth: shared fields use a green border and a three-pixel ring made from (12%) primary color. Shared buttons and tabs use a two-pixel outline with a three-pixel offset; shell links use the existing three-pixel focus outline. State transitions are short (140ms ease) for native controls. The built reduced-motion rule removes transitions and animation.

**The Quiet Surface Rule.** Use borders and tone for resting structure; reserve substantial shadow for floating menus and dialogs.

## Shapes

Gently rounded rectangles connect the interface: small tags, controls, menus, overview panels, native cards and dialogs use the corresponding frontmatter radii. Borders are generally one pixel. Native cards keep divided headers and bodies; clipped editor content, SVG artwork and technical diagrams retain their own geometry. Circular status dots and the existing compact switch track remain exceptions to the rectangular form language.

## Components

### Buttons

Compact, explicit actions. Primary buttons use Controller Green with white text, secondary buttons use a white surface and field border, and danger buttons retain native red. Medium React controls use the frontmatter size; large controls are at least (42px) high and small controls are (31px). Legacy buttons keep their native size variants within the shared visual treatment. Hover changes color and border; disabled native controls retain their existing muted/opacity state. Preserve visible keyboard focus.

### Inputs / Fields

White or theme-provided surfaces, a field border and a control radius. Medium inputs are (38px) tall. Use the established green focus border/ring, muted read-only background, red invalid border and native inline error text. Labels sit above fields; help text follows them. Preserve native pending-change and invalid-register markers.

### Cards / Containers

Native cards use the card radius, thin divider and compact title; header padding is (16px 18px), body padding (12px 18px 16px). Overview containers use the panel radius with (22px) internal horizontal padding, reducing to (16px) on mobile. Keep divided headers, telemetry cells and list rows where the existing component uses them.

### Navigation

Dark shell, pale text and restrained icons. Selected rows use the green-tinted dark active surface; hover uses a distinct lighter dark surface. Main rows have a control radius and a minimum height of (43px), rising to (45px) in the mobile drawer. Subnavigation is smaller and indented. Retain original WB logo proportions and the separate controller/connection identity.

Horizontal content tabs use a two-pixel green underline; vertical tabs and trees use a tinted selected surface. Preserve selection and validation state independently.

### Tags and segmented controls

Model tags are small outlined rectangles, with muted text and a small radius. Segmented chart controls sit in a tinted outlined track with a control radius; a selected segment uses a white surface, green text and the small selection shadow. Keep real pressed state and keyboard focus visible.

### Tables, dialogs and editors

Tables use tinted heading rows, fine dividers, muted headings and a subtle hover wash; narrow screens preserve usable columns through scrolling. Dialogs use the largest radius, an explicit title, divided action footer and overlay depth. Native SVG panels, code editors, bindings, device trees and configuration forms remain native working surfaces with the shared surrounding controls and spacing.

### History chart

A thin green trace, soft horizontal grid, readable axes, current reading, range controls and text summary. The plot fills available width; axis text remains at its fixed readable size. Units and minimum/maximum values stay distinct from labels. Preserve native loading, empty and error messages rather than drawing fabricated telemetry.

### Device workspace and technical disclosure

The catalog and detail panel use the existing panel radius, semantic surface variables and thin borders. Selection is a subtle primary-color tint; a visible outline remains distinct from selection. Names lead, MQTT identifiers use small muted technical text, and status combines words with a small dot. The device header persists above Channels, Settings, History and Diagnostics; Settings retains the native schema editor, labels, conditions and validation.

Channel groups use keyboard-operable disclosures with a drawn chevron, compact heading, count and divider. Controls, inputs and measurements open first; counters and technical channels are initially collapsed and open when searching. Shared channel controls keep their native behavior. Immediate writes are explained beside the controls; configuration saving has a separate, explicit footer with whole-draft scope. Secondary diagnostic facts and maintenance actions remain subordinate without obscuring warnings.

## Do's and Don'ts

### Do:

- **Do** preserve the original WB logo, Roboto and green identity.
- **Do** use semantic theme variables across new and native controls.
- **Do** retain visible focus, validation, disabled and connection states.
- **Do** keep readings tabular, units subordinate and chart axes readable on mobile.
- **Do** wrap toolbars and stack forms while preserving editor and table usability.

### Don't:

- **Don't** replace the WB identity or recolor native SVG content to match the shell.
- **Don't** make destructive actions look like ordinary green actions.
- **Don't** hardcode light colors where existing semantic theme variables apply.
- **Don't** shrink chart labels with the plot or remove native status/error information.
- **Don't** add decorative elevation or motion absent from the implemented system.
