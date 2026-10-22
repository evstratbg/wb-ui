import ReactDOM from 'react-dom/client';
import OverviewPage from '@/pages/overview/overview';
import HomePage from '@/pages/home/home';
import { setReactLocale } from '~/react-directives/locale';

export default function overviewDirective($rootScope, HistoryProxy) {
  'ngInject';
  setReactLocale();
  return {
    restrict: 'E',
    scope: {},
    link(scope, element) {
      scope.root = ReactDOM.createRoot(element[0]);
      scope.root.render(<OverviewPage devicesStore={$rootScope.devicesStore} historyProxy={HistoryProxy} />);
      element.on('$destroy', () => scope.root.unmount());
    },
  };
}

export function livingDirective($rootScope) {
  'ngInject';
  setReactLocale();
  return {
    restrict: 'E',
    scope: {},
    link(scope, element) {
      const root = ReactDOM.createRoot(element[0]);
      root.render(
        <HomePage
          devicesStore={$rootScope.devicesStore}
          dashboardsStore={$rootScope.dashboardsStore}
        />
      );
      element.on('$destroy', () => root.unmount());
    },
  };
}
