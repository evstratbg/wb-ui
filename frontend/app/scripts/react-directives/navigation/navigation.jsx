import ReactDOM from 'react-dom/client';
import { Navigation } from '@/components/navigation';
import { setReactLocale } from '~/react-directives/locale';
import { uiStore } from '@/stores/ui';

export default function navigationDirective($rootScope, $state) {
  'ngInject';
  setReactLocale();

  return {
    restrict: 'E',
    scope: {},
    link: function (scope, element) {
      scope.root = ReactDOM.createRoot(element[0]);
      scope.root.render(
        <Navigation
          toggleConsole={$rootScope.toggleConsole}
          dashboardsStore={$rootScope.dashboardsStore}
          changeWorkspace={(mode) =>
            $state
              .go(mode === 'home' ? 'living' : 'overview', {}, { inherit: false })
              .then(() => uiStore.setWorkspaceMode(mode))
          }
        />
      );

      element.on('$destroy', ()=> {
        scope.root.unmount();
      });
    },
  };
}
