import ReactDOM from 'react-dom/client';
import EditRulePage from '@/pages/rules/[rule]';
import { setReactLocale } from '~/react-directives/locale';

export default function ruleDirective($rootScope, LogsProxy, PageState) {
  'ngInject';

  setReactLocale();

  return {
    restrict: 'E',
    scope: {},
    link: function(scope, element) {
      scope.root = ReactDOM.createRoot(element[0]);
      scope.root.render(
        <EditRulePage
          rulesStore={$rootScope.rulesStore}
          devicesStore={$rootScope.devicesStore}
          logsProxy={LogsProxy}
          onDirtyChange={(dirty) => PageState.setDirty(dirty)}
        />
      );

      element.on('$destroy', ()=> {
        scope.root.unmount();
        PageState.setDirty(false);
      });
    },
  };
}
