import ReactDOM from 'react-dom/client';
import { PanelBuilder } from '@/pages/dashboards/builder/panel-builder';
import { setReactLocale } from '~/react-directives/locale';
export default function panelBuilderDirective($rootScope, $state, ConfigEditorProxy, PageState) {
  'ngInject';
  setReactLocale();
  return { restrict: 'E', scope: {}, link(scope, element) {
    const root = ReactDOM.createRoot(element[0]);
    root.render(<PanelBuilder proxy={ConfigEditorProxy} dashboardsStore={$rootScope.dashboardsStore} devicesStore={$rootScope.devicesStore} panelId={$state.params.panel} onDirtyChange={(dirty) => PageState.setDirty(dirty)} onExit={(id) => $state.go(id ? 'dashboard' : 'dashboards', id ? { id } : {}, { inherit: false })} />);
    element.on('$destroy', () => { root.unmount(); PageState.setDirty(false); });
  } };
}
