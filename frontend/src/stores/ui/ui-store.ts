import { makeAutoObservable, runInAction } from 'mobx';
import { authStore, UserRole } from '@/stores/auth';
import type { Dashboard } from '@/stores/dashboards';
import i18n from '~/i18n/react/config';
import { getMenu } from './api';
import { getMenuItems, mergeMenuItems, normalizeMenuResponse, toMenuItemInstance,
} from './menu-items';
import type { CustomMenuItem, MenuItemInstance } from './types';

export default class UiStore {
  public isConnected = false;
  public isConsoleVisible = false;
  public menuItems: MenuItemInstance[] = [];
  public modules: string[] = [];
  private preferredWorkspace: 'home' | 'installer';
  #additionalItems: CustomMenuItem[] = null;

  constructor() {
    try {
      const saved = localStorage.getItem('wb-ui-workspace');
      if (saved === 'home' || saved === 'installer') this.preferredWorkspace = saved;
    } catch {
      /* Browser preferences may be unavailable. */
    }
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get workspaceMode(): 'home' | 'installer' {
    if (!authStore.hasRights(UserRole.Operator)) return 'home';
    return this.preferredWorkspace || 'installer';
  }

  setWorkspaceMode(mode: 'home' | 'installer') {
    if (mode === 'installer' && !authStore.hasRights(UserRole.Operator)) return;
    this.preferredWorkspace = mode;
    try {
      localStorage.setItem('wb-ui-workspace', mode);
    } catch {
      /* Keep this session usable. */
    }
  }

  setIsConnected(isConnected: boolean) {
    runInAction(() => {
      this.isConnected = isConnected;
    });
  }

  toggleConsoleVisibility() {
    this.isConsoleVisible = !this.isConsoleVisible;
  }

  async buildMenu(dashboards: Dashboard[], isShowWidgetsPage: boolean, params: URLSearchParams) {
    const { hasRights } = authStore;

    const mode = this.workspaceMode;
    let commontems = getMenuItems(dashboards, isShowWidgetsPage, params, hasRights);
    if (mode === 'home') {
      commontems = commontems
        .filter(
          (item) =>
            ['dashboards-all', 'settings'].includes(item.id) ||
            ['history', 'help'].includes(item.url)
        )
        .map((item) =>
          item.id === 'settings'
            ? {
                ...item,
                children: item.children.filter((child) => child.url === 'web-ui'),
              }
            : item.id === 'dashboards-all'
              ? {
                  ...item,
                  children: item.children.filter((child) => child.url !== 'dashboards/widgets'),
                }
              : item
        );
      commontems.unshift({
        label: 'navigation.labels.my-home',
        url: 'home',
        isShow: !params.has('fullscreen'),
      });
    }
    const customItems = await this.#getCustomMenuItems();

    runInAction(() => {
      if (mode !== this.workspaceMode) return;
      this.menuItems = mode === 'home' ? commontems : mergeMenuItems(commontems, customItems);
    });
  }

  async #getCustomMenuItems() {
    if (!this.#additionalItems) {
      const additionalItems = await getMenu();
      this.#additionalItems = normalizeMenuResponse(additionalItems);
    }
    runInAction(() => {
      this.modules = this.#collectModuleIds(this.#additionalItems);
    });
    return this.#additionalItems.map((item) => toMenuItemInstance(item, i18n.language));
  }

  #collectModuleIds(items: CustomMenuItem[]): string[] {
    const result: string[] = [];

    const walk = (item?: CustomMenuItem) => {
      if (!item?.children) {
        return;
      }

      item.children.forEach((child) => {
        if (child.id && !result.includes(child.id)) {
          result.push(child.id);
        }
        walk(child);
      });
    };

    items.forEach((item) => walk(item));

    return result;
  }
}
