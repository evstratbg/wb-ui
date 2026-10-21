import fs from 'fs';
import path from 'path';
import vm from 'vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';

const frontend = path.resolve(__dirname, '../../..');
const editor = 'src/pages/dashboards/svg/[slug]/edit';
function loadSource(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(frontend, relativePath), 'utf8');
  const code = transformSync(source, { loader: relativePath.endsWith('.tsx') ? 'tsx' : 'ts', format: 'cjs', target: 'es2022', jsx: 'automatic' }).code;
  const result = { exports: {} };
  vm.runInNewContext(code, {
    module: result, exports: result.exports,
    require: (name) => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (/\.(svg|css)$/.test(name)) return () => null;
      return require(name);
    },
    console,
  }, { filename: relativePath });
  return result.exports;
}

const dashboardModule = loadSource('src/stores/dashboards/dashboard.ts');
const svgModule = loadSource(`${editor}/stores/svg-store.ts`);
const paramModule = loadSource(`${editor}/stores/dashboard-svg-param.ts`);
const elementModule = loadSource(`${editor}/stores/svg-element-bindings-store.ts`);
const bindingsModule = loadSource(`${editor}/stores/bindings-store.ts`, {
  './dashboard-svg-param': paramModule,
  './svg-element-bindings-store': elementModule,
});
const { EditSvgDashboardPageStore } = loadSource(`${editor}/stores/store.ts`, {
  '@/stores/dashboards': dashboardModule,
  './bindings-store': bindingsModule,
  './svg-store': svgModule,
});

const legacyDashboard = () => ({
  id: 'dashboard2', name: 'Demo SVG Dashboard', widgets: [], isSvg: true,
  svg_fullwidth: false, svg_url: 'local', options: {},
  svg: {
    original: '<svg width="auto" height="80vh" viewBox="0 0 580 550"><text id="f1780d222b55" /></svg>',
    current: '<svg width="auto" height="80vh" viewBox="0 0 580 550"><text id="f1780d222b55" /></svg>',
    params: [{ id: 'f1780d222b55', read: { enable: true, channel: 'wb-adc/Vin', value: '"V in: " + val + " V"' }, write: { enable: false, channel: null, value: { on: 1, off: 0 } }, visible: { enable: false, channel: null, condition: '==', value: null }, style: { enable: false, channel: null, value: null } }],
  },
});
function makeEditor(config) {
  const dashboard = new dashboardModule.Dashboard(config, {});
  const dashboardsStore = { dashboards: new Map([[dashboard.id, dashboard]]), dashboardsList: [dashboard], updateDashboard: jest.fn() };
  const store = new EditSvgDashboardPageStore(dashboardsStore);
  store.setDashboard(dashboard.id);
  return { store, dashboard, dashboardsStore };
}

test('legacy SVG without swipe settings renders the complete native editor and preserves bindings', () => {
  const source = legacyDashboard();
  const original = JSON.stringify(source);
  const { store, dashboard, dashboardsStore } = makeEditor(source);
  const children = ({ children }) => React.createElement('div', null, children);
  const field = ({ title, value }) => React.createElement('label', null, title, React.createElement('span', null, String(value)));
  const { VisualEditView } = loadSource(`${editor}/components/visual-edit-view/visual-edit-view.tsx`, {
    'mobx-react-lite': { observer: (component) => component },
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    'use-file-picker': { useFilePicker: () => [jest.fn()] },
    '@/components/alert': { Alert: children },
    '@/components/button': { Button: () => null },
    '@/components/card': { Card: ({ heading, children }) => React.createElement('section', null, heading, children) },
    '@/components/form': { BooleanField: field, StringField: field, OptionsField: field },
    '@/utils/url': { useParseHash: () => ({ id: dashboard.id }) },
    '../svg-view': { SvgView: ({ svg }) => React.createElement('div', { 'data-svg-preview': true }, svg) },
    './components/visual-bindings-editor': { VisualBindingsEditor: () => null },
  });
  const html = renderToStaticMarkup(React.createElement(VisualEditView, { store, dashboardsStore, devices: [] }));
  expect(html).toContain('edit-svg-dashboard.labels.swipe-enable');
  expect(html).toContain('data-svg-preview');
  expect(store.swipeParameters).toEqual({ enable: false, left: null, right: null });
  expect(store.bindingsStore.params).toEqual(source.svg.params);
  expect(store.svgStore.svg).toBe(source.svg.current);
  expect(JSON.stringify(source)).toBe(original);
  expect(dashboardsStore.updateDashboard).not.toHaveBeenCalled();
});

test('existing and partial swipe settings survive editing without mutating the saved dashboard', () => {
  const source = { ...legacyDashboard(), swipe: { enable: true, left: 'other-panel' } };
  const { store, dashboard } = makeEditor(source);
  expect(store.swipeParameters).toEqual({ enable: true, left: 'other-panel', right: null });
  store.setSwipeParameters('left', 'new-panel');
  expect(dashboard.swipe.left).toBe('other-panel');
  expect(source.swipe.left).toBe('other-panel');
});

test('legacy bindings keep their functions and channel identifiers when selected and saved', () => {
  const source = legacyDashboard();
  const { store } = makeEditor(source);
  const element = { tagName: 'text', getAttribute: (name) => name === 'id' ? 'f1780d222b55' : null, classList: { add: jest.fn(), remove: jest.fn() } };
  store.bindingsStore.onSelectSvgElement(element);
  expect(store.bindingsStore.editable.params.read).toEqual(source.svg.params[0].read);
  expect(store.bindingsStore.editable.params['long-press'].enable).toBe(false);
  store.bindingsStore.saveBinding();
  expect(store.bindingsStore.params[0].read).toEqual(source.svg.params[0].read);
  expect(store.bindingsStore.params[0].write.value).toEqual({ on: 1, off: 0 });
});

test('display-only SVG sizing preserves valid dimensions, IDs and formulas', () => {
  const { svgForDisplay } = loadSource('src/utils/svg-for-display.ts');
  const original = legacyDashboard().svg.current;
  const displayed = svgForDisplay(original);
  expect(displayed).not.toContain('width="auto"');
  expect(displayed).toContain('height="80vh"');
  expect(displayed).toContain('viewBox="0 0 580 550"');
  expect(displayed).toContain('id="f1780d222b55"');
  expect(original).toContain('width="auto"');
  expect(svgForDisplay('<svg width="580" height="550" data-width="auto"/>')).toBe('<svg width="580" height="550" data-width="auto"/>');
  expect(svgForDisplay("<svg width='auto' height='auto'/>" )).toBe('<svg/>');
});
